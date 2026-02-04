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
                // 파일이 없을 경우 빈 배열 반환 (커밋 버전 로직 반영)
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify([])); 
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        });
    }

    // 3. 로그인 로직 (통신 실패 해결을 위한 하이브리드 파싱 적용)
    else if (method === 'POST' && url === '/login') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            let credentials;
            const contentType = req.headers['content-type'];

            try {
                // 클라이언트 전송 방식(JSON vs Form)에 모두 대응하여 통신 실패 방지
                if (contentType && contentType.includes('application/json')) {
                    credentials = JSON.parse(body);
                } else {
                    credentials = querystring.parse(body);
                }

                // 커밋 버전의 인증 정보 유지 (spring / 1234)
                if (credentials.username === 'spring' && credentials.password === '1234') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, user: 'admin' }));
                } else {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: '인증 실패' }));
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: '데이터 형식이 올바르지 않습니다.' }));
            }
        });
    }

    // 4. 데이터 저장 API (POST /api/save)
    else if (method === 'POST' && url === '/api/save') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            // 커밋 버전처럼 원본 데이터를 그대로 파일에 기록
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

    // 5. 정적 파일 및 이미지 처리 (헤더 로고 해결 및 쿼리스트링 대응)
    else {
        // URL에서 쿼리스트링(?v=...) 제거하여 순수 파일 경로 추출
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

// 6. 서버 실행 및 포트 충돌 방지
server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`[경고] ${PORT}번 포트가 이미 사용 중입니다. 기존 프로세스를 종료하세요.`);
    }
});

server.listen(PORT, HOST, () => {
    console.log(`
    =========================================
    서버가 활성화되었습니다. (Port: ${PORT})
    기존 커밋 기능 복구 및 통신 최적화 완료
    =========================================
    `);
});

process.on('uncaughtException', (err) => { console.error('예외 발생:', err); });
