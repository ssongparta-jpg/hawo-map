require('dotenv').config(); // .env 파일 로드 필수
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs'); // 파일 시스템 모듈을 최상단으로 이동
const crypto = require('crypto');

const app = express();
const db = new sqlite3.Database('./database.db');
const SALT_ROUNDS = 10;
const PORT = 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

// 색상 설정 저장 파일 경로 설정
const COLORS_FILE = path.join(__dirname, 'server', 'colors.json');
const HWAO_GEOJSON_FILE = path.join(__dirname, 'data', 'hwao.geojson');
const SCHOOL_AGE_FROM = process.env.SCHOOL_AGE_FROM || '6';
const SCHOOL_AGE_TO = process.env.SCHOOL_AGE_TO || '17';
const SGIS_AUTH_URL = 'https://sgisapi.kostat.go.kr/OpenAPI3/auth/authentication.json';
const SGIS_POPULATION_URL = 'https://sgisapi.kostat.go.kr/OpenAPI3/stats/searchpopulation.json';
let schoolAgeCache = { key: null, expires: 0, data: null };

// [관리자 설정] .env 파일에 등록된 관리자 ID와 이메일 매핑
const ADMINS = {};
if (process.env.ADMIN_EMAILS) {
    process.env.ADMIN_EMAILS.split(',').forEach(pair => {
        const [id, email] = pair.split(':');
        if (id && email) {
            ADMINS[id.trim()] = email.trim();
        }
    });
}

app.use(bodyParser.json());
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: COOKIE_SECURE,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    } // 24시간
}));
if (!process.env.SESSION_SECRET) {
    console.warn('SESSION_SECRET is not set. A temporary session secret is used for this server run.');
}

function hasAdminSession(req) {
    const userId = req.session.userId;
    return !!(userId && ADMINS[userId] && req.session.isAdminAuth);
}

