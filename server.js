const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

// 1. 설정 변수 (에러 수정을 위한 0.0.0.0 설정 유지)
const PORT = 3000;
const HOST = '0.0.0.0'; 
const DATA_FILE = path.join(__dirname, 'data.json');

const server = http.createServer((req, res) => {
    const { method, url } = req;

    // CORS 허용 (혹시 모를 브라우저 차단 방지)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ================= [ API 라우트 ] =================

    // 1. 기본 페이지 로드 (GET /)
    if (method === 'GET' && url === '/') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                return res.end('index.html 읽기 실패');
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data);
        });
    }
    
    // 2. 학교 데이터 API (GET /api/schools)
    else if (method === 'GET' && url === '/api/schools') {
        fs.readFile(DATA_FILE, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify([])); 
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        });
    }

    // 3. 로그인 로직 (POST /login & /api/login)
    // -> 복잡한 쿠키/세션 제거하고 기존의 단순 아이디 비번 확인 로직으로 롤백
    // -> 단, "서버 연결 실패" 방지를 위해 JSON/Form 하이브리드 파싱은 유지
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

                // 기존 커밋의 단순 로직 (spring / 1234)
                if (credentials.username === 'spring' && credentials.password === '1234') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, user: 'admin' }));
                } else {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: '인증 실패' }));
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: '잘못된 요청' }));
            }
        });
    }

    // 4. 회원가입 API (POST /api/register)
    // -> 관리자 권한 체크 제거 (롤백). 단순 성공 응답 처리로 에러 방지.
    else if (method === 'POST' && (url === '/api/register' || url === '/register')) {
        // 실제 DB가 없으므로 성공 메시지만 반환 (프론트엔드 에러 방지용)
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: '회원가입 요청이 처리되었습니다.' }));
    }

    // 5. 인증 확인 (GET /api/check-auth)
    // -> 프론트엔드 404 에러 방지용. 쿠키 검사 없이 단순 응답.
    else if (method === 'GET' && url === '/api/check-auth') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        // 세션 로직을 뺐으므로 기본적으로 false를 주거나, 
        // 프론트엔드가 로그인 직후라면 true로 처리하도록 유도
        res.end(JSON.stringify({ authenticated: false })); 
    }

    // 6. 데이터 저장 API (POST /api/save)
    // -> 관리자 권한 강제 로직 제거 (롤백). 요청 오면 바로 저장.
    else if (method === 'POST' && url === '/api/save') {
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

    // 7. 정적 파일 처리 (CSS 충돌 방지 핵심)
    // -> 경로 처리 로직을 단순화하여 충돌 해결
    else {
        const cleanUrl = url.split('?')[0];
        // 루트가 아닌 경우에만 파일 탐색
        if (cleanUrl === '/') return; 

        const filePath = path.join(__dirname, cleanUrl);
        
        fs.readFile(filePath, (err, data) => {
            if (err) {
                // 파일이 없으면 404
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
                return;
            }

            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.html': 'text/html; charset=utf-8',
                '.css': 'text/css',
                '.js': 'application/javascript',
                '.json': 'application/json',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.svg': 'image/svg+xml'
            };

            // 정확한 MIME 타입 제공 (CSS가 text/plain으로 읽히는 문제 방지)
            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
            res.end(data);
        });
    }
});

// 포트 충돌 방지 로그
server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`[오류] ${PORT}번 포트가 이미 사용 중입니다. 프로세스를 종료해주세요.`);
    }
});

server.listen(PORT, HOST, () => {
    console.log(`서버 실행 중: http://${HOST}:${PORT} (롤백 및 에러 수정 완료)`);
});
