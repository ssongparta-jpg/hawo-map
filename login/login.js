const LoginApp = {
    isIdChecked: false,
    adminIdTemp: null,
    userCaptchaAnswer: null,
    
    // 이스터에그: 아이디 창 단시간 5번 클릭 시 관리자 탭 오픈
    idClickCount: 0,
    idClickTimer: null,

    handleIdClick() {
        this.idClickCount++;
        clearTimeout(this.idClickTimer);
        
        // 1초 안에 다음 클릭이 없으면 초기화
        this.idClickTimer = setTimeout(() => {
            this.idClickCount = 0;
        }, 1000);

        if (this.idClickCount >= 5) {
            const adminTab = document.getElementById('admin-tab-btn');
            if (adminTab && adminTab.style.display === 'none') {
                adminTab.style.display = 'block';
                Swal.fire({ icon: 'info', title: '관리자 모드', text: '관리자 인증 메뉴가 활성화되었습니다.', timer: 1500, showConfirmButton: false });
            }
            this.idClickCount = 0; // 활성화 후 초기화
        }
    },

    getUserLoginFails() {
        return parseInt(localStorage.getItem('hwaoLoginFails') || '0', 10);
    },
    incrementUserLoginFails() {
        const current = this.getUserLoginFails();
        localStorage.setItem('hwaoLoginFails', current + 1);
    },
    clearUserLoginFails() {
        localStorage.removeItem('hwaoLoginFails');
    },

    init() {
        // [수정] 5회 이상 실패 기록이 있을 때만 캡챠 띄우기
        if (this.getUserLoginFails() >= 5) {
            const captchaContainer = document.getElementById('user-captcha-container');
            if (captchaContainer) {
                captchaContainer.style.display = 'block';
                this.generateUserCaptcha();
            }
        }
    },

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
            const adminTab = document.getElementById('admin-tab-btn');
            if (adminTab) adminTab.classList.add('active');
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

    // [수정] 캡챠 순한맛 버전 (가독성 향상)
    generateUserCaptcha() {
        const canvas = document.getElementById('user-captcha-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        let captchaStr = '';
        for (let i = 0; i < 6; i++) {
            captchaStr += chars[Math.floor(Math.random() * chars.length)];
        }
        this.userCaptchaAnswer = captchaStr;

        ctx.fillStyle = `rgb(${220 + Math.random()*20}, ${220 + Math.random()*20}, ${220 + Math.random()*20})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 노이즈 선 대폭 감소 (7개 -> 3개), 굵기도 얇게
        for(let i = 0; i < 3; i++) {
            ctx.strokeStyle = `rgba(${Math.random()*100}, ${Math.random()*100}, ${Math.random()*100}, 0.2)`;
            ctx.lineWidth = Math.random() * 2 + 1;
            ctx.beginPath();
            ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.bezierCurveTo(
                Math.random() * canvas.width, Math.random() * canvas.height,
                Math.random() * canvas.width, Math.random() * canvas.height,
                Math.random() * canvas.width, Math.random() * canvas.height
            );
            ctx.stroke();
        }

        ctx.textBaseline = 'middle';
        const fonts = ['Arial', 'Verdana', 'Georgia', 'Courier New'];
        
        for (let i = 0; i < captchaStr.length; i++) {
            const x = 25 + i * 25; 
            const y = canvas.height / 2 + (Math.random() * 10 - 5); 
            const angle = (Math.random() * 0.4 - 0.2); // 회전 최소화
            const scaleX = 0.8 + Math.random() * 0.2; 
            const scaleY = 0.8 + Math.random() * 0.2; 
            
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.scale(scaleX, scaleY);
            
            ctx.font = `bold ${Math.floor(Math.random() * 6 + 28)}px ${fonts[Math.floor(Math.random() * fonts.length)]}`; 
            
            ctx.fillStyle = `rgb(${Math.random()*60}, ${Math.random()*60}, ${Math.random()*60})`; 
            ctx.fillText(captchaStr[i], 0, 0);

            ctx.restore();
        }

        // 점 노이즈 개수 감소
        for(let i = 0; i < 60; i++) {
            ctx.fillStyle = `rgba(${Math.random()*200}, ${Math.random()*200}, ${Math.random()*200}, 0.5)`;
            ctx.beginPath();
            ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        document.getElementById('user-captcha-input').value = '';
    },

    async userLogin() {
        const id = document.getElementById('user-id').value.trim();
        const pw = document.getElementById('user-pw').value.trim();
        
        if (!id || !pw) return Swal.fire({ icon: 'warning', title: '입력 오류', text: '아이디와 비밀번호를 모두 입력해주세요.' });

        // [수정] 실패 횟수가 5회 이상일 때만 캡챠 정답 검사
        if (this.getUserLoginFails() >= 5) {
            const captchaInput = document.getElementById('user-captcha-input').value.trim().toUpperCase();
            if (!captchaInput) return Swal.fire({ icon: 'warning', text: '봇 방지용 그림 문자를 입력해주세요.' });
            
            if (captchaInput !== this.userCaptchaAnswer.toUpperCase()) {
                Swal.fire({ icon: 'error', title: '캡챠 오류', text: '그림의 문자와 일치하지 않습니다.' });
                this.generateUserCaptcha();
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
                this.clearUserLoginFails();
                location.href = '/'; 
            } else {
                this.incrementUserLoginFails();
                document.getElementById('user-pw').value = ''; 
                
                // [수정] 누적 5회가 되면 캡챠 박스 오픈
                Swal.fire({ icon: 'error', title: '로그인 실패', text: data.message }).then(() => {
                    if (this.getUserLoginFails() >= 5) {
                        document.getElementById('user-captcha-container').style.display = 'block';
                        this.generateUserCaptcha();
                        document.getElementById('user-captcha-input').focus();
                    } else {
                        document.getElementById('user-pw').focus();
                    }
                });
            }
        } catch (e) {
            Swal.fire({ icon: 'error', title: '오류', text: '서버와 통신할 수 없습니다.' });
        }
    },

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

document.addEventListener('DOMContentLoaded', () => {
    LoginApp.init();
});