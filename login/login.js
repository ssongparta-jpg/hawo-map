const LoginApp = {
    isIdChecked: false,
    adminIdTemp: null,
    
    // [추가] 일반 로그인 실패 횟수 및 캡챠 정답 기록
    userLoginFails: 0,
    userCaptchaAnswer: null,

    // --- 탭 및 화면 전환 로직 ---
    switchTab(tabName) {
        this.isIdChecked = false; 
        
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.form-area').forEach(area => {
            area.classList.remove('active');
            area.style.display = 'none';
        });

        if (tabName === 'user') {
            document.querySelectorAll('.tab-btn')[0].classList.add('active');
            document.getElementById('user-login-area').style.display = 'block';
            setTimeout(() => document.getElementById('user-login-area').classList.add('active'), 10);
        } else {
            document.querySelectorAll('.tab-btn')[1].classList.add('active');
            document.getElementById('admin-step1-area').style.display = 'block';
            setTimeout(() => document.getElementById('admin-step1-area').classList.add('active'), 10);
            
            if (window.grecaptcha) grecaptcha.reset();
        }
    },

    showRegisterForm() {
        document.querySelectorAll('.form-area').forEach(area => {
            area.classList.remove('active');
            area.style.display = 'none';
        });
        document.getElementById('user-register-area').style.display = 'block';
        setTimeout(() => document.getElementById('user-register-area').classList.add('active'), 10);
    },

    // [추가] 일반 유저용 자체 캔버스 캡챠 생성기
    generateUserCaptcha() {
        const canvas = document.getElementById('user-captcha-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        // 1. 헷갈리는 글자 제외하고 6자리 생성
        const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        let captchaStr = '';
        for (let i = 0; i < 6; i++) {
            captchaStr += chars[Math.floor(Math.random() * chars.length)];
        }
        this.userCaptchaAnswer = captchaStr;

        // 2. 탁한 배경색 채우기
        ctx.fillStyle = `rgb(${200 + Math.random()*40}, ${200 + Math.random()*40}, ${200 + Math.random()*40})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 3. [추가] 배경에 촘촘한 격자(Grid) 무늬를 넣어서 봇의 형태 인식을 방해
        ctx.lineWidth = 1;
        for (let i = 0; i < canvas.width; i += 12) {
            ctx.strokeStyle = `rgba(0, 0, 0, 0.1) !important`;
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        }
        for (let i = 0; i < canvas.height; i += 12) {
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
        }

        // 4. 구불구불한 굵은 베지어 곡선 (배경 노이즈)
        for(let i = 0; i < 7; i++) {
            ctx.strokeStyle = `rgba(${Math.random()*100}, ${Math.random()*100}, ${Math.random()*100}, 0.4)`;
            ctx.lineWidth = Math.random() * 5 + 2;
            ctx.beginPath();
            ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.bezierCurveTo(
                Math.random() * canvas.width, Math.random() * canvas.height,
                Math.random() * canvas.width, Math.random() * canvas.height,
                Math.random() * canvas.width, Math.random() * canvas.height
            );
            ctx.stroke();
        }

        // 5. 글자 렌더링 (그림자, 회전, 크기 왜곡, 테두리 효과 혼합)
        ctx.textBaseline = 'middle';
        const fonts = ['Arial', 'Verdana', 'Georgia', 'Courier New', 'Impact', 'Comic Sans MS'];
        
        for (let i = 0; i < captchaStr.length; i++) {
            const x = 25 + i * 25; // 간격을 확 좁혀서 글자끼리 겹치게 만듦
            const y = canvas.height / 2 + (Math.random() * 20 - 10); // 위아래로 심하게 요동침
            const angle = (Math.random() * 1.2 - 0.6); // 회전 각도 극대화
            const scaleX = 0.7 + Math.random() * 0.6; 
            const scaleY = 0.7 + Math.random() * 0.6; 
            
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.scale(scaleX, scaleY);
            
            ctx.font = `bold ${Math.floor(Math.random() * 12 + 28)}px ${fonts[Math.floor(Math.random() * fonts.length)]}`; 
            
            // [추가] 글자에 그림자를 넣어서 OCR 봇이 경계선을 찾기 힘들게 만듦
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

            ctx.fillStyle = `rgb(${Math.random()*80}, ${Math.random()*80}, ${Math.random()*80})`; // 어두운 색
            ctx.fillText(captchaStr[i], 0, 0);

            // [추가] 50% 확률로 글자 속을 파내고 하얀색 테두리만 그려서 교란
            if (Math.random() > 0.5) {
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.strokeText(captchaStr[i], 0, 0);
            }
            ctx.restore();
        }

        // 6. [추가] 글자 위를 가로지르는 '하얀색 칼선' 추가 (글자를 토막 내서 봇이 못 읽게 함)
        for(let i = 0; i < 5; i++) {
            ctx.strokeStyle = `rgba(255, 255, 255, 0.9)`;
            ctx.lineWidth = Math.random() * 3 + 1;
            ctx.beginPath();
            ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.stroke();
        }

        // 7. 자글자글한 점 노이즈 (전경)
        for(let i = 0; i < 120; i++) {
            ctx.fillStyle = `rgba(${Math.random()*255}, ${Math.random()*255}, ${Math.random()*255}, 0.7)`;
            ctx.beginPath();
            ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        document.getElementById('user-captcha-input').value = '';
    },

    // --- 일반 유저 기능 (로그인 방어 강화) ---
    async userLogin() {
        const id = document.getElementById('user-id').value.trim();
        const pw = document.getElementById('user-pw').value.trim();
        
        if (!id || !pw) return Swal.fire({ icon: 'warning', title: '입력 오류', text: '아이디와 비밀번호를 모두 입력해주세요.' });

        // [추가] 1번 이상 실패했다면 캡챠 확인 필수
        if (this.userLoginFails > 0) {
            const captchaInput = document.getElementById('user-captcha-input').value.trim().toUpperCase();
            if (!captchaInput) return Swal.fire({ icon: 'warning', text: '봇 방지용 그림 문자를 입력해주세요.' });
            
            if (captchaInput !== this.userCaptchaAnswer.toUpperCase()) {
                Swal.fire({ icon: 'error', title: '캡챠 오류', text: '그림의 문자와 일치하지 않습니다.' });
                this.generateUserCaptcha(); // 틀리면 새 그림 출제
                document.getElementById('user-captcha-input').focus();
                return;
            }
        }

        try {
            const res = await fetch('/api/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, pw })
            });
            const data = await res.json();
            
            if (data.success) {
                location.href = '/'; 
            } else {
                // [추가] 로그인 실패 시 카운터 증가 및 캡챠 창 표시
                this.userLoginFails++;
                document.getElementById('user-pw').value = ''; // 비밀번호 비워주기
                
                Swal.fire({ icon: 'error', title: '로그인 실패', text: data.message }).then(() => {
                    if (this.userLoginFails > 0) {
                        document.getElementById('user-captcha-container').style.display = 'block';
                        this.generateUserCaptcha();
                        document.getElementById('user-pw').focus();
                    }
                });
            }
        } catch (e) {
            Swal.fire({ icon: 'error', title: '오류', text: '서버와 통신할 수 없습니다.' });
        }
    },

    // 아이디 중복 검사
    async checkId() {
        const id = document.getElementById('reg-id').value.trim();
        if (!id) return Swal.fire({ icon: 'warning', text: '검사할 아이디를 입력하세요.' });

        try {
            const res = await fetch('/api/find-pw', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({id})
            });
            const data = await res.json();
            
            if (data.success) {
                Swal.fire({ icon: 'error', title: '사용 불가', text: '이미 존재하는 아이디입니다.' });
                this.isIdChecked = false;
            } else {
                Swal.fire({ icon: 'success', title: '사용 가능', text: '사용 가능한 아이디입니다.' });
                this.isIdChecked = true;
            }
        } catch(e) {
            Swal.fire({ icon: 'error', title: '오류', text: '서버와 통신할 수 없습니다.' });
        }
    },

    // 회원 가입
    async userRegister() {
        const id = document.getElementById('reg-id').value.trim();
        const pw = document.getElementById('reg-pw').value.trim();
        const pwConfirm = document.getElementById('reg-pw-confirm').value.trim();

        if (!this.isIdChecked) return Swal.fire({ icon: 'warning', text: '아이디 중복 확인을 먼저 진행해주세요.' });
        if (!pw) return Swal.fire({ icon: 'warning', text: '비밀번호를 입력해주세요.' });
        if (pw !== pwConfirm) return Swal.fire({ icon: 'error', text: '두 비밀번호가 일치하지 않습니다.' });
        if (pw.length < 4) return Swal.fire({ icon: 'warning', text: '비밀번호는 보안을 위해 4자 이상 입력해주세요.' });

        try {
            const res = await fetch('/api/register', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id, pw })
            });
            const data = await res.json();
            
            if (data.success) {
                Swal.fire({ icon: 'success', title: '가입 완료!', text: '로그인 페이지로 이동합니다.' })
                .then(() => location.reload());
            } else {
                Swal.fire({ icon: 'error', title: '가입 실패', text: data.message });
            }
        } catch(e) { 
            Swal.fire({ icon: 'error', title: '서버 오류', text: '가입 중 오류가 발생했습니다.' }); 
        }
    },

    // 관리자 비밀번호 초기화 요청
    requestAdminReset() {
        const id = document.getElementById('user-id').value.trim();
        if(!id) return Swal.fire({ icon: 'info', text: '비밀번호를 초기화할 아이디를 위 칸에 입력한 뒤 눌러주세요.' });

        Swal.fire({
            title: '관리자 비밀번호 초기화 요청',
            html: "기획경영과 담당 관리자가 확인 후 승인 시<br>비밀번호가 <b>1234</b>로 초기화됩니다.<br><br>요청하시겠습니까?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#2563eb',
            cancelButtonColor: '#e74c3c',
            confirmButtonText: '요청하기',
            cancelButtonText: '취소'
        }).then((result) => {
            if (result.isConfirmed) {
                fetch('/api/request-reset-pw', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({id})
                }).then(() => Swal.fire({ icon: 'success', title: '요청 완료', text: '담당자 확인을 기다려주세요.' }));
            }
        });
    },

    // --- 관리자 인증 흐름 ---
    async requestAdminEmail() {
        const adminId = document.getElementById('admin-id').value.trim();
        if (!adminId) return Swal.fire({ icon: 'warning', text: '관리자 ID를 입력해주세요.' });

        Swal.fire({ title: '메일 발송 중...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            const res = await fetch('/api/admin/send-code', { 
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: adminId }) 
            });
            const data = await res.json();
            
            if (data.success) {
                this.adminIdTemp = adminId;
                Swal.close();
                
                document.getElementById('admin-step1-area').style.display = 'none';
                document.getElementById('admin-step1-area').classList.remove('active');
                
                const step2 = document.getElementById('admin-step2-area');
                step2.style.display = 'block';
                setTimeout(() => step2.classList.add('active'), 10);
                
                document.getElementById('admin-msg').innerText = data.message;
                if (window.grecaptcha) grecaptcha.reset();
                document.getElementById('admin-otp').focus();
            } else {
                Swal.fire({ icon: 'error', title: '발송 실패', text: data.message });
            }
        } catch (e) {
            Swal.fire({ icon: 'error', title: '서버 오류', text: '서버 통신 오류가 발생했습니다.' });
        }
    },

    async verifyAdminCode() {
        const code = document.getElementById('admin-otp').value.trim();
        const recaptchaToken = window.grecaptcha ? grecaptcha.getResponse() : '';

        if (!code) return Swal.fire({ icon: 'warning', text: '인증 코드를 입력해주세요.' });
        if (!recaptchaToken) return Swal.fire({ icon: 'warning', text: '"로봇이 아닙니다" 체크박스를 클릭해주세요.' });

        Swal.fire({ title: '인증 확인 중...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            const res = await fetch('/api/admin/verify-code', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, recaptchaToken })
            });
            const data = await res.json();
            
            if (data.success) {
                Swal.fire({ icon: 'success', title: '인증 성공', text: '관리자 권한으로 접속합니다.', showConfirmButton: false, timer: 1500 })
                .then(() => {
                    // [수정] 관리자 URL 깔끔하게 변경
                    location.href = '/admin';
                });
            } else {
                Swal.fire({ icon: 'error', title: '인증 실패', text: data.message });
                if (window.grecaptcha) grecaptcha.reset();
            }
        } catch (e) {
            Swal.fire({ icon: 'error', title: '서버 오류', text: '인증 처리 중 오류가 발생했습니다.' });
            if (window.grecaptcha) grecaptcha.reset();
        }
    }
};