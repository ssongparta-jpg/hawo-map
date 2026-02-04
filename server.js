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

    // 3. 로그인 로직 수정 (POST /login) - 통신 실패 해결
    else if (method === 'POST' && url === '/login') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const credentials = querystring.parse(body);
            // 기존 spring / 1234 로직 유지
            if (credentials.username === 'spring' && credentials.password === '1234') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } else {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: '인증 실패' }));
            }
        });
    }

    // 4. 정적 파일 및 로고 이미지 처리 (헤더 로고 미출력 해결)
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

// EADDRINUSE 에러 방지 처리
server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`[오류] ${PORT}번 포트가 이미 사용 중입니다. 기존 프로세스를 종료하세요.`);
    }
});

server.listen(PORT, HOST, () => {
    console.log(`
    =========================================
    서버 주소: http://[공인IP]:${PORT}
    로고 이미지 및 로그인 통신 수정 완료
    =========================================
    `);
});

process.on('uncaughtException', (err) => { console.error('에러 발생:', err); });
