const LoginApp = {
    isIdChecked: false,
    adminIdTemp: null,

    // --- 탭 및 화면 전환 로직 ---
    switchTab(tabName) {
        this.isIdChecked = false; // 탭 이동 시 회원가입 중복검사 상태 초기화
        
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

    // --- 일반 유저 기능 ---
    async userLogin() {
        const id = document.getElementById('user-id').value.trim();
        const pw = document.getElementById('user-pw').value.trim();
        
        if (!id || !pw) return Swal.fire({ icon: 'warning', title: '입력 오류', text: '아이디와 비밀번호를 모두 입력해주세요.' });

        try {
            const res = await fetch('/api/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, pw })
            });
            const data = await res.json();
            
            if (data.success) {
                location.href = '/'; 
            } else {
                Swal.fire({ icon: 'error', title: '로그인 실패', text: data.message });
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
            
            // 비밀번호 찾기 API에서 성공(true)이 떨어지면 계정이 존재한다는 의미
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
                    location.href = '/admin.html';
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