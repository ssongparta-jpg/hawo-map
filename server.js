require('dotenv').config(); // .env 파일 로드
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

const app = express();
const db = new sqlite3.Database('./database.db');
const SALT_ROUNDS = 10;
const PORT = 3000;

// [관리자 설정] ID와 이메일 매핑 (.env 파일에 해당 변수들이 있어야 함)
const ADMINS = {
    'spring': process.env.ADMIN_EMAIL_SPRING,
    'summer': process.env.ADMIN_EMAIL_SUMMER,
    'autumn': process.env.ADMIN_EMAIL_AUTUMN
};

app.use(bodyParser.json());
app.use(express.static(__dirname)); 
app.use(session({
    secret: 'hwao-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24시간 유지
}));

// 메일 전송 설정 (Nodemailer)
const transporter = nodemailer.createTransport({
    service: process.env.MAIL_SERVICE, // 예: 'gmail'
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

// 인증 코드 임시 저장소
let adminOtpStore = {
    userId: null,
    code: null,
    expires: null
};

// --- 미들웨어 ---

function isLoggedIn(req, res, next) {
    if (req.session.userId) return next();
    res.status(403).json({ success: false, message: "로그인이 필요합니다." });
}

function isAdmin(req, res, next) {
    const userId = req.session.userId;
    // 세션 ID가 관리자 목록에 있고, 관리자 인증 플래그가 true여야 함
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
    
    // 관리자 ID가 일반 유저 테이블에 있다면 삭제 (충돌 방지)
    Object.keys(ADMINS).forEach(adminId => {
        db.run("DELETE FROM users WHERE id = ?", [adminId]);
    });
});

const loginAttempts = {};

// --- 관리자 인증 API (OTP) ---

// 1. 인증 코드 발송 요청
app.post('/api/admin/send-code', (req, res) => {
    const { id } = req.body;

    if (!ADMINS[id]) {
        return res.status(400).json({ success: false, message: "등록되지 않은 관리자 ID입니다." });
    }

    const targetEmail = ADMINS[id];
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    adminOtpStore = {
        userId: id,
        code: code,
        expires: Date.now() + 3 * 60 * 1000 // 3분 유효
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
        // 보안을 위해 이메일 일부 마스킹 처리 후 응답
        const maskedEmail = targetEmail.replace(/(.{2})(.*)(@.*)/, '$1*****$3');
        res.json({ success: true, message: `${maskedEmail}로 인증코드를 보냈습니다.` });
    });
});

// 2. 인증 코드 검증
app.post('/api/admin/verify-code', (req, res) => {
    const { code } = req.body;

    if (!adminOtpStore.code || Date.now() > adminOtpStore.expires) {
        return res.status(400).json({ success: false, message: "인증 코드가 만료되었거나 없습니다." });
    }

    if (adminOtpStore.code === code) {
        const adminId = adminOtpStore.userId;
        
        // 인증 성공 시 정보 파기 및 세션 설정
        adminOtpStore = { userId: null, code: null, expires: null };
        
        req.session.userId = adminId;
        req.session.isAdminAuth = true;
        
        req.session.save(() => {
            res.json({ success: true, userId: adminId });
        });
    } else {
        res.status(401).json({ success: false, message: "인증 코드가 일치하지 않습니다." });
    }
});

// --- 일반 사용자 API ---

app.post('/api/login', (req, res) => {
    const { id, pw } = req.body;
    
    // 관리자 ID로 일반 로그인 시도 차단
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
    if (!id || !pw) return res.status(400).json({ success: false, message: "정보를 입력하세요." });
    
    if (ADMINS[id]) return res.status(400).json({ success: false, message: "사용할 수 없는 아이디입니다." });

    try {
        const hash = await bcrypt.hash(pw, SALT_ROUNDS);
        db.run("INSERT INTO users (id, pw) VALUES (?, ?)", [id, hash], (err) => {
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
        const hash = await bcrypt.hash(newPw, SALT_ROUNDS);
        db.run("UPDATE users SET pw = ? WHERE id = ?", [hash, req.session.userId], (err) => {
            res.json({ success: !err, message: err ? "변경 실패" : "비밀번호 변경됨" });
        });
    } catch (err) { res.status(500).json({success: false}); }
});

// --- 메모 & 즐겨찾기 API ---

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

app.post('/api/request-reset-pw', (req, res) => {
    const { id } = req.body;
    db.run("INSERT OR IGNORE INTO reset_requests (id) VALUES (?)", [id], (err) => {
        res.json({ success: !err, message: "초기화 요청이 접수되었습니다." });
    });
});

// --- 관리자 전용 API ---

app.get('/api/admin/users', isAdmin, (req, res) => {
    db.all("SELECT id FROM users", (err, rows) => { // 관리자 ID는 이미 제거했으므로 전체 조회해도 무방
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

app.listen(PORT, () => {
    console.log(`서버 실행: http://localhost:${PORT}`);
});