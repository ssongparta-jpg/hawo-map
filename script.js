const MapConfig = {
    SHEET_ID: '1xzpPpZh00DCC6zl0PhVx7uGab_6-9qkPhTHqcz5yuIE',
    GIDS: { HEADER: '1120810254', POINTS: '1290947643', LEGEND: '882261582' },
    MAP_CENTER: [37.196554, 126.911871],
    BOUNDS: [[36.886521, 126.557641], [37.403725, 127.272064]],
    DISTRICTS: {
        "화성시": { pos: [37.185, 126.915], color: "#4A90E2", fullName: "화성시 전체" },
        "오산시": { pos: [37.16361, 127.06229], color: "#be522e", fullName: "오산시" },
        "동탄구": { pos: [37.198, 127.09], color: "#d49400", fullName: "화성시 동탄구", keywords: ['동탄', '오산동'] },
        "병점구": { pos: [37.223, 127.022], color: "#9933CC", fullName: "화성시 병점구", keywords: ['진안', '병점', '반월', '화산', '기배', '안녕', '송산동'] },
        "효행구": { pos: [37.214, 126.925], color: "#3366FF", fullName: "화성시 효행구", keywords: ['봉담', '비봉', '매송', '정남'] },
        "만세구": { pos: [37.152, 126.892], color: "#71a5ce", fullName: "화성시 만세구", keywords: ['향남', '우정', '팔탄', '장안', '양감', '마도', '송산면', '서신', '남양', '새솔'] }
    }
};

const HelpManager = {
    data: null,
    init(rows) {
        if (!rows || rows.length === 0) return;
        let targetRow = rows.find(r => r.c && r.c[0]?.v !== 'header_text') || rows[0];
        if (!targetRow || !targetRow.c) return;

        const c = targetRow.c;
        this.data = {
            headerText: c[0]?.v || '경기도화성오산교육지원청 학교 지도',
            updateDate: c[1]?.v || '-',
            title: c[2]?.v || '사용 방법 안내',
            subtitle: c[3]?.v || '도움말',
            content: c[4]?.v || '내용 없음',
            contact: c[5]?.v || '-'
        };
        const titleEl = document.getElementById('header-title');
        if (titleEl) titleEl.innerText = this.data.headerText;
        document.getElementById('helpBtn').addEventListener('click', () => this.showModal());
    },
    showModal() {
        if (!this.data) return;
        const modal = document.getElementById('helpModal');
        const contentBox = document.getElementById('helpContentInject');
        contentBox.innerHTML = `
            <div class="popup-category">${this.data.subtitle}</div>
            <div class="popup-title" style="font-size:22px; margin-bottom:15px;">${this.data.title}</div>
            <div style="font-size:14px; line-height:1.6; color:#555; margin-bottom:25px; background:#f9f9f9; padding:15px; border-radius:8px;">${this.data.content.replace(/\n/g, '<br>')}</div>
            <hr class="popup-hr">
            <ul class="popup-info-list">
                <li><span class="label">최근 업데이트</span> <span class="value">${this.data.updateDate}</span></li>
                <li><span class="label">문의</span> <span class="value">${this.data.contact}</span></li>
            </ul>
        `;
        modal.style.display = 'flex';
    }
};

const SearchManager = {
    init() {
        const input = document.getElementById('schoolSearch');
        const resultBox = document.getElementById('searchResults');
        
        input.addEventListener('keyup', (e) => {
            const val = e.target.value.trim();
            if (val.length < 1) { resultBox.style.display = 'none'; return; }
            const matches = MapManager.markers.filter(m => m.properties.name.includes(val));
            this.renderResults(matches, resultBox);
        });
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-wrapper')) resultBox.style.display = 'none';
        });
    },
    renderResults(matches, container) {
        container.innerHTML = '';
        if (matches.length === 0) { container.style.display = 'none'; return; }
        matches.slice(0, 8).forEach(m => {
            const div = document.createElement('div');
            div.className = 'search-item';
            let typeColor = '#333';
            if (m.properties.name.includes('초등학교')) typeColor = '#2ECC71';
            else if (m.properties.name.includes('중학교')) typeColor = '#F1C40F';
            else if (m.properties.name.includes('고등학교')) typeColor = '#E74C3C';
            else if (m.properties.name.includes('유치원')) typeColor = '#4A90E2';

            div.innerHTML = `<span>${m.properties.name}</span><span style="font-size:11px; color:${typeColor}; font-weight:bold;">${m.properties.type}</span>`;
            div.onclick = () => {
                MapManager.focusMarker(m);
                container.style.display = 'none';
                document.getElementById('schoolSearch').value = m.properties.name;
            };
            container.appendChild(div);
        });
        container.style.display = 'block';
    }
};

