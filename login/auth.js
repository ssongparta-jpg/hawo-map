const AuthManager = {
    userId: null,
    isAdmin: false,

    async checkAuth() {
        try {
            const res = await fetch('/api/check-auth');
            const data = await res.json();
            
            const statusArea = document.getElementById('header-user-status');
            if (!statusArea) return;

            if (data.isLoggedIn) {
                this.userId = data.userId;
                this.isAdmin = data.isAdmin;
                
                // [버그 수정] 옛날 인라인 스타일 제거 -> ui.css의 앱 스타일 클래스로 완벽 동기화
                let html = `<span class="user-greeting">${this.userId}님</span>`;
                html += `<div class="user-btn-wrapper">`;
                
                // 요청하신 대로 글자 수를 줄여 가로 짤림 현상을 원천 방지합니다.
                html += `<button class="btn-pw-change" onclick="location.href='/pw_change'">PW변경</button>`;
                
                if (this.isAdmin) {
                    html += `<button class="btn-admin" onclick="window.open('/admin', '_blank')">⚙️ 관리자</button>`;
                }
                
                html += `<button class="btn-logout" onclick="AuthManager.logout()">로그아웃</button>`;
                html += `</div>`;
                
                statusArea.innerHTML = html;
            } else {
                this.userId = null;
                this.isAdmin = false;
                statusArea.innerHTML = `<button class="btn-login" onclick="location.href='/login'">로그인 / 가입</button>`;
            }
        } catch (e) {
            console.error("Auth Check Error");
        }
    },

    async logout() {
        await fetch('/api/logout', { method: 'POST' });
        location.reload();
    },

    async saveMemo(schoolName, event) {
        event.stopPropagation();
        if (!this.userId) return alert("로그인이 필요합니다.");
        const content = document.getElementById(`memo-${schoolName}`).value;
        await fetch('/api/memo', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schoolName, content })
        });
        alert('메모가 저장되었습니다.');
    },

    async deleteMemo(schoolName, event) {
        event.stopPropagation();
        if (!this.userId) return;
        await fetch('/api/memo', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schoolName })
        });
        document.getElementById(`memo-${schoolName}`).value = '';
        alert('메모가 삭제되었습니다.');
    }
};