// =========================================
// js/auth.js : 사용자 로그인 및 관리자 인증 로직
// (관리자 대시보드 기능은 server/admin.js로 분리됨)
// =========================================

const AuthManager = {
    userId: null,
    
    init() {
        const idInput = document.getElementById('user-id');
        
        if (idInput) {
            let clickCount = 0;
            let clickTimer = null;

            // 관리자 로그인 트리거 (ID칸 5번 클릭)
            idInput.addEventListener('click', (e) => {
                clickCount++;
                
                // 시각적 피드백
                idInput.style.borderColor = 'red';
                idInput.style.backgroundColor = '#fff0f0';
                setTimeout(() => {
                    idInput.style.borderColor = '#ccc';
                    idInput.style.backgroundColor = 'white';
                }, 200);

                if (clickCount === 1) {
                    clearTimeout(clickTimer);
                    clickTimer = setTimeout(() => {
                        clickCount = 0;
                    }, 3000); 
                }

                if (clickCount >= 5) {
                    clearTimeout(clickTimer);
                    clickCount = 0;
                    setTimeout(() => {
                        AdminManager.openLoginModal(); 
                    }, 100);
                }
            });
        }
        
        this.checkAuth();
    },

    async checkAuth() {
        try {
            const res = await fetch('/api/check-auth');
            if (res.ok) {
                const data = await res.json();
                this.userId = data.isLoggedIn ? data.userId : null;
                this.toggleUI(data.isLoggedIn, data.isAdmin);
            }
        } catch (e) { this.userId = null; this.toggleUI(false); }
    },
    
    async login() {
        const id = document.getElementById('user-id').value;
        const pw = document.getElementById('user-pw').value;
        if(!id || !pw) return alert("ID와 비밀번호를 입력하세요.");

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, pw })
            });
            if (res.ok) {
                const data = await res.json();
                this.userId = data.userId || id;
                this.toggleUI(true);
            } else {
                const errorData = await res.json();
                if (errorData.attempts >= 1) this.showFailPopup(id);
                else alert(errorData.message);
            }
        } catch (e) { alert("서버 연결 실패"); }
    },
    
    showFailPopup(id) {
        const choice = confirm(`비밀번호가 일치하지 않습니다.\n\n확인(OK): 관리자에게 PW 초기화 요청\n취소(Cancel): 닫기`);
        if (choice) this.requestResetPw(id);
    },
    
    async requestResetPw(id) {
        try {
            const res = await fetch('/api/request-reset-pw', {
                method: 'POST', 
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({id})
            });
            if (res.ok) alert(`관리자에게 ${id}님의 초기화 요청이 전달되었습니다.`);
        } catch(e) { alert("요청 전송 실패"); }
    },
    
    async logout() {
        try { await fetch('/api/logout', { method: 'POST' }); } catch(e) {}
        this.userId = null;
        this.toggleUI(false);
        location.reload();
    },
    
    async register() {
        const id = document.getElementById('user-id').value;
        const pw = document.getElementById('user-pw').value;
        if (!id || !pw) return alert("아이디와 비밀번호를 입력해주세요.");
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, pw })
            });
            const data = await res.json();
            alert(data.message);
        } catch (e) { console.error(e); }
    },
    
    async changePw() {
        const newPw = prompt("새로운 비밀번호를 입력하세요.");
        if (!newPw) return;
        try {
            const res = await fetch('/api/change-pw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPw })
            });
            if (res.ok) alert("비밀번호 변경 완료!");
            else alert("변경에 실패했습니다.");
        } catch (e) {}
    },
    
    async saveMemo(schoolName, e) {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        const textArea = document.getElementById(`memo-${schoolName}`);
        if (!textArea) return;
        try {
            const res = await fetch('/api/memo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schoolName, content: textArea.value })
            });
            if (res.ok) alert('메모가 저장되었습니다.');
            else alert('저장에 실패했습니다.');
        } catch (err) { alert('서버 오류'); }
    },

    async deleteMemo(schoolName, e) {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        if (!confirm("메모를 삭제하시겠습니까?")) return;
        const textArea = document.getElementById(`memo-${schoolName}`);
        try {
            const res = await fetch('/api/memo', {
                method: 'DELETE', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schoolName })
            });
            if (res.ok) {
                alert('메모 삭제 완료');
                if (textArea) textArea.value = "";
            } else { alert('삭제 실패'); }
        } catch (err) { alert('서버 오류'); }
    },

    toggleUI(isLoggedIn, isAdmin = false) {
        const form = document.getElementById('login-form');
        const info = document.getElementById('user-info');
        if (form) form.style.display = isLoggedIn ? 'none' : 'flex';
        if (info) info.style.display = isLoggedIn ? 'flex' : 'none';
        
        const changePwBtn = document.getElementById('change-pw-btn');
        if (changePwBtn) changePwBtn.style.display = isLoggedIn ? 'inline-block' : 'none';
        
        if (isLoggedIn) {
            document.getElementById('welcome-msg').innerText = `${this.userId}님`;
            const adminBtn = document.getElementById('admin-panel-btn');
            if (adminBtn) adminBtn.style.display = isAdmin ? 'inline-block' : 'none';
        }
        
        const openPopupTextArea = document.querySelector('.leaflet-popup-content textarea');
        if (openPopupTextArea) {
            openPopupTextArea.disabled = !isLoggedIn;
            openPopupTextArea.placeholder = isLoggedIn ? "메모를 불러오는 중..." : "로그인 후 이용 가능합니다";
            if(isLoggedIn) {
                const schoolName = openPopupTextArea.id.replace('memo-', '');
                fetch(`/api/memo/${schoolName}`).then(res => res.json()).then(data => {
                    openPopupTextArea.value = data.content || "";
                    openPopupTextArea.placeholder = "여기에 메모를 작성하세요";
                });
            } else {
                openPopupTextArea.value = "";
            }
        }
        
        const memoBtns = document.querySelectorAll('button[id^="btn-save-"], button[id^="btn-del-"]');
        memoBtns.forEach(btn => {
            btn.disabled = !isLoggedIn;
            if (isLoggedIn) {
                if (btn.id.includes('btn-save-')) btn.style.backgroundColor = '#4A90E2';
                if (btn.id.includes('btn-del-')) btn.style.backgroundColor = '#e74c3c';
            } else {
                btn.style.backgroundColor = '#ccc';
            }
        });
    }
};