const MapManager = {
    map: null,
    cluster: null,
    markers: [],
    boundaryGroup: L.layerGroup(),

    init() {
        this.map = L.map('map', { zoomControl: false, minZoom: 10, maxZoom: 18, attributionControl: false });
        this.map.setView(MapConfig.MAP_CENTER, 11);
        this.map.setMaxBounds(MapConfig.BOUNDS);
        this.map.createPane('topPane').style.zIndex = 1000;
        
        const popupPane = this.map.createPane('ultraTopPane');
        popupPane.style.zIndex = 99999;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
        this.boundaryGroup.addTo(this.map);

        this.cluster = L.markerClusterGroup({
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            maxClusterRadius: 100,
            disableClusteringAtZoom: 14,
            singleMarkerMode: false,
            iconCreateFunction: (cluster) => {
                const count = cluster.getChildCount();
                let cSize = count >= 50 ? 'red' : count >= 15 ? 'yellow' : 'small';
                return L.divIcon({
                    html: `<div><span>${count}</span></div>`,
                    className: `marker-cluster marker-cluster-${cSize}`,
                    iconSize: [40, 40]
                });
            }
        }).addTo(this.map);

        this.bindEvents();
    },

    getMarkerIcon(p, index, isColliding) {
        let typeClass = 'is-spec';
        let symbolChar = '◆';
        if (p.name.includes('유치원')) { typeClass = 'is-kinder'; symbolChar = '∎'; }
        else if (p.name.includes('초등학교')) { typeClass = 'is-elem'; symbolChar = '▲'; }
        else if (p.name.includes('중학교')) { typeClass = 'is-mid'; symbolChar = '●'; }
        else if (p.name.includes('고등학교')) { typeClass = 'is-high'; symbolChar = '★'; }

        let labelPosClass = (index % 2 === 0) ? 'label-up' : 'label-down';
        if (isColliding) {
            labelPosClass = 'label-pushed-way-down';
        }
        
        const safeName = p.name.replace(/'/g, "\\'");

        const html = `
            <div class="custom-combined-marker ${typeClass}"
                 onclick="MapManager.triggerMarkerPopup(event, '${safeName}')">
                
                <div class="marker-label-box ${labelPosClass}" 
                     onclick="MapManager.triggerMarkerPopup(event, '${safeName}')">
                     ${p.name}
                </div>
                
                <div class="marker-symbol" style="color:${p.color};">
                    ${symbolChar}
                </div>
            </div>
        `;
        return L.divIcon({ className: 'marker-container-icon', html, iconSize: [0, 0] });
    },

    bindEvents() {
        this.map.on('zoomend', () => {
            const zoom = this.map.getZoom();
            document.querySelectorAll('.dist-stat-btn').forEach(btn => btn.className = `dist-stat-btn zoom-lv-${zoom}`);
            
            const mapContainer = this.map.getContainer();
            if (zoom >= 15) mapContainer.classList.add('show-school-labels');
            else mapContainer.classList.remove('show-school-labels');
        });

        const toggleBtn = document.getElementById('toggle-boundary');
        if (toggleBtn) {
            toggleBtn.addEventListener('change', (e) => {
                if (e.target.checked) this.map.addLayer(this.boundaryGroup);
                else this.map.removeLayer(this.boundaryGroup);
            });
        }

        // [수정: 메모 로딩 기능 추가] 팝업이 열릴 때 메모 데이터를 가져와서 채워넣음
        this.map.on('popupopen', async (e) => {
            const popupNode = e.popup.getElement();
            const textarea = popupNode.querySelector('textarea[id^="memo-"]');
            const saveBtn = popupNode.querySelector('.memo-save-btn');
            const favBtn = popupNode.querySelector('.fav-toggle-btn');

            if (textarea && saveBtn) {
                const schoolName = textarea.id.replace('memo-', '');
                const isLoggedIn = AuthManager.userId !== null;

                if (isLoggedIn && favBtn) {
                    try {
                        const favRes = await fetch(`/api/favorite/${encodeURIComponent(schoolName)}`);
                        const favData = await favRes.json();
                        this.updateFavoriteUI(schoolName, favData.isFavorite);
                    } catch(err) { console.error("즐겨찾기 로드 실패"); }
                }

                textarea.disabled = !isLoggedIn;
                saveBtn.disabled = !isLoggedIn;
                saveBtn.style.backgroundColor = isLoggedIn ? '#4A90E2' : '#ccc';

                // 로그인 상태에 따라 초기 UI 설정
                if (isLoggedIn) {
                    textarea.placeholder = "메모를 불러오는 중...";
                    try {
                        const res = await fetch(`/api/memo/${encodeURIComponent(schoolName)}`);
                        const data = await res.json();
                        textarea.value = data.content || "";
                        textarea.placeholder = "여기에 메모를 작성하세요";
                    } catch(err) {
                        textarea.placeholder = "메모 로드 실패";
                    }
                } else {
                    textarea.value = ""; 
                    textarea.placeholder = "로그인 후 이용 가능합니다";
                }
            }
        });

        const favOnlyBtn = document.getElementById('toggle-favorite-only');
        if (favOnlyBtn) {
            favOnlyBtn.addEventListener('change', (e) => {
                this.filterFavorites(e.target.checked);
            });
        }
    },

    async filterFavorites(showOnlyFav) {
        if (showOnlyFav && !AuthManager.userId) {
            alert("로그인이 필요한 기능입니다.");
            document.getElementById('toggle-favorite-only').checked = false;
            return;
        }

        try {
            let favoriteNames = [];
            if (showOnlyFav) {
                const res = await fetch('/api/my-favorites');
                const data = await res.json();
                favoriteNames = data.favorites || [];
            }

            this.cluster.clearLayers();

            this.markers.forEach(marker => {
                if (!showOnlyFav) {
                    this.cluster.addLayer(marker);
                } else {
                    if (favoriteNames.includes(marker.properties.name)) {
                        this.cluster.addLayer(marker);
                    }
                }
            });
        } catch(err) {
            console.error("필터링 중 오류:", err);
            alert("목록을 불러오는데 실패했습니다.");
        }
    },

    async toggleFavorite(schoolName, event) {
        if (event) event.stopPropagation();

        if (AuthManager.userId === null) {
            alert("로그인 후 이용 가능합니다.");
            return;
        }

        try {
            const res = await fetch('/api/favorite/toggle', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({schoolName})
            });
            const data = await res.json();
            if (data.success) {
                this.updateFavoriteUI(schoolName, data.isFavorite);
            } else {
                throw new Error("처리 실패");
            }
        } catch(err) {
            alert("즐겨찾기 변경 실패");
        }
    },

    updateFavoriteUI(schoolName, isFavorite) {
        const favBtn = document.getElementById(`fav-btn-${schoolName}`);
        if (favBtn) {
            favBtn.innerText = isFavorite ? "★": "☆";
            favBtn.style.color = isFavorite ? "gold": "#ccc";
        }
    },

    createMarker(lat, lng, p, index, isColliding) {
        const marker = L.marker([lat, lng], {
            icon: this.getMarkerIcon(p, index, isColliding) 
        }).bindPopup(this.makePopupHtml(p), {
            className: 'custom-popup',
            pane: 'ultraTopPane',
            autoPanPadding: L.point(50, 50)
        });
        marker.properties = p;
        return marker;
    },

    triggerMarkerPopup(e, name) {
        if (e) { e.stopPropagation(); }
        const target = this.markers.find(m => m.properties.name === name);
        if (target) { target.openPopup(); }
    },

    focusMarker(m) {
        this.map.flyTo(m.getLatLng(), 16, { duration: 1.5 });
        this.map.once('moveend', () => m.openPopup());
    },

    /* MapManager 객체 내부의 makePopupHtml 함수 수정 */
    makePopupHtml(p) {
        const principal = p.principal || 'No Data';
        const vicePrincipal = p.vice_principal || 'No Data';
        const chiefofadministration = p.chief_of_administration || 'No Data';

        const linkHtml = p.url 
            ? `<a href="${p.url}" target="_blank" class="popup-link-top" title="새 창으로 열기">🏠 홈페이지 이동 ↗</a>` 
            : '<span class="popup-link-none">❌ 홈페이지 없음</span>';

        const isLoggedIn = AuthManager.userId !== null;
        
        // [수정] 버튼 스타일: 로그인 시 파란색, 비로그인 시 회색(disabled)
        const btnBg = isLoggedIn ? '#4A90E2' : '#ccc';
        const btnDisabled = isLoggedIn ? '' : 'disabled';

       return `
            <div class="popup-content compact-mode">
                <div class="popup-header">
                    <div class="popup-category">${p.type || ''}</div>
                    ${linkHtml}
                </div>

                <div class="popup-title-row" style="display: flex; align-items: center; justify-content: space-between;">
                    <div class="popup-title" style="margin: 0;">${p.name || ''}</div>
                    <button id="fav-btn-${p.name}" class="fav-toggle-btn" 
                            onclick="MapManager.toggleFavorite('${p.name}', event)"
                            style="background:none; border:none; font-size: 20px; cursor: pointer; color: #ccc;">
                        ☆
                    </button>
                </div>
                
                <div class="popup-adrs">${p.adrs || ''}</div>
                
                <hr class="popup-hr">
                
                <div class="popup-admin-row">
                    <span>교장(원장) <strong>${principal}</strong></span>
                    <span class="divider">|</span>
                    <span>교감(원감) <strong>${vicePrincipal}</strong></span>
                    <span class="divider">|</span>
                    <span>행정실장 <strong>${chiefofadministration}</strong></span>
                </div>
                
                <ul class="popup-info-list grid-list">
                    <li><span class="label">학생 수</span> <span class="value"><strong>${Number(p.stdnt_cnt || 0).toLocaleString()}</strong>명</span></li>
                    <li><span class="label">교사 수</span> <span class="value"><strong>${p.tchr_cnt || 0}</strong>명</span></li>
                    <li><span class="label">학급 수</span> <span class="value"><strong>${p.class_cnt || 0}</strong>개</span></li>
                    <li><span class="label">학급당 학생 수</span> <span class="value"><strong>${p.stdnt_per_cl || 0}</strong>명</span></li>
                    <li><span class="label">교사 1인당 학생 수</span> <span class="value"><strong>${p.stdnt_per_tchr || 0}</strong>명</span></li>
                </ul>

                <div class="memo-section" style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ccc;">
                    <div style="font-weight: bold; font-size: 13px; margin-bottom: 5px;">🏫 개인 메모</div>
                    <textarea id="memo-${p.name}" 
                        style="width: 100%; height: 50px; border: 1px solid #ddd; border-radius: 4px; padding: 5px; font-size: 12px; resize: none;"
                        placeholder="${isLoggedIn ? '메모를 불러오는 중...' : '로그인 후 이용 가능합니다'}"
                        disabled></textarea>
                    <button id="btn-save-${p.name}" class="memo-save-btn"
                        onclick="AuthManager.saveMemo('${p.name}', event)" 
                        style="background-color: ${btnBg};"
                        ${btnDisabled}>
                        메모 저장
                    </button>
                </div>
            </div>
        `;
    },

    async loadBoundaries() {
        try {
            const [dongRes, boundaryRes] = await Promise.all([
                fetch('data/hwao.geojson'),
                fetch('data/hwao_boundary.geojson')
            ]);
            if (!dongRes.ok || !boundaryRes.ok) throw new Error();
            const dongData = await dongRes.json();
            const boundaryData = await boundaryRes.json();

            this.boundaryGroup.clearLayers();
            
            if (!this.map.getPane('boundaryPane')) {
                this.map.createPane('boundaryPane');
                this.map.getPane('boundaryPane').style.zIndex = 250; 
                this.map.getPane('boundaryPane').style.pointerEvents = 'none';
            }

            L.geoJson(dongData, {
                style: (feature) => {
                    const admNm = feature.properties?.adm_nm || '';
                    let fillColor = '#ccc';
                    if (admNm.includes('오산시')) fillColor = MapConfig.DISTRICTS['오산시'].color;
                    else {
                        const guKey = Object.keys(MapConfig.DISTRICTS).find(k => MapConfig.DISTRICTS[k].keywords?.some(w => admNm.includes(w)));
                        fillColor = guKey ? MapConfig.DISTRICTS[guKey].color : MapConfig.DISTRICTS['화성시'].color;
                    }
                    return { fillColor, fillOpacity: 0.35, color: '#ffffff', weight: 2.5, dashArray: '20,5,2,5', pane: 'boundaryPane' };
                }
            }).addTo(this.boundaryGroup);

            L.geoJson(boundaryData, {
                style: (f) => {
                    const sgg = f.properties.sggnm;
                    const col = sgg === '화성시' ? '#0047AB' : sgg === '오산시' ? '#e7733d' : 'transparent';
                    return { fill: false, color: col, weight: 3, pane: 'boundaryPane' };
                }
            }).addTo(this.boundaryGroup);
        } catch (e) { console.error('경계 로드 실패'); }
    },

    addDistrictButtons() {
        Object.entries(MapConfig.DISTRICTS).forEach(([shortName, conf]) => {
            if (!conf.pos) return;
            const icon = L.divIcon({
                className: 'district-stat-marker',
                html: `<div class="dist-stat-btn zoom-lv-${this.map.getZoom()}" style="background-color:${conf.color}!important;color:#fff;">${shortName}</div>`,
                iconSize: [80, 32]
            });
            L.marker(conf.pos, { icon }).addTo(this.map).on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                this.showDistrictStats(conf.fullName || shortName, conf.pos);
            });
        });
    },

    showDistrictStats(fullName, latlng) {
        let keyword = fullName.replace('화성시 ', '').replace(' 전체', '').trim();
        const targets = this.markers.filter(m => {
            const adrs = m.properties.adrs || '';
            if (fullName === '화성시 전체') return adrs.includes('화성시');
            if (fullName === '오산시') return adrs.includes('오산시');
            return MapConfig.DISTRICTS[keyword]?.keywords?.some(k => adrs.includes(k));
        });

        const stats = targets.reduce((acc, m) => {
            acc.s += parseInt(m.properties.stdnt_cnt) || 0;
            acc.c += parseInt(m.properties.class_cnt) || 0;
            acc.t += parseInt(m.properties.tchr_cnt) || 0;
            return acc;
        }, { s: 0, c: 0, t: 0 });

        L.popup({ className: 'custom-popup stat-popup', pane: 'topPane' }).setLatLng(latlng).setContent(`
            <div class="popup-content">
                <div class="popup-title" style="color:#4A90E2;">${fullName}</div>
                <hr class="popup-hr">
                <ul class="popup-info-list">
                    <li><span class="label">학교 수</span> <span class="value"><strong>${targets.length}</strong>개교</span></li>
                    <li><span class="label">총 학생 수</span> <span class="value"><strong>${stats.s.toLocaleString()}</strong>명</span></li>
                    <li><span class="label">총 학급 수</span> <span class="value"><strong>${stats.c.toLocaleString()}</strong>개</span></li>
                    <li><span class="label">총 교사 수</span> <span class="value"><strong>${stats.t.toLocaleString()}</strong>명</span></li>
                </ul>
            </div>
        `).openOn(this.map);
    }
};

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
        } catch (e) {
            console.error("세션 확인 실패", e);
            this.userId = null;
            this.toggleUI(false);
        }
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
                if (errorData.attempts >= 1) {
                    this.showFailPopup(id);
                } else {
                    alert('아이디 또는 비밀번호가 올바르지 않습니다.');
                }
            }
        } catch (e) {
            console.error(e);
            alert("서버 연결 실패");
        }
    },

    showFailPopup(id) {
        const choice = confirm(
            `비밀번호가 일치하지 않습니다.\n\n` +
            `확인(OK): 관리자에게 PW 초기화 요청 메세지 보내기\n` +
            `취소(Cancel): 닫기`
        );
        if (choice) {
            this.requestResetPw(id);
        } 
    },

    async requestResetPw(id) {
        try {
            const res = await fetch('/api/request-reset-pw', {
                method: 'POST', 
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({id})
            });
            if (res.ok) {
                alert(`관리자에게 ${id}님의 초기화 요청이 전달되었습니다.\n관리자 승인 후 비밀번호는 '1234'로 초기화됩니다.`);
            }
        } catch(e) {
            alert("요청 전송 실패");
        }
    },

    async findPw(targetId) {
        alert("보안을 위해 비밀번호는 암호화되어 저장됩니다. 관리자도 원래 비밀번호를 알 수 없습니다.\n\n[초기화 요청 버튼을 눌러 임시 비밀번호를 발급받으세요.");
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
        } catch (e) { console.error(e); }
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
            if (this.userId === 'spring' && adminBtn) {
                adminBtn.style.display = 'inline-block';
            }
        }

        // [수정] 팝업이 열려있다면 즉시 상태 반영
        const openPopupTextArea = document.querySelector('.leaflet-popup-content textarea');
        if (openPopupTextArea) {
            openPopupTextArea.disabled = !isLoggedIn;
            openPopupTextArea.placeholder = isLoggedIn ? "메모를 불러오는 중..." : "로그인 후 이용 가능합니다";
            
            if(isLoggedIn) {
                const schoolName = openPopupTextArea.id.replace('memo-', '');
                fetch(`/api/memo/${schoolName}`)
                    .then(res => res.json())
                    .then(data => {
                        openPopupTextArea.value = data.content || "";
                        openPopupTextArea.placeholder = "여기에 메모를 작성하세요";
                    });
            } else {
                openPopupTextArea.value = "";
            }
        }

        // [수정] 저장 버튼 표시 제어 (display:none 대신 disabled 토글)
        const saveBtns = document.querySelectorAll('button[id^="btn-save-"]');
        saveBtns.forEach(btn => {
            // isLoggedIn이 true면 disabled 제거(활성), false면 disabled 추가(비활성)
            btn.disabled = !isLoggedIn;
            btn.style.backgroundColor = isLoggedIn ? '#4A90E2' : '#ccc';
            btn.style.display = 'block'; // 강제로 보이게 함
        });
    }
};

