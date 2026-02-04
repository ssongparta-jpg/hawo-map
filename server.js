const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

// 설정 변수
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

    // 3. [추가] 인증 확인 API (GET /api/check-auth) - 스크린샷 404 에러 해결
    else if (method === 'GET' && url === '/api/check-auth') {
        // 현재는 간단하게 세션 없이 항상 실패 혹은 성공 구조로 응답 처리 가능
        // 프론트엔드 초기화 시 에러 방지를 위해 기본 응답 제공
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ authenticated: false }));
    }

    // 4. 로그인 로직 (POST /login) - JSON/Form 하이브리드 대응
    else if (method === 'POST' && url === '/login') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            let credentials;
            const contentType = req.headers['content-type'];

            try {
                if (contentType && contentType.includes('application/json')) {
                    credentials = JSON.parse(body);
                } else {
                    credentials = querystring.parse(body);
                }

                // 기존 계정: spring / 1234
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

    // 5. 데이터 저장 API (POST /api/save)
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

    // 6. 정적 파일 처리 (로고 포함)
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

// 서버 실행 및 포트 중복 방지
server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') console.error(`${PORT} 포트가 이미 사용 중입니다.`);
});

server.listen(PORT, HOST, () => {
    console.log(`서버 실행 중: http://${HOST}:${PORT}`);
});
