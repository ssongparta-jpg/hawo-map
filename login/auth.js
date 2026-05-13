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
                
                // 로그인 상태일 때 헤더 모양
                let html = `<span style="font-size: 14px; font-weight: bold; margin-right: 12px; color: #333;">${this.userId}님</span>`;
                
                if (this.isAdmin) {
                    html += `<button onclick="window.open('/admin.html', '_blank')" style="background: #2ecc71; color: white; border: none; padding: 6px 12px; border-radius: 20px; font-weight: bold; font-size: 12px; margin-right: 8px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">⚙️ 관리자</button>`;
                }
                
                html += `<button onclick="AuthManager.logout()" style="background: #e74c3c; color: white; border: none; padding: 6px 12px; border-radius: 20px; font-weight: bold; font-size: 12px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">로그아웃</button>`;
                
                statusArea.innerHTML = html;
            } else {
                this.userId = null;
                this.isAdmin = false;
                // 비로그인 상태일 때 통합 버튼
                statusArea.innerHTML = `<button onclick="location.href='/login'" style="background: #2563eb; color: white; border: none; padding: 8px 18px; border-radius: 20px; font-weight: bold; font-size: 14px; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">로그인 / 가입</button>`;
            }
        } catch (e) {
            console.error("Auth Check Error");
        }
    },

    async logout() {
        await fetch('/api/logout', { method: 'POST' });
        location.reload();
    },

    // 메모 저장/삭제 로직
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