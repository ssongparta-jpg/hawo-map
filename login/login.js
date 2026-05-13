const LoginApp = {
    adminIdTemp: null,

    // 탭 전환 기능
    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.form-area').forEach(area => {
            area.classList.remove('active');
            area.style.display = 'none';
        });

        if (tabName === 'user') {
            document.querySelectorAll('.tab-btn')[0].classList.add('active');
            document.getElementById('user-form-area').style.display = 'block';
            setTimeout(() => document.getElementById('user-form-area').classList.add('active'), 10);
        } else {
            document.querySelectorAll('.tab-btn')[1].classList.add('active');
            document.getElementById('admin-step1-area').style.display = 'block';
            setTimeout(() => document.getElementById('admin-step1-area').classList.add('active'), 10);
            document.getElementById('admin-step2-area').style.display = 'none';
            if (window.grecaptcha) grecaptcha.reset();
        }
    },

    // --- 일반 유저 로그인 & 회원가입 ---
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
                location.href = '/'; // 로그인 성공 시 메인 지도로 이동
            } else {
                Swal.fire({ icon: 'error', title: '로그인 실패', text: data.message });
            }
        } catch (e) {
            Swal.fire({ icon: 'error', title: '오류', text: '서버와 통신할 수 없습니다.' });
        }
    },

    async userRegister() {
        const id = document.getElementById('user-id').value.trim();
        const pw = document.getElementById('user-pw').value.trim();
        
        if (!id || !pw) return Swal.fire({ icon: 'info', title: '안내', text: '위의 빈칸에 원하는 아이디와 비밀번호를 적은 뒤 회원가입을 눌러주세요.' });

        try {
            const res = await fetch('/api/register', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, pw })
            });
            const data = await res.json();
            if (data.success) {
                Swal.fire({ icon: 'success', title: '가입 완료!', text: '이제 로그인 버튼을 눌러 접속해주세요.' });
            } else {
                Swal.fire({ icon: 'error', title: '가입 실패', text: data.message });
            }
        } catch (e) {
            Swal.fire({ icon: 'error', title: '오류', text: '서버 오류가 발생했습니다.' });
        }
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
                    location.href = '/admin.html'; // 관리자는 성공 시 어드민 페이지로 바로 이동
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