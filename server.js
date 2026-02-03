const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const db = new sqlite3.Database('./database.db');

// --- 환경 설정 ---
const PORT = 3000;
const ADMIN_ID = 'spring';
const ADMIN_PW = '0327';

app.use(bodyParser.json());
app.use(express.static(__dirname)); 
app.use(session({
    secret: 'hwao-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// --- 미들웨어 ---

// 1. 일반 로그인 체크
function isLoggedIn(req, res, next) {
    if (req.session.userId) return next();
    res.status(403).json({ success: false, message: "로그인이 필요합니다." });
}

// 2. 관리자 권한 체크
function isAdmin(req, res, next) {
    if (req.session.userId === ADMIN_ID) return next();
    res.status(403).json({ success: false, message: "관리자 권한이 필요합니다." });
}

// --- DB 초기화 ---
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, pw TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS memos (userId TEXT, schoolName TEXT, content TEXT, PRIMARY KEY(userId, schoolName))");
    db.run("CREATE TABLE IF NOT EXISTS reset_requests (id TEXT PRIMARY KEY, requestDate DATETIME DEFAULT CURRENT_TIMESTAMP)");
    db.run("INSERT OR IGNORE INTO users (id, pw) VALUES (?, ?)", [ADMIN_ID, ADMIN_PW]);
});

const loginAttempts = {};

// --- 인증 API ---

app.post('/api/login', (req, res) => {
    const { id, pw } = req.body;
    db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
        if (row && row.pw === pw) {
            delete loginAttempts[id];
            req.session.userId = id;
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
    res.json(req.session.userId ? { isLoggedIn: true, userId: req.session.userId } : { isLoggedIn: false });
});

app.post('/api/register', (req, res) => {
    const { id, pw } = req.body;
    if (!id || !pw) return res.status(400).json({ success: false, message: "정보를 모두 입력하세요." });

    db.run("INSERT INTO users (id, pw) VALUES (?, ?)", [id, pw], (err) => {
        if (err) return res.status(409).json({ success: false, message: "이미 존재하는 아이디입니다." });
        res.json({ success: true, message: "회원가입 완료" });
    });
});

app.post('/api/change-pw', isLoggedIn, (req, res) => {
    const { newPw } = req.body;
    db.run("UPDATE users SET pw = ? WHERE id = ?", [newPw, req.session.userId], (err) => {
        res.json({ success: !err, message: err ? "변경 실패" : "비밀번호가 변경되었습니다." });
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

// --- 비밀번호 찾기 및 요청 ---

app.post('/api/find-pw', (req, res) => {
    const { id } = req.body;
    db.get("SELECT pw FROM users WHERE id = ?", [id], (err, row) => {
        if (row) res.json({ success: true, pw: row.pw });
        else res.status(404).json({ success: false, message: "존재하지 않는 아이디" });
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
    db.all("SELECT id FROM users WHERE id != ?", [ADMIN_ID], (err, rows) => {
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

app.post('/api/admin/approve-reset', isAdmin, (req, res) => {
    const { id, tempPw } = req.body;
    db.serialize(() => {
        db.run("UPDATE users SET pw = ? WHERE id = ?", [tempPw, id]);
        db.run("DELETE FROM reset_requests WHERE id = ?", [id], () => {
            res.json({ success: true, message: "초기화 성공" });
        });
    });
});

// --- 서버 실행 ---
app.listen(PORT, () => {
    console.log(`
    =========================================
    서버가 정상적으로 시작되었습니다.
    주소: http://localhost:${PORT}
    관리자 ID: ${ADMIN_ID}
    =========================================
    `);
});
