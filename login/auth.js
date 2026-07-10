const AuthManager = {
    userId: null,
    isAdmin: false,
    eventsBound: false,

    bindEvents() {
        if (this.eventsBound) return;
        this.eventsBound = true;
        document.addEventListener('click', (event) => {
            const target = event.target.closest('[data-auth-action]');
            if (!target) return;
            const action = target.dataset.authAction;
            if (action === 'pw-change') location.href = '/pw_change';
            if (action === 'open-admin') window.open('/admin', '_blank');
            if (action === 'logout') this.logout();
            if (action === 'go-login') location.href = '/login';
        });
    },

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    },

    async checkAuth() {
        this.bindEvents();
        try {
            const res = await fetch('/api/check-auth');
            const data = await res.json();
            
            const statusArea = document.getElementById('header-user-status');
            if (!statusArea) return;

            // auth.js (수정된 checkAuth 부분)
            if (data.isLoggedIn) {
                this.userId = data.userId;
                this.isAdmin = data.isAdmin;
                
                // UI 클래스(.user-greeting, .user-btn-wrapper)를 사용하도록 수정
                let html = `<span class="user-greeting">${this.escapeHtml(this.userId)}님</span>`;
                html += `<div class="user-btn-wrapper">`;
                html += `<button class="btn-pw-change" data-auth-action="pw-change">PW변경</button>`;
                
                if (this.isAdmin) {
                    html += `<button class="btn-admin" data-auth-action="open-admin">⚙️ 관리자</button>`;
                }
                
                html += `<button class="btn-logout" data-auth-action="logout">로그아웃</button>`;
                html += `</div>`;
                
                statusArea.innerHTML = html;
            } else {
                this.userId = null;
                this.isAdmin = false;
                statusArea.innerHTML = `<button class="btn-login" data-auth-action="go-login">로그인 / 가입</button>`;
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
        const memoSection = event.currentTarget?.closest('.memo-section');
        const textarea = memoSection?.querySelector('.memo-textarea');
        const content = textarea ? textarea.value : '';
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
        const memoSection = event.currentTarget?.closest('.memo-section');
        const textarea = memoSection?.querySelector('.memo-textarea');
        if (textarea) textarea.value = '';
        alert('메모가 삭제되었습니다.');
    }
};