const FilterManager = {
    selectedTypes: new Set(),
    selectedDistricts: new Set(),

    init() {
        document.querySelectorAll('.filter-tag').forEach(tag => {
            tag.onclick = () => {
                const type = tag.getAttribute('data-type');
                tag.classList.toggle('active');
                this.selectedTypes.has(type) ? this.selectedTypes.delete(type) : this.selectedTypes.add(type);
            };
        });

        document.querySelectorAll('.dist-tag').forEach(tag => {
            tag.onclick = () => {
                const dist = tag.getAttribute('data-dist');
                tag.classList.toggle('active');
                this.selectedDistricts.has(dist) ? this.selectedDistricts.delete(dist) : this.selectedDistricts.add(dist);
            };
        });
    },

    open() { document.getElementById('search-dashboard').style.display = 'flex'; },
    close() { document.getElementById('search-dashboard').style.display = 'none'; },
    
    reset() {
        this.selectedTypes.clear();
        this.selectedDistricts.clear();
        document.querySelectorAll('.filter-tag, .dist-tag').forEach(tag => tag.classList.remove('active'));
        document.getElementById('adv-name-input').value = '';
        ['min-s', 'min-c', 'min-sc', 'min-t', 'min-st', 'max-s', 'max-c', 'max-sc', 'max-t', 'max-st'].forEach(id => {
            const el = document.getElementById(id); if(el) el.value = '';
        });
    },

    execute() {
        const nameQuery = document.getElementById('adv-name-input').value.trim();
        const getVal = (id, def) => Number(document.getElementById(id)?.value) || def;
        const ranges = {
            s: [getVal('min-s', 0), getVal('max-s', Infinity)],
            c: [getVal('min-c', 0), getVal('max-c', Infinity)],
            sc: [getVal('min-sc', 0), getVal('max-sc', Infinity)],
            t: [getVal('min-t', 0), getVal('max-t', Infinity)],
            st: [getVal('min-st', 0), getVal('max-st', Infinity)]
        };

        const filtered = MapManager.markers.filter(m => {
            const p = m.properties;
            const matchName = !nameQuery || p.name.includes(nameQuery);
            const matchType = this.selectedTypes.size === 0 || this.selectedTypes.has(p.type);
            let matchDist = this.selectedDistricts.size === 0 || Array.from(this.selectedDistricts).some(distKey => {
                if (distKey === "오산시") return p.adrs.includes("오산시");
                return MapConfig.DISTRICTS[distKey]?.keywords?.some(k => p.adrs.includes(k));
            });

            const sVal = Number(p.stdnt_cnt) || 0;
            const cVal = Number(p.class_cnt) || 0;
            const scVal = Number(p.stdnt_per_cl) || 0;
            const tVal = Number(p.tchr_cnt) || 0;
            const stVal = Number(p.stdnt_per_tchr) || 0;

            return matchName && matchType && matchDist &&
                   (sVal >= ranges.s[0] && sVal <= ranges.s[1]) &&
                   (cVal >= ranges.c[0] && cVal <= ranges.c[1]) &&
                   (tVal >= ranges.t[0] && tVal <= ranges.t[1]) &&
                   (scVal >= ranges.sc[0] && scVal <= ranges.sc[1]) &&
                   (stVal >= ranges.st[0] && stVal <= ranges.st[1]);
        });

        this.close();
        MapManager.cluster.clearLayers();

        if (filtered.length === 0) {
            alert("조건에 맞는 학교가 없습니다.");
            MapManager.markers.forEach(m => MapManager.cluster.addLayer(m));
        } else if (filtered.length === 1) {
            const target = filtered[0];
            MapManager.cluster.addLayer(target);
            MapManager.map.setView(target.getLatLng(), 16);
            setTimeout(() => target.openPopup(), 400);
        } else {
            filtered.forEach(m => MapManager.cluster.addLayer(m));
            MapManager.map.fitBounds(L.featureGroup(filtered).getBounds().pad(0.2));
            ResultPageManager.open(filtered);
        }
    }
};

