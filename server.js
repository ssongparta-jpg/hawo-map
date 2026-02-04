const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

// 1. 설정 변수
const PORT = 3000;
const HOST = '0.0.0.0'; 
const DATA_FILE = path.join(__dirname, 'data.json');
const SESSION_KEY = 'admin_session=active'; // 간단한 세션 키

// 2. 쿠키 파싱 헬퍼 함수
const parseCookies = (request) => {
    const list = {};
    const rc = request.headers.cookie;
    rc && rc.split(';').forEach((cookie) => {
        const parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
    return list;
};

const server = http.createServer((req, res) => {
    const { method, url } = req;
    const cookies = parseCookies(req);
    const isAdmin = cookies.admin_session === 'active'; // 관리자 여부 확인

    // 3. CORS 헤더 설정 (혹시 모를 브라우저 차단 방지)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ================= [ API 라우트 ] =================

    // A. 인증 확인 (GET /api/check-auth)
    // -> 이 부분이 복구되어야 "관리자 전용 버튼"이 나타납니다.
    if (method === 'GET' && url === '/api/check-auth') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            authenticated: isAdmin, 
            user: isAdmin ? { username: 'spring', role: 'admin' } : null 
        }));
    }

    // B. 로그인 (POST /api/login)
    else if (method === 'POST' && (url === '/api/login' || url === '/login')) {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            let credentials = {};
            try {
                const contentType = req.headers['content-type'] || '';
                if (contentType.includes('application/json')) {
                    credentials = JSON.parse(body);
                } else {
                    credentials = querystring.parse(body);
                }
            } catch (e) {
                console.error('로그인 파싱 에러:', e);
            }

            // 계정 확인 (기존: spring / 1234)
            if (credentials.username === 'spring' && credentials.password === '1234') {
                // 쿠키 설정 (세션 유지)
                res.writeHead(200, { 
                    'Content-Type': 'application/json',
                    'Set-Cookie': `${SESSION_KEY}; HttpOnly; Path=/; Max-Age=3600`
                });
                res.end(JSON.stringify({ success: true, user: 'spring' }));
            } else {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: '아이디 또는 비밀번호가 잘못되었습니다.' }));
            }
        });
    }

    // C. 로그아웃 (POST /api/logout)
    else if (method === 'POST' && (url === '/api/logout' || url === '/logout')) {
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Set-Cookie': 'admin_session=; HttpOnly; Path=/; Max-Age=0' // 쿠키 삭제
        });
        res.end(JSON.stringify({ success: true }));
    }

    // D. 학교 데이터 조회 (GET /api/schools)
    else if (method === 'GET' && url === '/api/schools') {
        fs.readFile(DATA_FILE, 'utf8', (err, data) => {
            if (err) {
                // 파일이 없으면 빈 배열 생성
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify([]));
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data);
            }
        });
    }

    // E. 학교 데이터 저장 (POST /api/save)
    else if (method === 'POST' && url === '/api/save') {
        if (!isAdmin) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, message: '관리자 권한이 필요합니다.' }));
        }

        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            fs.writeFile(DATA_FILE, body, (err) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: '저장 실패' }));
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                }
            });
        });
    }

    // F. 회원가입 방어 (POST /api/register) - 에러 방지용
    else if (method === 'POST' && (url === '/api/register' || url === '/register')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: '관리자 전용 시스템입니다.' }));
    }

    // ================= [ 정적 파일 처리 ] =================
    
    // G. 메인 페이지 및 기타 파일
    else {
        // URL 쿼리 제거 (?v=123 등)
        const cleanUrl = url.split('?')[0];
        
        // 루트 경로 처리
        let filePath = cleanUrl === '/' 
            ? path.join(__dirname, 'index.html') 
            : path.join(__dirname, cleanUrl);

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
                return;
            }

            // MIME 타입 설정
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.html': 'text/html; charset=utf-8',
                '.css': 'text/css',
                '.js': 'application/javascript',
                '.json': 'application/json',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.svg': 'image/svg+xml',
                '.ico': 'image/x-icon'
            };

            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
            res.end(data);
        });
    }
});

// 4. 서버 에러 처리 (포트 충돌 방지)
server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`[Fatal Error] Port ${PORT} is already in use.`);
    } else {
        console.error('[Server Error]', e);
    }
});

// 5. 서버 실행
server.listen(PORT, HOST, () => {
    console.log(`
    ================================================
      Hawo-Map Server Started
      URL: http://${HOST}:${PORT}
      Admin: spring / 1234
    ================================================
    `);
});