// 관리자 인증 로그인 & 화면 이동 매니저
const AdminManager = {
    selectedAdminId: null,

    openLoginModal() {
        const modal = document.getElementById('admin-login-modal');
        if (modal) {
            modal.style.display = 'flex';
            document.getElementById('admin-step-1').style.display = 'block';
            document.getElementById('admin-step-2').style.display = 'none';
            document.getElementById('admin-id-input').value = '';
            document.getElementById('admin-otp-input').value = '';
            this.selectedAdminId = null;
            if (window.grecaptcha) grecaptcha.reset(); // 모달 열 때 캡챠 초기화
        }
    },

    closeLoginModal() {
        const modal = document.getElementById('admin-login-modal');
        if (modal) modal.style.display = 'none';
    },

    // 1단계: ID 입력받아 메일 발송
    async requestEmail() {
        const adminId = document.getElementById('admin-id-input').value.trim();
        if (!adminId) {
            Swal.fire({ icon: 'warning', title: '입력 오류', text: '관리자 ID를 입력해주세요.', confirmButtonColor: '#3498db' });
            return;
        }

        Swal.fire({
            title: '메일 발송 중...',
            text: '잠시만 기다려주세요.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            const res = await fetch('/api/admin/send-code', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: adminId }) 
            });
            const data = await res.json();
            
            if (data.success) {
                this.selectedAdminId = adminId;
                
                Swal.fire({ 
                    icon: 'success', 
                    title: '발송 완료!', 
                    text: '인증 메일이 성공적으로 발송되었습니다.', 
                    confirmButtonColor: '#2ecc71',
                    allowOutsideClick: false 
                }).then(() => {
                    document.getElementById('admin-step-1').style.display = 'none';
                    document.getElementById('admin-step-2').style.display = 'block';
                    document.getElementById('admin-step-2-msg').innerText = data.message;
                    
                    if (window.grecaptcha) grecaptcha.reset(); // 2단계 진입 시 캡챠 초기화
                    document.getElementById('admin-otp-input').focus();
                });
            } else {
                Swal.fire({ icon: 'error', title: '발송 실패', text: data.message, confirmButtonColor: '#e74c3c' });
            }
        } catch (e) {
            Swal.fire({ icon: 'error', title: '서버 오류', text: '서버 통신 오류가 발생했습니다.', confirmButtonColor: '#e74c3c' });
        }
    },

    // 2단계: 코드 & 구글 리캡챠 검증 후 로그인
    async submitCode() {
        const code = document.getElementById('admin-otp-input').value.trim();
        
        // 구글 리캡챠가 체크되었는지 확인하고 토큰을 가져옵니다.
        const recaptchaToken = grecaptcha.getResponse();

        if(!code) {
            Swal.fire({ icon: 'warning', title: '확인 필요', text: '인증 코드를 입력해주세요.', confirmButtonColor: '#3498db' });
            return;
        }

        if (!recaptchaToken) {
            Swal.fire({ icon: 'error', title: '캡챠 오류', text: '"로봇이 아닙니다" 체크박스를 클릭해주세요.', confirmButtonColor: '#e74c3c' });
            return;
        }

        Swal.fire({
            title: '인증 확인 중...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            // 서버에 코드와 함께 구글 토큰도 보냅니다.
            const res = await fetch('/api/admin/verify-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, recaptchaToken })
            });
            const data = await res.json();
            
            if (data.success) {
                Swal.fire({ 
                    icon: 'success', 
                    title: '인증 성공!', 
                    text: `관리자(${data.userId})로 로그인되었습니다.`, 
                    confirmButtonColor: '#2ecc71',
                    allowOutsideClick: false
                }).then(() => {
                    this.closeLoginModal();
                    location.reload(); 
                });
            } else {
                Swal.fire({ icon: 'error', title: '인증 실패', text: data.message, confirmButtonColor: '#e74c3c' });
                grecaptcha.reset(); // 실패 시 캡챠 체크박스를 다시 풀어서 재시도 유도
            }
        } catch (e) {
            Swal.fire({ icon: 'error', title: '서버 오류', text: '인증 실패: 서버에 연결할 수 없습니다.', confirmButtonColor: '#e74c3c' });
            grecaptcha.reset();
        }
    },

    async open() {
        window.open('admin.html', '_blank');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AuthManager.init();
});