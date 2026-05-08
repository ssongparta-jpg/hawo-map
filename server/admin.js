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

    /* 1. PW 초기화 */
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

    /* 2. 회원 관리 */
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

    /* 3. 메모 관리 */
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

    /* 4. 지도 색상 관리 (버그 수정 및 미리보기 추가) */
    async manageColors() {
        this.setActiveNav('nav-colors');
        const content = document.getElementById('admin-content');
        
        // [버그 수정] 서버 404 에러 방어 로직 강화
        try {
            const res = await fetch('/api/colors');
            if (!res.ok) throw new Error("저장된 색상 파일이 없습니다."); 
            const data = await res.json();
            if (!data.general || !data.shared) throw new Error("데이터 구조가 올바르지 않습니다.");
            this.currentColors = data;
        } catch(e) {
            console.log("기본 색상을 불러옵니다:", e.message);
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

            <div class="preview-section">
                <h3>👀 실시간 디자인 미리보기</h3>
                
                <div id="prev-box-general" class="preview-box">
                    <div id="prev-area-hwaseong" class="prev-area">
                        <div style="font-size:12px; font-weight:bold; color:#555; margin-bottom:5px;">화성시 영역</div>
                        <div id="prev-btn-dongtan" class="prev-btn">화성시 동탄구 ↗</div>
                        <div id="prev-btn-byeongjeom" class="prev-btn">화성시 병점구 ↗</div>
                        <div id="prev-btn-hyohoeng" class="prev-btn">화성시 효행구 ↗</div>
                        <div id="prev-btn-manse" class="prev-btn">화성시 만세구 ↗</div>
                    </div>
                    <div id="prev-area-osan" class="prev-area">
                        <div style="font-size:12px; font-weight:bold; color:#555; margin-bottom:5px;">오산시 영역</div>
                        <div id="prev-btn-osan" class="prev-btn">오산시 ↗</div>
                    </div>
                </div>

                <div id="prev-box-shared" class="preview-box" style="display:none;">
                    <div id="prev-area-shared-hw" class="prev-area">
                        <div style="font-size:12px; font-weight:bold; color:#555; margin-bottom:5px;">화성 다(多)가치 영역</div>
                        <div id="prev-btn-shared-hw" class="prev-btn"><img src="source/coco.png"> 화성 다(多)가치 ↗</div>
                    </div>
                    <div id="prev-area-shared-os" class="prev-area">
                        <div style="font-size:12px; font-weight:bold; color:#555; margin-bottom:5px;">오산나래 영역</div>
                        <div id="prev-btn-shared-os" class="prev-btn"><img src="source/caca.png"> 오산나래 ↗</div>
                    </div>
                </div>
            </div>
        `;
        
        // 렌더링 직후 미리보기 초기화 업데이트
        this.updatePreview();
    },

    createColorInput(category, key, label, defaultVal) {
        const id = `${category}-${key}`;
        // 값이 바뀔 때마다 updatePreview() 호출
        return `
            <div class="color-item">
                <label>${label}</label>
                <div class="color-input-group">
                    <input type="color" id="${id}-picker" value="${defaultVal}" oninput="document.getElementById('${id}-text').value = this.value; AdminApp.updatePreview();">
                    <input type="text" id="${id}-text" value="${defaultVal}" maxlength="7" oninput="if(/^#[0-9A-Fa-f]{6}$/.test(this.value)) { document.getElementById('${id}-picker').value = this.value; AdminApp.updatePreview(); }">
                </div>
            </div>
        `;
    },

    switchColorTab(tabName, btnElement) {
        document.querySelectorAll('.color-tab-btn').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
        document.getElementById('tab-general').style.display = tabName === 'general' ? 'grid' : 'none';
        document.getElementById('tab-shared').style.display = tabName === 'shared' ? 'grid' : 'none';
        
        // 미리보기 박스 전환
        document.getElementById('prev-box-general').style.display = tabName === 'general' ? 'flex' : 'none';
        document.getElementById('prev-box-shared').style.display = tabName === 'shared' ? 'flex' : 'none';
    },

    // ✨ 값을 읽어와 미리보기 요소에 디자인 적용
    updatePreview() {
        // 1. 일반 지도 요소 적용
        const dFill = document.getElementById('general-dongtanFill-text')?.value;
        if (dFill) {
            document.getElementById('prev-btn-dongtan').style.backgroundColor = dFill;
            document.getElementById('prev-btn-byeongjeom').style.backgroundColor = document.getElementById('general-byeongjeomFill-text').value;
            document.getElementById('prev-btn-hyohoeng').style.backgroundColor = document.getElementById('general-hyohoengFill-text').value;
            document.getElementById('prev-btn-manse').style.backgroundColor = document.getElementById('general-manseFill-text').value;
            
            document.getElementById('prev-area-hwaseong').style.borderColor = document.getElementById('general-hwaseongBorder-text').value;
            document.getElementById('prev-area-hwaseong').style.backgroundColor = "transparent"; // 화성은 내부 채우기 없음
            
            const oFill = document.getElementById('general-osanFill-text').value;
            document.getElementById('prev-btn-osan').style.backgroundColor = oFill;
            document.getElementById('prev-area-osan').style.borderColor = document.getElementById('general-osanBorder-text').value;
            document.getElementById('prev-area-osan').style.backgroundColor = oFill + '33'; // 헥스코드에 33을 붙이면 투명도 20% 효과
        }

        // 2. 공유학교 지도 요소 적용
        const shFill = document.getElementById('shared-hwaseongFill-text')?.value;
        if (shFill) {
            document.getElementById('prev-btn-shared-hw').style.backgroundColor = shFill;
            document.getElementById('prev-area-shared-hw').style.borderColor = document.getElementById('shared-hwaseongBorder-text').value;
            document.getElementById('prev-area-shared-hw').style.backgroundColor = shFill + '33';

            const soFill = document.getElementById('shared-osanFill-text').value;
            document.getElementById('prev-btn-shared-os').style.backgroundColor = soFill;
            document.getElementById('prev-area-shared-os').style.borderColor = document.getElementById('shared-osanBorder-text').value;
            document.getElementById('prev-area-shared-os').style.backgroundColor = soFill + '33';
        }
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