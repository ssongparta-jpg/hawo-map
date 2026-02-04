const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

const PORT = 3000;
const HOST = '0.0.0.0'; 
const DATA_FILE = path.join(__dirname, 'data.json');

const server = http.createServer((req, res) => {
    const { method, url } = req;

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

    // 3. 인증 확인 API (GET /api/check-auth) - 스creen샷 404 해결
    else if (method === 'GET' && url === '/api/check-auth') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ authenticated: false }));
    }

    // 4. 로그인 로직 (POST /api/login) - 스크린샷 경로 반영
    else if (method === 'POST' && (url === '/api/login' || url === '/login')) {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            let credentials;
            try {
                const contentType = req.headers['content-type'];
                if (contentType && contentType.includes('application/json')) {
                    credentials = JSON.parse(body);
                } else {
                    credentials = querystring.parse(body);
                }

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

    // 5. 회원가입 API (POST /api/register) - 스크린샷 404 해결용 임시 응답
    else if (method === 'POST' && (url === '/api/register' || url === '/register')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: '회원가입 기능은 관리자 전용입니다.' }));
    }

    // 6. 데이터 저장 API (POST /api/save)
    else if (method === 'POST' && url === '/api/save') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            fs.writeFile(DATA_FILE, body, (err) => {
                if (err) {
                    res.writeHead(500);
                    return res.end('저장 실패');
                }
                res.writeHead(200);
                res.end('저장 성공');
            });
        });
    }

    // 7. 정적 파일 처리 (로고 포함)
    else {
        const cleanUrl = url.split('?')[0];
        const filePath = path.join(__dirname, cleanUrl);
        
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                return res.end('Not Found');
            }
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.css': 'text/css',
                '.js': 'application/javascript',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.svg': 'image/svg+xml',
                '.json': 'application/json'
            };
            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
            res.end(data);
        });
    }
});

server.listen(PORT, HOST, () => {
    console.log(`서버 실행 중: http://${HOST}:${PORT}`);
});
