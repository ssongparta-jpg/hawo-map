const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

// 설정 변수
const PORT = 3000;
const HOST = '0.0.0.0'; // 외부 접속 허용
const DATA_FILE = path.join(__dirname, 'data.json'); // 안정적인 경로 설정

const server = http.createServer((req, res) => {
    const { method, url } = req;

    // 1. 기본 페이지 로드 (GET /)
    if (method === 'GET' && url === '/') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                return res.end('index.html 파일을 읽을 수 없습니다.');
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data);
        });
    }
    
    // 2. 학교 데이터 가져오기 (GET /api/schools)
    else if (method === 'GET' && url === '/api/schools') {
        fs.readFile(DATA_FILE, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end('데이터를 읽을 수 없습니다.');
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        });
    }

    // 3. 데이터 저장 (POST /api/save) - 관리자용
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
            // 기존 관리자 ID: spring 로직 유지
            if (credentials.username === 'spring' && credentials.password === '1234') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } else {
                res.writeHead(401);
                res.end(JSON.stringify({ success: false }));
            }
        });
    }

    // 5. 정적 파일 처리 (CSS, JS 등)
    else {
        const filePath = path.join(__dirname, url);
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Not Found');
                return;
            }
            const ext = path.extname(filePath);
            const contentTypes = {
                '.css': 'text/css',
                '.js': 'application/javascript',
                '.png': 'image/png'
            };
            res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
            res.end(data);
        });
    }
});

// 6. 서버 실행 (무한 루프 해결의 핵심: Listen 위치와 HOST 설정)
server.listen(PORT, HOST, () => {
    console.log(`
    =========================================
    서버가 정상적으로 시작되었습니다.
    주소: http://[내 공인 IP]:${PORT}
    관리자 ID: spring
    =========================================
    `);
});

// 예기치 못한 종료 방지
process.on('uncaughtException', (err) => {
    console.error('서버 에러 발생:', err);
});
