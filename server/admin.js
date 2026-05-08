const AdminApp = {
    allUsers: [],
    allMemos: [],
    currentColors: {},

    async init() {
        try {
            const res = await fetch('/api/check-auth');
            const data = await res.json();
            if (!data.isLoggedIn || !data.isAdmin) {
                alert("관리자 권한이 없습니다.");
                location.href = 'index.html';
                return;
            }
            document.getElementById('admin-name').innerText = `${data.userId}`;
            this.loadResetRequests(); 
        } catch(e) { location.href = 'index.html'; }
    },

    async logout() {
        try { await fetch('/api/logout', { method: 'POST' }); } catch(e) {}
        location.href = 'index.html';
    },

    setActiveNav(navId) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(navId).classList.add('active');
    },

    /* 1. PW 초기화 (기존 동일) */
    async loadResetRequests() {
        this.setActiveNav('nav-reset');
        const content = document.getElementById('admin-content');
        try {
            const res = await fetch('/api/admin/reset-requests');
            const data = await res.json();
            if (!data.requests || data.requests.length === 0) {
                 content.innerHTML = '<h2>🔑 비밀번호 초기화 요청</h2><p style="color:#666;">대기 중인 요청이 없습니다.</p>';
                 return;
            }
            let html = `<h2>🔑 비밀번호 초기화 요청</h2><table class="admin-table"><thead><tr><th>요청자 ID</th><th>요청 일시</th><th>승인</th></tr></thead><tbody>`;
            data.requests.forEach(r => {
                html += `<tr><td style="font-weight:bold; color:#e74c3c;">${r.id}</td><td>${new Date(r.requestDate).toLocaleString('ko-KR')}</td>
                    <td><button onclick="AdminApp.approveOne('${r.id}')" class="admin-btn-approve">초기화 승인(1234)</button></td></tr>`;
            });
            content.innerHTML = html + `</tbody></table>`;
        } catch (e) { content.innerHTML = '<p>데이터 로드 오류</p>'; }
    },

    async approveOne(id) {
        if(!confirm(`[${id}] 님의 비밀번호를 '1234'로 강제 초기화하시겠습니까?`)) return;
        await fetch('/api/admin/approve-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, tempPw: '1234' }) });
        alert(`완료되었습니다.`); this.loadResetRequests();
    },

    /* 2. 회원 관리 (검색 기능 추가) */
    async manageUsers() {
        this.setActiveNav('nav-users');
        const content = document.getElementById('admin-content');
        try {
            const res = await fetch('/api/admin/users');
            const data = await res.json();
            this.allUsers = data.users || [];
            
            content.innerHTML = `
                <h2>👥 전체 회원 관리</h2>
                <input type="text" id="user-search" class="admin-search-bar" placeholder="회원 ID로 검색..." onkeyup="AdminApp.filterUsers()">
                <div id="user-table-container"></div>
            `;
            this.renderUsers(this.allUsers);
        } catch (e) { content.innerHTML = '<p>로딩 실패</p>'; }
    },

    filterUsers() {
        const q = document.getElementById('user-search').value.toLowerCase();
        const filtered = this.allUsers.filter(u => u.id.toLowerCase().includes(q));
        this.renderUsers(filtered);
    },

    renderUsers(users) {
        const container = document.getElementById('user-table-container');
        if(users.length === 0) { container.innerHTML = '<p>검색 결과가 없습니다.</p>'; return; }
        let html = `<table class="admin-table"><thead><tr><th>가입자 ID</th><th>위험 관리</th></tr></thead><tbody>`;
        users.forEach(u => {
            html += `<tr><td style="font-weight:bold;">${u.id}</td>
                <td><button onclick="AdminApp.deleteUser('${u.id}')" class="admin-btn-delete">강제 탈퇴 처리</button></td></tr>`;
        });
        container.innerHTML = html + `</tbody></table>`;
    },

    async deleteUser(id) {
        if(!confirm(`정말 [${id}] 님을 강제 탈퇴시키겠습니까?`)) return;
        await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
        this.manageUsers();
    },

    /* 3. 메모 관리 (검색 & 개별 삭제 기능 추가) */
    async viewAllMemos() {
        this.setActiveNav('nav-memos');
        const content = document.getElementById('admin-content');
        try {
            const res = await fetch('/api/admin/memos');
            const data = await res.json();
            this.allMemos = data.memos || [];

            content.innerHTML = `
                <h2>📝 전체 유저 메모 모아보기</h2>
                <input type="text" id="memo-search" class="admin-search-bar" placeholder="ID, 학교명, 또는 메모 내용으로 검색..." onkeyup="AdminApp.filterMemos()">
                <div id="memo-table-container"></div>
            `;
            this.renderMemos(this.allMemos);
        } catch (e) { content.innerHTML = '<p>메모 로드 실패</p>'; }
    },

    filterMemos() {
        const q = document.getElementById('memo-search').value.toLowerCase();
        const filtered = this.allMemos.filter(m => 
            m.userId.toLowerCase().includes(q) || m.schoolName.toLowerCase().includes(q) || m.content.toLowerCase().includes(q)
        );
        this.renderMemos(filtered);
    },

    renderMemos(memos) {
        const container = document.getElementById('memo-table-container');
        if(memos.length === 0) { container.innerHTML = '<p>검색 결과가 없습니다.</p>'; return; }
        let html = `<table class="admin-table"><thead><tr><th>작성자 ID</th><th>대상 학교</th><th>메모 내용</th><th>관리</th></tr></thead><tbody>`;
        memos.forEach(m => {
            html += `<tr>
                <td><span style="background:#eef5ff; color:#4A90E2; padding:3px 8px; border-radius:4px; font-weight:bold;">${m.userId}</span></td>
                <td style="font-weight:bold; color:#333;">${m.schoolName}</td>
                <td style="color:#555;">${m.content.replace(/\n/g, '<br>')}</td>
                <td><button onclick="AdminApp.deleteMemo('${m.userId}', '${m.schoolName}')" class="admin-btn-delete">삭제</button></td>
            </tr>`;
        });
        container.innerHTML = html + `</tbody></table>`;
    },

    async deleteMemo(userId, schoolName) {
        if(!confirm(`[${userId}] 님이 작성한 [${schoolName}] 메모를 삭제하시겠습니까?`)) return;
        await fetch('/api/admin/memos', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, schoolName })
        });
        this.viewAllMemos();
    },

    /* 4. 지도 색상 관리 (일반/공유학교 탭 분리 및 JSON 연동) */
    async manageColors() {
        this.setActiveNav('nav-colors');
        const content = document.getElementById('admin-content');
        
        // 서버에서 색상 불러오기
        try {
            const res = await fetch('/api/colors');
            this.currentColors = await res.json();
        } catch(e) {
            // 실패 시 기본값 세팅
            this.currentColors = {
                general: { dongtanFill: "#e9c40e", byeongjeomFill: "#473198", hyohoengFill: "#3299e7", manseFill: "#a9d1ec", hwaseongBorder: "#0047AB", osanFill: "#FF6392", osanBorder: "#e7733d" },
                shared: { hwaseongFill: "#4A90E2", hwaseongBorder: "#0047AB", osanFill: "#FF6392", osanBorder: "#e7733d" }
            };
        }

        content.innerHTML = `
            <h2>🎨 지도 색상 관리</h2>
            <div class="color-tabs">
                <button class="color-tab-btn active" onclick="AdminApp.switchColorTab('general', this)">일반 학교 지도</button>
                <button class="color-tab-btn" onclick="AdminApp.switchColorTab('shared', this)">공유학교 지도</button>
            </div>
            
            <form id="color-form">
                <div id="tab-general" class="color-grid">
                    ${this.createColorInput('general', 'dongtanFill', '동탄구 내부 색상', this.currentColors.general.dongtanFill)}
                    ${this.createColorInput('general', 'byeongjeomFill', '병점구 내부 색상', this.currentColors.general.byeongjeomFill)}
                    ${this.createColorInput('general', 'hyohoengFill', '효행구 내부 색상', this.currentColors.general.hyohoengFill)}
                    ${this.createColorInput('general', 'manseFill', '만세구 내부 색상', this.currentColors.general.manseFill)}
                    ${this.createColorInput('general', 'hwaseongBorder', '화성시 테두리 색상', this.currentColors.general.hwaseongBorder)}
                    ${this.createColorInput('general', 'osanFill', '오산시 내부 색상', this.currentColors.general.osanFill)}
                    ${this.createColorInput('general', 'osanBorder', '오산시 테두리 색상', this.currentColors.general.osanBorder)}
                </div>

                <div id="tab-shared" class="color-grid" style="display:none;">
                    ${this.createColorInput('shared', 'hwaseongFill', '화성 다(多)가치 내부 색상', this.currentColors.shared.hwaseongFill)}
                    ${this.createColorInput('shared', 'hwaseongBorder', '화성 다(多)가치 테두리 색상', this.currentColors.shared.hwaseongBorder)}
                    ${this.createColorInput('shared', 'osanFill', '오산나래 내부 색상', this.currentColors.shared.osanFill)}
                    ${this.createColorInput('shared', 'osanBorder', '오산나래 테두리 색상', this.currentColors.shared.osanBorder)}
                </div>

                <button type="button" class="btn-save-colors" onclick="AdminApp.saveColors()">💾 설정 저장 적용하기</button>
            </form>
        `;
    },

    createColorInput(category, key, label, defaultVal) {
        const id = `${category}-${key}`;
        // 피커 변경 시 텍스트 변경, 텍스트 변경 시 피커 변경
        return `
            <div class="color-item">
                <label>${label}</label>
                <div class="color-input-group">
                    <input type="color" id="${id}-picker" value="${defaultVal}" oninput="document.getElementById('${id}-text').value = this.value">
                    <input type="text" id="${id}-text" value="${defaultVal}" maxlength="7" oninput="if(/^#[0-9A-Fa-f]{6}$/.test(this.value)) document.getElementById('${id}-picker').value = this.value">
                </div>
            </div>
        `;
    },

    switchColorTab(tabName, btnElement) {
        document.querySelectorAll('.color-tab-btn').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
        document.getElementById('tab-general').style.display = tabName === 'general' ? 'grid' : 'none';
        document.getElementById('tab-shared').style.display = tabName === 'shared' ? 'grid' : 'none';
    },

    async saveColors() {
        const getVal = (cat, key) => document.getElementById(`${cat}-${key}-text`).value;
        const newColors = {
            general: {
                dongtanFill: getVal('general', 'dongtanFill'), byeongjeomFill: getVal('general', 'byeongjeomFill'),
                hyohoengFill: getVal('general', 'hyohoengFill'), manseFill: getVal('general', 'manseFill'),
                hwaseongBorder: getVal('general', 'hwaseongBorder'), osanFill: getVal('general', 'osanFill'), osanBorder: getVal('general', 'osanBorder')
            },
            shared: {
                hwaseongFill: getVal('shared', 'hwaseongFill'), hwaseongBorder: getVal('shared', 'hwaseongBorder'),
                osanFill: getVal('shared', 'osanFill'), osanBorder: getVal('shared', 'osanBorder')
            }
        };

        try {
            const res = await fetch('/api/colors', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newColors)
            });
            if (res.ok) alert("✅ 색상 설정이 성공적으로 저장되었습니다!\n지도 페이지를 새로고침하면 적용됩니다.");
            else alert("저장에 실패했습니다.");
        } catch(e) { alert("서버 통신 오류"); }
    }
};

document.addEventListener('DOMContentLoaded', () => { AdminApp.init(); });