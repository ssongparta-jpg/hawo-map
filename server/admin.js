// =========================================
// server/admin.js : 관리자 패널 전용 로직
// =========================================
const AdminApp = {
    async init() {
        try {
            // 접속 시 권한(세션) 체크
            const res = await fetch('/api/check-auth');
            const data = await res.json();
            
            // 로그인 안했거나 관리자가 아니면 돌려보냄
            if (!data.isLoggedIn || !data.isAdmin) {
                alert("관리자 권한이 없습니다. 메인 페이지로 돌아갑니다.");
                location.href = 'index.html';
                return;
            }
            
            // 권한 확인 성공 시
            document.getElementById('admin-name').innerText = `${data.userId}`;
            this.loadResetRequests(); // 기본 메인 화면으로 초기화 요청 목록 띄우기
        } catch(e) {
            alert("인증 확인 중 오류 발생");
            location.href = 'index.html';
        }
    },

    async logout() {
        try { await fetch('/api/logout', { method: 'POST' }); } catch(e) {}
        location.href = 'index.html';
    },

    // 활성화된 메뉴 하이라이트 표시
    setActiveNav(navId) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(navId).classList.add('active');
    },

    /* ================= 1. 비밀번호 초기화 요청 관리 ================= */
    async loadResetRequests() {
        this.setActiveNav('nav-reset');
        const content = document.getElementById('admin-content');
        content.innerHTML = '<p>요청 데이터를 불러오는 중...</p>';
        try {
            const res = await fetch('/api/admin/reset-requests');
            const data = await res.json();
            if (!data.requests || data.requests.length === 0) {
                 content.innerHTML = '<h2>🔑 비밀번호 초기화 요청</h2><p style="color:#666; margin-top:20px;">대기 중인 요청이 없습니다. 아주 평화롭네요! ✨</p>';
                 return;
            }
            let html = `<h2>🔑 비밀번호 초기화 요청</h2>
                <table class="admin-table">
                    <thead><tr><th>요청자 ID</th><th>요청 일시</th><th>관리자 승인</th></tr></thead>
                    <tbody>`;
            data.requests.forEach(r => {
                html += `<tr>
                    <td style="font-weight:bold; color:#e74c3c;">${r.id}</td>
                    <td>${new Date(r.requestDate).toLocaleString('ko-KR')}</td>
                    <td><button onclick="AdminApp.approveOne('${r.id}')" class="admin-btn-approve">초기화 승인 (1234)</button></td>
                </tr>`;
            });
            html += `</tbody></table>`;
            content.innerHTML = html;
        } catch (e) { content.innerHTML = '<p>데이터 로드 오류</p>'; }
    },

    async approveOne(id) {
        if(!confirm(`[${id}] 님의 비밀번호를 '1234'로 강제 초기화하시겠습니까?`)) return;
        try {
            const res = await fetch('/api/admin/approve-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, tempPw: '1234' }) 
            });
            if (res.ok) {
                alert(`성공: ${id}님의 비밀번호가 1234로 초기화되었습니다.`);
                this.loadResetRequests();
            }
        } catch (e) { alert("승인 처리 실패"); }
    },

    /* ================= 2. 전체 회원 관리 ================= */
    async manageUsers() {
        this.setActiveNav('nav-users');
        const content = document.getElementById('admin-content');
        content.innerHTML = '<p>회원 목록을 불러오는 중...</p>';
        try {
            const res = await fetch('/api/admin/users');
            const data = await res.json();
            let html = `<h2>👥 전체 회원 관리</h2>
                <table class="admin-table">
                    <thead><tr><th>가입자 ID</th><th>위험 관리</th></tr></thead>
                    <tbody>`;
            data.users.forEach(u => {
                html += `<tr>
                    <td style="font-weight:bold;">${u.id}</td>
                    <td><button onclick="AdminApp.deleteUser('${u.id}')" class="admin-btn-delete">강제 탈퇴 처리</button></td>
                </tr>`;
            });
            html += `</tbody></table>`;
            content.innerHTML = html;
        } catch (e) { content.innerHTML = '<p>로딩 실패</p>'; }
    },

    async deleteUser(id) {
        if(!confirm(`정말 [${id}] 님을 강제 탈퇴시키겠습니까?\n이 사용자의 모든 메모와 설정이 영구 삭제됩니다.`)) return;
        await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
        alert(`[${id}] 님이 탈퇴 처리되었습니다.`);
        this.manageUsers();
    },

    /* ================= 3. 전체 유저 메모 감시 ================= */
    async viewAllMemos() {
        this.setActiveNav('nav-memos');
        const content = document.getElementById('admin-content');
        content.innerHTML = '<p>전체 메모를 불러오는 중...</p>';
        try {
            const res = await fetch('/api/admin/memos');
            const data = await res.json();
            
            if (!data.memos || data.memos.length === 0) {
                 content.innerHTML = '<h2>📝 전체 유저 메모</h2><p style="color:#666;">작성된 메모가 없습니다.</p>';
                 return;
            }

            let html = `<h2>📝 전체 유저 메모 모아보기</h2>
                <table class="admin-table">
                    <thead><tr><th>작성자 ID</th><th>대상 학교</th><th>메모 내용</th></tr></thead>
                    <tbody>`;
            data.memos.forEach(m => {
                html += `<tr>
                    <td><span style="background:#eef5ff; color:#4A90E2; padding:3px 8px; border-radius:4px; font-weight:bold;">${m.userId}</span></td>
                    <td style="font-weight:bold; color:#333;">${m.schoolName}</td>
                    <td style="color:#555;">${m.content.replace(/\n/g, '<br>')}</td>
                </tr>`;
            });
            html += `</tbody></table>`;
            content.innerHTML = html;
        } catch (e) { content.innerHTML = '<p>메모 로드 실패</p>'; }
    }
};

// 페이지가 켜지면 즉시 권한 검사 및 초기화 실행
document.addEventListener('DOMContentLoaded', () => {
    AdminApp.init();
});