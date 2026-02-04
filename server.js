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

    // 1. 기본 페이지 (GET /)
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
                return res.end(JSON.stringify([])); // 파일 없으면 빈 배열
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        });
    }

    // 3. 데이터 저장 API (POST /api/save)
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

    // 4. 로그인 로직 (POST /login)
    else if (method === 'POST' && url === '/login') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const credentials = querystring.parse(body);
            if (credentials.username === 'spring' && credentials.password === '1234') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } else {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
            }
        });
    }

    // 5. 정적 파일 처리 (CSS, JS, 이미지 등)
    else {
        // 보안을 위해 URL에서 쿼리스트링 제거 후 경로 계산
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
                '.json': 'application/json'
            };
            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
            res.end(data);
        });
    }
});

// 6. 서버 실행 (EADDRINUSE 에러 방지를 위해 에러 헨들링 추가)
server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`서버 에러: ${PORT}번 포트가 이미 사용 중입니다. 기존 프로세스를 종료하세요.`);
    } else {
        console.error('서버 에러 발생:', e);
    }
});

server.listen(PORT, HOST, () => {
    console.log(`
    =========================================
    Hawo-Map 서버가 정상적으로 시작되었습니다.
    주소: http://[공인IP]:${PORT}
    관리자 ID: spring
    =========================================
    `);
});