const ResultPageManager = {
    open(results) {
        const container = document.getElementById('results-list-container');
        const title = document.getElementById('results-count-title');
        if (title) title.innerText = `검색 결과 (${results.length}개)`;
        if (!container) return;

        container.innerHTML = '';
        [...results].sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'ko')).forEach(m => {
            const p = m.properties;
            const card = document.createElement('div');
            card.className = 'result-card';
            card.innerHTML = `
                <div style="color:#f39c12; font-size:12px;">${p.type}</div>
                <div style="font-size:18px; font-weight:bold;">${p.name}</div>
                <div style="font-size:13px; color:#ccc;">${p.adrs}</div>`;
            card.onclick = () => { this.close(); this.focusSchool(m); };
            container.appendChild(card);
        });
        document.getElementById('search-results-page').style.display = 'flex';
    },
    close() { document.getElementById('search-results-page').style.display = 'none'; },
    focusSchool(marker) {
        MapManager.map.setView(marker.getLatLng(), 16);
        setTimeout(() => marker.openPopup(), 400);
    }
};

const AdminManager = {
    async open() {
        const password = prompt("관리자 보안 코드를 입력하세요.");
        // 보안 코드는 예시입니다. 실제 배포 시에는 서버 세션으로만 검증하세요.
        if (password !== "0327") return alert("인증 실패");
        
        const modal = document.getElementById('admin-modal');
        if (modal) {
            modal.style.display = 'flex';
            this.loadResetRequests(); // 기본으로 요청 목록 로드
        }
    },

    close() {
        const modal = document.getElementById('admin-modal');
        if (modal) modal.style.display = 'none';
    },

    // 1. 유저 관리 UI
    async manageUsers() {
        const content = document.getElementById('admin-content');
        content.innerHTML = '<p>데이터 로딩중...</p>';
        try {
            const res = await fetch('/api/admin/users');
            const data = await res.json();
            
            let html = `<h3>회원 관리</h3><table class="admin-table"><thead><tr><th>ID</th><th>Action</th></tr></thead><tbody>`;
            data.users.forEach(u => {
                html += `<tr>
                    <td>${u.id}</td>
                    <td><button onclick="AdminManager.deleteUser('${u.id}')" class="admin-btn-delete">강제탈퇴</button></td>
                </tr>`;
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

    // 2. 초기화 요청 승인 UI
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
                html += `<tr>
                    <td>${r.id}</td>
                    <td>${new Date(r.requestDate).toLocaleString()}</td>
                    <td><button onclick="AdminManager.approveOne('${r.id}')" class="admin-btn-approve">초기화 승인 (1234)</button></td>
                </tr>`;
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
    
    // 3. 전체 메모 열람 UI
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

const App = {
    async init() {
        console.log("앱 초기화 시작...");
        
        // 1. 기초 UI 및 지도 초기 설정
        MapManager.init();
        FilterManager.init();
        SearchManager.init(); // 중복 호출 방지를 위해 여기서 한 번만 실행

        // 2. 로그인 세션 확인 (비동기)
        await AuthManager.checkAuth();

        try {
            // 3. 구글 시트 데이터 로드
            const [pRows, lRows, hRows] = await Promise.all([
                this.fetchJson(MapConfig.GIDS.POINTS),
                this.fetchJson(MapConfig.GIDS.LEGEND),
                this.fetchJson(MapConfig.GIDS.HEADER)
            ]);

            // 도움말 및 범례 생성
            if (hRows) HelpManager.init(hRows);
            if (lRows) this.renderLegend(lRows);

            // 4. 학교 마커 생성 및 클러스터 추가
            const processedPositions = [];
            const collisionThreshold = 0.0005; 

            pRows.forEach((row, index) => {
                const c = row.c;
                if (!c || !c[1]?.v) return;

                const p = {
                    type: c[3]?.v, name: c[4]?.v, adrs: c[5]?.v,
                    stdnt_cnt: c[6]?.v, stdnt_per_cl: c[7]?.v, tchr_cnt: c[8]?.v, stdnt_per_tchr: c[9]?.v,
                    shape: c[10]?.v || '●', color: c[11]?.v || '#333', url: c[13]?.v,
                    class_cnt: c[14]?.v, principal: c[16]?.v, vice_principal: c[17]?.v, chief_of_administration: c[18]?.v
                };

                const jitterRange = 0.00015;
                let lat = parseFloat(c[1].v) + (Math.random() - 0.5) * jitterRange;
                let lng = parseFloat(c[2].v) + (Math.random() - 0.5) * jitterRange;

                let isColliding = false;
                for (const pos of processedPositions) {
                    const dist = Math.sqrt(Math.pow(lat - pos.lat, 2) + Math.pow(lng - pos.lng, 2));
                    if (dist < collisionThreshold) {
                        isColliding = true;
                        break; 
                    }
                }
                processedPositions.push({lat, lng});

                const m = MapManager.createMarker(lat, lng, p, index, isColliding);
                MapManager.markers.push(m);
                MapManager.cluster.addLayer(m);
            });

            // 5. 부가 레이어 로드
            await MapManager.loadBoundaries();
            MapManager.addDistrictButtons();

            console.log("앱 초기화 완료.");
        } catch (e) { 
            console.error("데이터 로드 중 오류 발생:", e); 
        }
    },

    async fetchJson(gid) {
        const res = await fetch(`https://docs.google.com/spreadsheets/d/${MapConfig.SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}`);
        const txt = await res.text();
        // 구글 시트 JSON 콜백 데이터 파싱
        return JSON.parse(txt.substring(47).slice(0, -2)).table.rows;
    },

    renderLegend(rows) {
        const container = document.getElementById('legend');
        if (!container) return;
        container.innerHTML = '<div class="legend-item" onclick="location.reload()" style="cursor:pointer;font-weight:bold;margin-bottom:8px;color:#00427a;">⏪ 전체 보기</div>';
        
        rows.forEach(row => {
            const type = row.c[1]?.v;
            if (!type) return;
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `<span style="color:${row.c[3]?.v || '#333'}">${row.c[2]?.v || '●'}</span>${type}`;
            item.onclick = () => {
                MapManager.cluster.clearLayers();
                MapManager.markers.filter(m => m.properties.type === type).forEach(m => MapManager.cluster.addLayer(m));
            };
            container.appendChild(item);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
