const AuthManager = {
    userId: null,
    
    async checkAuth() {
        try {
            const res = await fetch('/api/check-auth');
            if (res.ok) {
                const data = await res.json();
                this.userId = data.isLoggedIn ? data.userId : null;
                this.toggleUI(data.isLoggedIn);
            }
        } catch (e) { this.userId = null; this.toggleUI(false); }
    },
    
    async login() {
        const id = document.getElementById('user-id').value;
        const pw = document.getElementById('user-pw').value;
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
                else alert('아이디 또는 비밀번호가 올바르지 않습니다.');
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
            if (res.ok) alert('메모가 안전하게 저장되었습니다.');
            else alert('저장에 실패했습니다.');
        } catch (err) { alert('서버 연결에 실패했습니다.'); }
    },

    async deleteMemo(schoolName, e) {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        if (!confirm("정말 이 메모를 완전히 삭제하시겠습니까?")) return;

        const textArea = document.getElementById(`memo-${schoolName}`);
        try {
            const res = await fetch('/api/memo', {
                method: 'DELETE', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schoolName })
            });

            if (res.ok) {
                alert('메모가 삭제되었습니다.');
                if (textArea) textArea.value = "";
            } else {
                alert('삭제에 실패했습니다. (서버 미지원 가능성)');
            }
        } catch (err) { 
            console.error(err);
            alert('서버 연결 오류'); 
        }
    },

    toggleUI(isLoggedIn) {
        const form = document.getElementById('login-form');
        const info = document.getElementById('user-info');
        if (form) form.style.display = isLoggedIn ? 'none' : 'flex';
        if (info) info.style.display = isLoggedIn ? 'flex' : 'none';
        
        const changePwBtn = document.getElementById('change-pw-btn');
        if (changePwBtn) changePwBtn.style.display = isLoggedIn ? 'inline-block' : 'none';
        
        if (isLoggedIn) {
            document.getElementById('welcome-msg').innerText = `${this.userId}님`;
            const adminBtn = document.getElementById('admin-panel-btn');
            if (this.userId === 'spring' && adminBtn) adminBtn.style.display = 'inline-block';
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

const AdminManager = {
    async open() {
        const password = prompt("관리자 보안 코드를 입력하세요.");
        if (password !== "0327") return alert("인증 실패");
        const modal = document.getElementById('admin-modal');
        if (modal) {
            modal.style.display = 'flex';
            this.loadResetRequests();
        }
    },
    close() {
        const modal = document.getElementById('admin-modal');
        if (modal) modal.style.display = 'none';
    },
    async manageUsers() {
        const content = document.getElementById('admin-content');
        content.innerHTML = '<p>데이터 로딩중...</p>';
        try {
            const res = await fetch('/api/admin/users');
            const data = await res.json();
            let html = `<h3>회원 관리</h3><table class="admin-table"><thead><tr><th>ID</th><th>Action</th></tr></thead><tbody>`;
            data.users.forEach(u => {
                html += `<tr><td>${u.id}</td><td><button onclick="AdminManager.deleteUser('${u.id}')" class="admin-btn-delete">강제탈퇴</button></td></tr>`;
            });
            html += `</tbody></table>`;
            content.innerHTML = html;
        } catch (e) { content.innerHTML = '<p>로딩 실패</p>'; }
    },
    async deleteUser(id) {
        if(!confirm(`${id}님을 탈퇴시킬까요?`)) return;
        await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
        this.manageUsers();
    },
    async loadResetRequests() {
        const content = document.getElementById('admin-content');
        content.innerHTML = '<p>데이터 로딩중...</p>';
        try {
            const res = await fetch('/api/admin/reset-requests');
            const data = await res.json();
            if (!data.requests || data.requests.length === 0) {
                 content.innerHTML = '<h3>비밀번호 초기화 요청</h3><p>대기 중인 요청이 없습니다.</p>';
                 return;
            }
            let html = `<h3>비밀번호 초기화 요청</h3><table class="admin-table"><thead><tr><th>ID</th><th>요청일시</th><th>승인</th></tr></thead><tbody>`;
            data.requests.forEach(r => {
                html += `<tr><td>${r.id}</td><td>${new Date(r.requestDate).toLocaleString()}</td><td><button onclick="AdminManager.approveOne('${r.id}')" class="admin-btn-approve">초기화 승인 (1234)</button></td></tr>`;
            });
            html += `</tbody></table>`;
            content.innerHTML = html;
        } catch (e) { content.innerHTML = '<p>데이터 로드 오류</p>'; }
    },
    async approveOne(id) {
        if(!confirm(`${id}님의 비밀번호를 '1234'로 초기화하시겠습니까?`)) return;
        try {
            const res = await fetch('/api/admin/approve-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, tempPw: '1234' }) 
            });
            if (res.ok) {
                alert(`${id}님의 비밀번호가 1234로 초기화되었습니다.`);
                this.loadResetRequests();
            }
        } catch (e) { alert("승인 처리 실패"); }
    },
    async viewAllMemos() {
        const content = document.getElementById('admin-content');
        content.innerHTML = '<p>메모 로딩중...</p>';
        try {
            const res = await fetch('/api/admin/memos');
            const data = await res.json();
            let html = `<h3>전체 사용자 메모</h3><table class="admin-table"><thead><tr><th>ID</th><th>학교</th><th>내용</th></tr></thead><tbody>`;
            data.memos.forEach(m => {
                html += `<tr><td>${m.userId}</td><td>${m.schoolName}</td><td>${m.content}</td></tr>`;
            });
            html += `</tbody></table>`;
            content.innerHTML = html;
        } catch (e) { content.innerHTML = '<p>로드 실패</p>'; }
    }
};