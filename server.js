require('dotenv').config(); // .env 파일 로드 필수
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs'); // 파일 시스템 모듈을 최상단으로 이동

const app = express();
const db = new sqlite3.Database('./database.db');
const SALT_ROUNDS = 10;
const PORT = 3000;

// 색상 설정 저장 파일 경로 설정
const COLORS_FILE = path.join(__dirname, 'server', 'colors.json');

// [관리자 설정] .env 파일에 등록된 관리자 ID와 이메일 매핑
const ADMINS = {
    'spring': process.env.ADMIN_EMAIL_SPRING,
    'summer': process.env.ADMIN_EMAIL_SUMMER,
    'autumn': process.env.ADMIN_EMAIL_AUTUMN
};

app.use(bodyParser.json());
app.use(express.static(__dirname, { extensions: ['html'] }));
app.use(session({
    secret: 'hwao-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24시간
}));

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

const loginAttempts = {};

// --- 관리자 인증 API (이메일 OTP) ---

// 1. 인증 코드 발송 요청
app.post('/api/admin/send-code', (req, res) => {
    const { id } = req.body;

    // 등록된 관리자 ID인지 확인
    if (!ADMINS[id]) {
        return res.status(400).json({ success: false, message: "등록되지 않은 관리자 ID입니다." });
    }

    const targetEmail = ADMINS[id];
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6자리 코드 생성
    
    // 코드 저장 (유효시간 3분)
    adminOtpStore = {
        userId: id,
        code: code,
        expires: Date.now() + 3 * 60 * 1000
    };

    const mailOptions = {
        from: process.env.MAIL_USER,
        to: targetEmail,
        subject: '[화성오산 학교지도] 관리자 인증 코드',
        text: `관리자(${id}) 로그인 인증 코드: [ ${code} ]\n3분 내에 입력해주세요.`
    };

    transporter.sendMail(mailOptions, (error) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ success: false, message: "메일 발송 실패" });
        }
        // 이메일 주소 마스킹하여 응답
        const maskedEmail = targetEmail.replace(/(.{2})(.*)(@.*)/, '$1*****$3');
        res.json({ success: true, message: `${maskedEmail}로 인증코드를 보냈습니다.` });
    });
});

// 2. 인증 코드 검증 및 로그인
app.post('/api/admin/verify-code', (req, res) => {
    const { code } = req.body;

    if (!adminOtpStore.code || Date.now() > adminOtpStore.expires) {
        return res.status(400).json({ success: false, message: "인증 코드가 만료되었거나 없습니다." });
    }

    if (adminOtpStore.code === code) {
        const adminId = adminOtpStore.userId;
        
        // 인증 성공: 정보 파기 후 세션 생성
        adminOtpStore = { userId: null, code: null, expires: null };
        
        req.session.userId = adminId;
        req.session.isAdminAuth = true; // 관리자 인증 플래그 설정
        
        req.session.save(() => {
            res.json({ success: true, userId: adminId });
        });
    } else {
        res.status(401).json({ success: false, message: "인증 코드가 일치하지 않습니다." });
    }
});

// --- 일반 사용자 인증 API ---

app.post('/api/login', (req, res) => {
    const { id, pw } = req.body;
    
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
    db.get("SELECT pw FROM users WHERE id = ?", [id], (err, row) => {
        if (row) res.json({ success: true, message: "비밀번호는 암호화되어 있어 알려드릴 수 없습니다. 초기화를 요청하세요." }); 
        else res.status(404).json({ success: false, message: "존재하지 않는 아이디" });
    });
});

app.post('/api/request-reset-pw', (req, res) => {
    const { id } = req.body;
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
    db.run("INSERT OR REPLACE INTO memos (userId, schoolName, content) VALUES (?, ?, ?)", 
        [req.session.userId, schoolName, content], (err) => res.json({ success: !err }));
});

app.delete('/api/memo', isLoggedIn, (req, res) => {
    const { schoolName } = req.body;
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
    const { id, tempPw } = req.body;
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
        res.json(JSON.parse(data));
    });
});

// 2. 색상 저장하기 (관리자 권한 필수)
app.post('/api/colors', isAdmin, (req, res) => {
    const newColors = req.body;
    fs.writeFile(COLORS_FILE, JSON.stringify(newColors, null, 2), 'utf8', (err) => {
        if (err) return res.status(500).json({ error: "파일 쓰기 실패" });
        res.json({ success: true });
    });
});

// --- 서버 실행 ---
app.listen(PORT, () => {
    console.log(`서버 실행: http://localhost:${PORT}`);
});