app.get(['/admin', '/admin.html'], (req, res) => {
    if (!hasAdminSession(req)) return res.redirect('/login');
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get(['/server/admin.js', '/server/admin.css'], (req, res) => {
    if (!hasAdminSession(req)) return res.status(403).send('관리자 권한이 필요합니다.');
    const fileName = path.basename(req.path);
    res.sendFile(path.join(__dirname, 'server', fileName));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});
app.use(express.static(__dirname, { extensions: ['html'] }));

// [이메일 전송 설정] Nodemailer
const transporter = nodemailer.createTransport({
    service: process.env.MAIL_SERVICE, // 예: 'gmail'
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

// 관리자 인증 코드 임시 저장소 (메모리)
let adminOtpStore = {
    userId: null,
    code: null,
    expires: null
};

// --- 미들웨어 ---

// 1. 일반 로그인 체크
function isLoggedIn(req, res, next) {
    if (req.session.userId) return next();
    res.status(403).json({ success: false, message: "로그인이 필요합니다." });
}

// 2. 관리자 권한 체크 (세션 플래그 확인)
function isAdmin(req, res, next) {
    const userId = req.session.userId;
    // 세션 ID가 관리자 목록에 있고, 인증 플래그(isAdminAuth)가 true여야 함
    if (userId && ADMINS[userId] && req.session.isAdminAuth) {
        return next();
    }
    res.status(403).json({ success: false, message: "관리자 권한이 필요합니다." });
}

// --- DB 초기화 ---
db.serialize(async () => {
    db.run("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, pw TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS memos (userId TEXT, schoolName TEXT, content TEXT, PRIMARY KEY(userId, schoolName))");
    db.run("CREATE TABLE IF NOT EXISTS reset_requests (id TEXT PRIMARY KEY, requestDate DATETIME DEFAULT CURRENT_TIMESTAMP)");
    db.run("CREATE TABLE IF NOT EXISTS favorites (userId TEXT, schoolName TEXT, PRIMARY KEY(userId, schoolName))");
    
    // [중요] 관리자 ID가 일반 users 테이블에 존재하면 삭제 (일반 비번 로그인 차단)
    Object.keys(ADMINS).forEach(adminId => {
        db.run("DELETE FROM users WHERE id = ?", [adminId]);
    });
});

// ip 주소 및 로그인 횟수 기록 (악의적 접근 차단)
const mailRequestLimits = {};
const loginAttempts = {};

function isValidUserId(id) {
    return typeof id === 'string' && /^[\w가-힣.-]{2,32}$/u.test(id.trim());
}

function isValidPassword(pw) {
    return typeof pw === 'string' && pw.length >= 4 && pw.length <= 128;
}

function isValidHexColor(color) {
    return typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color);
}

function validateColorsPayload(colors) {
    const required = {
        general: ['dongtanFill', 'byeongjeomFill', 'hyohoengFill', 'manseFill', 'hwaseongBorder', 'osanFill', 'osanBorder'],
        shared: ['hwaseongFill', 'hwaseongBorder', 'osanFill', 'osanBorder']
    };

    if (!colors || typeof colors !== 'object') return false;
    return Object.entries(required).every(([group, keys]) => {
        return colors[group] && typeof colors[group] === 'object' &&
            keys.every(key => isValidHexColor(colors[group][key]));
    });
}

async function fetchJsonUrl(url) {
    if (typeof fetch !== 'function') throw new Error('fetch is not available in this Node runtime');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`request failed: ${res.status}`);
    return res.json();
}

async function fetchSgisAccessToken() {
    const consumerKey = process.env.SGIS_CONSUMER_KEY;
    const consumerSecret = process.env.SGIS_CONSUMER_SECRET;
    if (!consumerKey || !consumerSecret) return null;

    const url = new URL(SGIS_AUTH_URL);
    url.searchParams.set('consumer_key', consumerKey);
    url.searchParams.set('consumer_secret', consumerSecret);

    const data = await fetchJsonUrl(url);
    return data?.result?.accessToken || data?.result?.access_token || data?.accessToken || null;
}

function buildSchoolAgeRequestUrl(feature, accessToken, year) {
    const props = feature.properties || {};
    const template = process.env.KOSTAT_SCHOOL_AGE_URL_TEMPLATE;
    if (template) {
        return template
            .replaceAll('{accessToken}', encodeURIComponent(accessToken || ''))
            .replaceAll('{year}', encodeURIComponent(year))
            .replaceAll('{admCd}', encodeURIComponent(props.adm_cd || ''))
            .replaceAll('{admCd2}', encodeURIComponent(props.adm_cd2 || ''))
            .replaceAll('{sgg}', encodeURIComponent(props.sgg || ''))
            .replaceAll('{ageFrom}', encodeURIComponent(SCHOOL_AGE_FROM))
            .replaceAll('{ageTo}', encodeURIComponent(SCHOOL_AGE_TO));
    }

    const url = new URL(SGIS_POPULATION_URL);
    url.searchParams.set('accessToken', accessToken);
    url.searchParams.set('year', year);
    url.searchParams.set('adm_cd', props.adm_cd || '');
    url.searchParams.set('low_search', '0');
    url.searchParams.set('gender', '0');
    url.searchParams.set('age_from', SCHOOL_AGE_FROM);
    url.searchParams.set('age_to', SCHOOL_AGE_TO);
    return url.toString();
}

function extractPopulationValue(data) {
    const keys = ['school_age_population', 'schoolAgePopulation', 'population', 'ppltn', 'tot_ppltn', 'tot_ppltn_cnt', 'value', 'dt'];
    const toNumber = (value) => {
        const num = Number(String(value ?? '').replace(/,/g, ''));
        return Number.isFinite(num) ? num : null;
    };

    const readObject = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        for (const key of keys) {
            const num = toNumber(obj[key]);
            if (num !== null) return num;
        }
        return null;
    };

    if (Array.isArray(data)) {
        const values = data.map(extractPopulationValue).filter(Number.isFinite);
        return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
    }

    const direct = readObject(data);
    if (direct !== null) return direct;
    if (Array.isArray(data?.result)) return extractPopulationValue(data.result);
    if (data?.result && typeof data.result === 'object') return extractPopulationValue(data.result);
    if (Array.isArray(data?.data)) return extractPopulationValue(data.data);
    return null;
}

async function mapLimit(items, limit, iterator) {
    const results = [];
    let index = 0;
    async function worker() {
        while (index < items.length) {
            const current = index++;
            results[current] = await iterator(items[current], current);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

async function fetchLiveSchoolAgeValues(features, year) {
    const accessToken = await fetchSgisAccessToken();
    if (!accessToken && !process.env.KOSTAT_SCHOOL_AGE_URL_TEMPLATE) return null;

    const pairs = await mapLimit(features, 4, async (feature) => {
        const url = buildSchoolAgeRequestUrl(feature, accessToken, year);
        const data = await fetchJsonUrl(url);
        const value = extractPopulationValue(data);
        return [feature.properties.adm_cd2, value];
    });

    const valueMap = {};
    pairs.forEach(([admCd2, value]) => {
        if (Number.isFinite(value)) valueMap[admCd2] = value;
    });
    return Object.keys(valueMap).length ? valueMap : null;
}

// 1. 인증 코드 발송 요청
app.post('/api/admin/send-code', (req, res) => {
    const { id } = req.body;
    if (!isValidUserId(id)) {
        return res.status(400).json({ success: false, message: "관리자 ID 형식이 올바르지 않습니다." });
    }
    
    // IP 기반 1분 쿨다운 방어
    const clientIp = req.ip || req.socket.remoteAddress;
    if (mailRequestLimits[clientIp] && Date.now() - mailRequestLimits[clientIp] < 60000) {
        return res.status(429).json({ success: false, message: "메일 발송 요청이 너무 잦습니다. 1분 후에 다시 시도해주세요." });
    }

    if (!ADMINS[id]) {
        return res.status(400).json({ success: false, message: "등록되지 않은 관리자 ID입니다." });
    }

    mailRequestLimits[clientIp] = Date.now(); // 쿨다운 기록

    const targetEmail = ADMINS[id];
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6자리 코드 생성
    
    adminOtpStore = {
        userId: id,
        code: code,
        expires: Date.now() + 3 * 60 * 1000,
        attempts: 0 
    };

    const mailOptions = {
        from: process.env.MAIL_USER,
        to: targetEmail,
        subject: '[화성오산 학교지도] 관리자 인증 코드',
        text: `관리자(${id}) 로그인 인증 코드: [ ${code} ]\n3분 내에 입력해주세요. (5회 오류 시 파기됩니다)`
    };

    transporter.sendMail(mailOptions, (error) => {
        if (error) {
            console.error("Mail Error:", error);
            delete mailRequestLimits[clientIp];
            return res.status(500).json({ success: false, message: "메일 발송 실패" });
        }
        const maskedEmail = targetEmail.replace(/(.{2})(.*)(@.*)/, '$1*****$3');
        res.json({ success: true, message: `${maskedEmail}로 인증코드를 보냈습니다. (제한: 5회)` });
    });
});

// 2. 인증 코드 및 구글 리캡챠 검증 후 로그인
app.post('/api/admin/verify-code', async (req, res) => {
    const { code, recaptchaToken } = req.body;

    // [구글 reCAPTCHA 검증]
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (secretKey) {
        try {
            const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`;
            const reCaptchaRes = await fetch(verifyUrl, { method: 'POST' });
            const reCaptchaData = await reCaptchaRes.json();
            
            if (!reCaptchaData.success) {
                return res.status(403).json({ success: false, message: "비정상적인 접근입니다 (로봇 의심). '로봇이 아닙니다' 체크를 다시 진행해주세요." });
            }
        } catch (error) {
            console.error("reCAPTCHA Error:", error);
            return res.status(500).json({ success: false, message: "캡챠 서버 통신 오류가 발생했습니다." });
        }
    }

    // [기존 OTP 코드 검증]
    if (!adminOtpStore.code || Date.now() > adminOtpStore.expires) {
        return res.status(400).json({ success: false, message: "인증 코드가 만료되었거나 존재하지 않습니다. 다시 요청해주세요." });
    }

    if (adminOtpStore.code === code) {
        const adminId = adminOtpStore.userId;
        adminOtpStore = { userId: null, code: null, expires: null, attempts: 0 };
        
        req.session.userId = adminId;
        req.session.isAdminAuth = true; 
        
        req.session.save(() => {
            res.json({ success: true, userId: adminId });
        });
    } else {
        adminOtpStore.attempts += 1;
        const maxAttempts = 5;

        if (adminOtpStore.attempts >= maxAttempts) {
            adminOtpStore = { userId: null, code: null, expires: null, attempts: 0 };
            return res.status(403).json({ 
                success: false, 
                message: "입력 시도 횟수(5회)를 초과하여 보안상 인증 코드가 파기되었습니다. 코드를 다시 발급받아주세요." 
            });
        }

        res.status(401).json({ 
            success: false, 
            message: `인증 코드가 일치하지 않습니다. (남은 기회: ${maxAttempts - adminOtpStore.attempts}번)` 
        });
    }
});

// --- 일반 사용자 인증 API ---

app.post('/api/login', (req, res) => {
    const { id, pw } = req.body;
    if (!isValidUserId(id) || !isValidPassword(pw)) {
        return res.status(400).json({ success: false, message: "ID/PW 형식이 올바르지 않습니다." });
    }
    
    if (ADMINS[id]) {
        return res.status(403).json({ success: false, message: "관리자 로그인은 아이디 박스를 5번 클릭하세요." });
    }

    db.get("SELECT * FROM users WHERE id = ?", [id], async (err, row) => {
        if (row && await bcrypt.compare(pw, row.pw)) {
            delete loginAttempts[id];
            req.session.userId = id;
            req.session.isAdminAuth = false; 
            req.session.save(() => res.json({ success: true, userId: id }));
        } else {
            loginAttempts[id] = (loginAttempts[id] || 0) + 1;
            res.status(401).json({ success: false, message: "ID/PW가 일치하지 않습니다.", attempts: loginAttempts[id] });
        }
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/check-auth', (req, res) => {
    if (req.session.userId) {
        res.json({ 
            isLoggedIn: true, 
            userId: req.session.userId, 
            isAdmin: req.session.isAdminAuth || false 
        });
    } else {
        res.json({ isLoggedIn: false });
    }
});

app.post('/api/register', async (req, res) => {
    const { id, pw } = req.body;
    if (!id || !pw) return res.status(400).json({ success: false, message: "정보를 모두 입력하세요." });
    if (!isValidUserId(id)) return res.status(400).json({ success: false, message: "아이디는 2~32자의 한글, 영문, 숫자, _, ., - 만 사용할 수 있습니다." });
    if (!isValidPassword(pw)) return res.status(400).json({ success: false, message: "비밀번호는 4~128자로 입력해주세요." });

    if (ADMINS[id]) return res.status(400).json({ success: false, message: "사용할 수 없는 아이디입니다." });

    try {
        const hashedPassword = await bcrypt.hash(pw, SALT_ROUNDS);
        db.run("INSERT INTO users (id, pw) VALUES (?, ?)", [id, hashedPassword], (err) => {
            if (err) return res.status(409).json({success: false, message: "이미 존재하는 아이디입니다."});
            res.json({success: true, message: "회원가입 완료"});
        });
    } catch (err) {
        res.status(500).json({success: false, message: "서버 오류"});
    }
});

app.post('/api/change-pw', isLoggedIn, async (req, res) => {
    const { newPw } = req.body;
    if (!isValidPassword(newPw)) {
        return res.status(400).json({ success: false, message: "비밀번호는 4~128자로 입력해주세요." });
    }
    try {
        const hashedNewPw = await bcrypt.hash(newPw, SALT_ROUNDS);
        db.run("UPDATE users SET pw = ? WHERE id = ?", [hashedNewPw, req.session.userId], (err) => {
            res.json({ success: !err, message: err ? "변경 실패" : "비밀번호가 변경되었습니다." });
        });
    } catch (err) { res.status(500).json({success: false}); }
});

// --- 비밀번호 찾기 ---
app.post('/api/find-pw', (req, res) => {
    const { id } = req.body;
    if (!isValidUserId(id)) return res.status(400).json({ success: false, message: "아이디 형식이 올바르지 않습니다." });
    db.get("SELECT pw FROM users WHERE id = ?", [id], (err, row) => {
        if (row) res.json({ success: true, message: "비밀번호는 암호화되어 있어 알려드릴 수 없습니다. 초기화를 요청하세요." }); 
        else res.status(404).json({ success: false, message: "존재하지 않는 아이디" });
    });
});

app.post('/api/request-reset-pw', (req, res) => {
    const { id } = req.body;
    if (!isValidUserId(id)) return res.status(400).json({ success: false, message: "아이디 형식이 올바르지 않습니다." });
    db.run("INSERT OR IGNORE INTO reset_requests (id) VALUES (?)", [id], (err) => {
        res.json({ success: !err, message: "초기화 요청이 접수되었습니다." });
    });
});

// --- 메모 API ---
app.get('/api/memo/:schoolName', (req, res) => {
    if (!req.session.userId) return res.json({ content: "" });
    db.get("SELECT content FROM memos WHERE userId = ? AND schoolName = ?", 
        [req.session.userId, req.params.schoolName], (err, row) => {
        res.json({ content: row ? row.content : "" });
    });
});

app.post('/api/memo', isLoggedIn, (req, res) => {
    const { schoolName, content } = req.body;
    if (typeof schoolName !== 'string' || schoolName.length > 120 || typeof content !== 'string' || content.length > 2000) {
        return res.status(400).json({ success: false, message: "메모 입력값이 올바르지 않습니다." });
    }
    db.run("INSERT OR REPLACE INTO memos (userId, schoolName, content) VALUES (?, ?, ?)", 
        [req.session.userId, schoolName, content], (err) => res.json({ success: !err }));
});

app.delete('/api/memo', isLoggedIn, (req, res) => {
    const { schoolName } = req.body;
    if (typeof schoolName !== 'string' || schoolName.length > 120) {
        return res.status(400).json({ success: false, message: "학교명이 올바르지 않습니다." });
    }
    db.run("DELETE FROM memos WHERE userId = ? AND schoolName = ?", 
        [req.session.userId, schoolName], (err) => res.json({ success: !err }));
});

// --- 즐겨찾기 API ---
app.get('/api/favorite/:schoolName', isLoggedIn, (req, res) => {
    db.get("SELECT * FROM favorites WHERE userId = ? AND schoolName = ?",
        [req.session.userId, req.params.schoolName], (err, row) => res.json({ isFavorite: !!row }));
});

app.post('/api/favorite/toggle', isLoggedIn, (req, res) => {
    const { schoolName } = req.body;
    if (typeof schoolName !== 'string' || schoolName.length > 120) {
        return res.status(400).json({ success: false, message: "학교명이 올바르지 않습니다." });
    }
    const userId = req.session.userId;
    db.get("SELECT * FROM favorites WHERE userId = ? AND schoolName = ?", [userId, schoolName], (err, row) => {
        if (row) {
            db.run("DELETE FROM favorites WHERE userId = ? AND schoolName = ?", [userId, schoolName], () => res.json({success: true, isFavorite: false}));
        } else {
            db.run("INSERT INTO favorites (userId, schoolName) VALUES (?, ?)", [userId, schoolName], () => res.json({success: true, isFavorite: true}));
        }
    });
});

app.get('/api/my-favorites', isLoggedIn, (req, res) => {
    db.all("SELECT schoolName FROM favorites WHERE userId = ?", [req.session.userId], (err, rows) => {
        res.json({ favorites: rows ? rows.map(r => r.schoolName) : [] });
    });
});

app.get('/api/school-age-population', async (req, res) => {
    const year = String(req.query.year || process.env.SGIS_STATS_YEAR || new Date().getFullYear() - 1);
    const cacheKey = `school-age:${year}:${SCHOOL_AGE_FROM}-${SCHOOL_AGE_TO}`;
    if (req.query.refresh !== '1' && schoolAgeCache.key === cacheKey && schoolAgeCache.expires > Date.now()) {
        return res.json(schoolAgeCache.data);
    }

    try {
        const geojson = JSON.parse(fs.readFileSync(HWAO_GEOJSON_FILE, 'utf8'));
        const features = (geojson.features || []).filter(feature => {
            const sgg = feature.properties?.sggnm || '';
            return sgg.includes('화성시') || sgg.includes('오산시');
        });

        let source = 'kostat-pending';
        let message = 'SGIS_CONSUMER_KEY/SGIS_CONSUMER_SECRET 또는 KOSTAT_SCHOOL_AGE_URL_TEMPLATE 설정이 필요합니다.';
        let values = null;

        try {
            values = await fetchLiveSchoolAgeValues(features, year);
            if (values) {
                source = 'kostat-live';
                message = '통계청 API에서 동기화되었습니다.';
            }
        } catch (err) {
            message = '통계청 API 응답을 읽지 못했습니다. 환경변수와 API 권한을 확인하세요.';
            console.warn('School-age population sync failed:', err.message);
        }

        const response = {
            source,
            year,
            ageRange: { from: Number(SCHOOL_AGE_FROM), to: Number(SCHOOL_AGE_TO) },
            message,
            features: features.map(feature => ({
                type: 'Feature',
                properties: {
                    ...feature.properties,
                    schoolAgePopulation: values ? values[feature.properties.adm_cd2] ?? null : null
                },
                geometry: feature.geometry
            }))
        };

        schoolAgeCache = {
            key: cacheKey,
            expires: Date.now() + 30 * 60 * 1000,
            data: response
        };
        res.json(response);
    } catch (err) {
        res.status(500).json({ success: false, message: '학령인구 지도 데이터를 만들 수 없습니다.' });
    }
});

// --- 관리자 전용 패널 API ---

app.get('/api/admin/users', isAdmin, (req, res) => {
    db.all("SELECT id FROM users", (err, rows) => {
        res.json({ users: rows || [] });
    });
});

app.delete('/api/admin/users/:id', isAdmin, (req, res) => {
    const targetId = req.params.id;
    db.serialize(() => {
        db.run("DELETE FROM users WHERE id = ?", [targetId]);
        db.run("DELETE FROM memos WHERE userId = ?", [targetId]);
        res.json({ success: true, message: "삭제 완료" });
    });
});

app.get('/api/admin/memos', isAdmin, (req, res) => {
    db.all("SELECT userId, schoolName, content FROM memos", (err, rows) => {
        res.json({ memos: rows || [] });
    });
});

// 관리자 권한 메모 강제 삭제 (isAdmin 미들웨어로 보호됨)
app.delete('/api/admin/memos', isAdmin, (req, res) => {
    const { userId, schoolName } = req.body;
    db.run("DELETE FROM memos WHERE userId = ? AND schoolName = ?", [userId, schoolName], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.get('/api/admin/reset-requests', isAdmin, (req, res) => {
    db.all("SELECT id, requestDate FROM reset_requests ORDER BY requestDate DESC", (err, rows) => {
        res.json({ requests: rows || [] });
    });
});

app.post('/api/admin/approve-reset', isAdmin, async (req, res) => {
    const { id } = req.body;
    if (!isValidUserId(id)) return res.status(400).json({ success: false, message: "아이디 형식이 올바르지 않습니다." });
    const tempPw = '1234';
    const hash = await bcrypt.hash(tempPw, SALT_ROUNDS);
    db.serialize(() => {
        db.run("UPDATE users SET pw = ? WHERE id = ?", [hash, id]);
        db.run("DELETE FROM reset_requests WHERE id = ?", [id], () => {
            res.json({ success: true, message: "초기화 성공" });
        });
    });
});

// --- 지도 색상 JSON 관리 API ---

// 1. 색상 불러오기
app.get('/api/colors', (req, res) => {
    fs.readFile(COLORS_FILE, 'utf8', (err, data) => {
        if (err) {
            return res.status(404).json({ error: "색상 파일이 없습니다." });
        }
        try {
            res.json(JSON.parse(data));
        } catch(e) {
            res.status(500).json({ error: "색상 파일 형식이 올바르지 않습니다." });
        }
    });
});

// 2. 색상 저장하기 (관리자 권한 필수)
app.post('/api/colors', isAdmin, (req, res) => {
    const newColors = req.body;
    if (!validateColorsPayload(newColors)) {
        return res.status(400).json({ error: "색상 값 형식이 올바르지 않습니다." });
    }
    fs.writeFile(COLORS_FILE, JSON.stringify(newColors, null, 2), 'utf8', (err) => {
        if (err) return res.status(500).json({ error: "파일 쓰기 실패" });
        res.json({ success: true });
    });
});

// --- 서버 실행 ---
app.listen(PORT, () => {
    console.log(`서버 실행: http://localhost:${PORT}`);
});
