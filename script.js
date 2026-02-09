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
                const inputEl = document.getElementById('schoolSearch');
                inputEl.value = m.properties.name;
                inputEl.blur(); 
            };
            container.appendChild(div);
        });
        container.style.display = 'block';
    }
};

// [수정] 거리 재기 매니저 (토글 기능 및 안내 메시지 강화)
const DistanceManager = {
    active: false,
    markers: [],
    polylines: [],
    totalDist: 0,

    toggle() {
        this.active = !this.active;
        const btn = document.getElementById('btn-measure');
        const mapContainer = document.getElementById('map');
        
        if (this.active) {
            btn.style.backgroundColor = '#e74c3c';
            btn.style.color = 'white';
            btn.innerText = '📏 거리 재기 끄기';
            mapContainer.classList.add('cursor-crosshair');
            MapManager.map.on('click', this.onClick.bind(this));
            
            // 모바일과 PC 구분하여 안내 메시지
            if (window.innerWidth <= 768) {
                alert("지도를 터치하여 거리를 측정하세요.\n종료하려면 '거리 재기 끄기' 버튼을 누르세요.");
            } else {
                alert("지도를 클릭하여 거리를 측정하세요.\n오른쪽 클릭하면 취소됩니다.");
            }
        } else {
            this.reset();
        }
    },

    reset() {
        this.active = false;
        const btn = document.getElementById('btn-measure');
        const mapContainer = document.getElementById('map');
        
        // 스타일 원복 (버튼이 사라지지 않음)
        btn.style.backgroundColor = 'white';
        btn.style.color = '#333';
        btn.innerText = '📏 거리재기';
        
        mapContainer.classList.remove('cursor-crosshair');
        
        this.markers.forEach(m => MapManager.map.removeLayer(m));
        this.polylines.forEach(p => MapManager.map.removeLayer(p));
        this.markers = [];
        this.polylines = [];
        this.totalDist = 0;
        
        MapManager.map.off('click', this.onClick.bind(this));
    },

    onClick(e) {
        if (!this.active) return;
        const latlng = e.latlng;
        
        const marker = L.circleMarker(latlng, { radius: 5, color: 'red', fillColor: 'white', fillOpacity: 1 }).addTo(MapManager.map);
        this.markers.push(marker);

        if (this.markers.length > 1) {
            const prev = this.markers[this.markers.length - 2].getLatLng();
            const curr = latlng;
            const dist = prev.distanceTo(curr);
            this.totalDist += dist;

            const line = L.polyline([prev, curr], { color: 'red', weight: 2, dashArray: '5, 5' }).addTo(MapManager.map);
            this.polylines.push(line);

            const distText = this.totalDist > 1000 
                ? (this.totalDist / 1000).toFixed(2) + " km" 
                : Math.round(this.totalDist) + " m";

            marker.bindTooltip(distText, { permanent: true, direction: 'right', className: 'dist-tooltip' }).openTooltip();
        } else {
             marker.bindTooltip("시작", { permanent: true, direction: 'right' }).openTooltip();
        }
    }
};

const MapManager = {
    map: null,
    cluster: null,
    eduOfficeLayer: null,
    markers: [],
    boundaryGroup: L.layerGroup(),
    activeMarker: null, 

    init() {
        this.map = L.map('map', { zoomControl: false, minZoom: 10, maxZoom: 18, attributionControl: false });
        this.map.setView(MapConfig.MAP_CENTER, 11);
        this.map.setMaxBounds(MapConfig.BOUNDS);
        
        this.map.createPane('ultraTopPane');
        this.map.getPane('ultraTopPane').style.zIndex = 20000; 

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
        this.boundaryGroup.addTo(this.map);

        this.eduOfficeLayer = L.layerGroup().addTo(this.map);

        this.cluster = L.markerClusterGroup({
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            maxClusterRadius: 80, 
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
        // 우클릭 시 거리재기 리셋
        this.map.on('contextmenu', () => {
            if (DistanceManager.active) DistanceManager.reset();
        });
    },

    getMarkerIcon(p, stackIndex = 0, count = 1) {
        let typeClass = 'is-spec';
        let symbolChar = '◆';
        let symbolColor = p.color;
        let posClass = '';
        let labelPosClass = ''; 

        if (p.type.includes('교육') || p.name.includes('교육지원청')) {
            symbolChar = '🏢';
            typeClass = 'is-edu'; 
        }
        else if (p.name.includes('유치원')) { typeClass = 'is-kinder'; symbolChar = '∎'; }
        else if (p.name.includes('초등학교')) { typeClass = 'is-elem'; symbolChar = '▲'; }
        else if (p.name.includes('중학교')) { typeClass = 'is-mid'; symbolChar = '●'; }
        else if (p.name.includes('고등학교')) { typeClass = 'is-high'; symbolChar = '★'; }

        if (count > 1) {
            if (stackIndex === 0) {
                posClass = 'shift-up';
            } else {
                if (stackIndex === 1) posClass = 'shift-down'; 
                else if (stackIndex === 2) posClass = 'shift-left'; 
                else posClass = 'shift-right';
                
                labelPosClass = 'label-bottom';
            }
        }
        const safeName = p.name.replace(/'/g, "\\'");
        const html = `
            <div class="custom-combined-marker ${typeClass} ${posClass}"
                 style="z-index: ${500 - stackIndex};"
                 onclick="MapManager.triggerMarkerPopup(event, '${safeName}')">
                <div class="marker-label-box ${labelPosClass}" 
                     onclick="MapManager.triggerMarkerPopup(event, '${safeName}')">
                     ${p.name}
                </div>
                <div class="marker-symbol" style="color:${symbolColor};">
                    ${symbolChar}
                </div>
            </div>
        `;
        return L.divIcon({ className: 'marker-container-icon', html, iconSize: [0, 0] });
    },

bindEvents() {
        // 1. 줌 레벨 변경 이벤트
        this.map.on('zoomend', () => {
            const zoom = this.map.getZoom();
            document.querySelectorAll('.dist-stat-btn').forEach(btn => btn.className = `dist-stat-btn zoom-lv-${zoom}`);
            
            const mapContainer = this.map.getContainer();
            if (zoom >= 15) mapContainer.classList.add('view-labels-mode');
            else mapContainer.classList.remove('view-labels-mode');
        });

        // 2. 행정구역 경계 토글
        const toggleBtn = document.getElementById('toggle-boundary');
        if (toggleBtn) {
            toggleBtn.addEventListener('change', (e) => {
                if (e.target.checked) this.map.addLayer(this.boundaryGroup);
                else this.map.removeLayer(this.boundaryGroup);
            });
        }

        // 3. 즐겨찾기 필터 토글
        const favOnlyBtn = document.getElementById('toggle-favorite-only');
        if (favOnlyBtn) {
            favOnlyBtn.addEventListener('change', (e) => {
                this.filterFavorites(e.target.checked);
            });
        }

        // 4. [핵심 수정] 팝업 열림 이벤트 (메모 로딩 순서 최적화)
        this.map.on('popupopen', async (e) => {
            const popupNode = e.popup.getElement();
            const textarea = popupNode.querySelector('textarea[id^="memo-"]');
            const saveBtn = popupNode.querySelector('.memo-save-btn');
            const delBtn = popupNode.querySelector('.memo-del-btn');
            const favBtn = popupNode.querySelector('.fav-toggle-btn');

            if (textarea && saveBtn) {
                const schoolName = textarea.id.replace('memo-', '');
                const isLoggedIn = AuthManager.userId !== null;

                // [수정 포인트 1] 서버 응답을 기다리지 않고, UI부터 즉시 활성화/비활성화 처리
                textarea.disabled = !isLoggedIn;
                saveBtn.disabled = !isLoggedIn;
                saveBtn.style.backgroundColor = isLoggedIn ? '#4A90E2' : '#ccc';

                // [추가] 삭제 버튼 상태 제어
                if (delBtn) {
                    delBtn.disabled = !isLoggedIn;
                    delBtn.style.backgroundColor = isLoggedIn ? '#e74c3c' : '#ccc'; // 활성 시 빨간색
                }

                if (isLoggedIn) {
                    // [수정 포인트 2] 즐겨찾기는 "백그라운드"에서 실행 (메모 로딩을 방해하지 않음)
                    if (favBtn) {
                        fetch(`/api/favorite/${encodeURIComponent(schoolName)}`)
                            .then(res => res.json())
                            .then(data => this.updateFavoriteUI(schoolName, data.isFavorite))
                            .catch(err => console.log("즐겨찾기 확인 실패"));
                    }

                    // [수정 포인트 3] 메모 로딩 시작
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
    },

    // 즐겨찾기 필터링 로직 (참고 파일 로직 반영)
    async filterFavorites(showOnlyFav) {
    // 1. 로그인이 안 되어있는데 즐겨찾기 보기를 켰을 때 방어
    if (showOnlyFav && !AuthManager.userId) {
        alert("로그인이 필요한 기능입니다.");
        const toggle = document.getElementById('toggle-favorite-only');
        if(toggle) toggle.checked = false; // 스위치 끄기
        return;
    }

    try {
        let favoriteNames = [];
        // 2. 즐겨찾기 보기 모드면 서버에서 목록 가져오기
        if (showOnlyFav) {
            const res = await fetch('/api/my-favorites');
            const data = await res.json();
            favoriteNames = data.favorites || [];
        }

        // 3. 기존 마커들 싹 지우고 다시 그리기 준비
        this.cluster.clearLayers();
        this.eduOfficeLayer.clearLayers();

        // 4. 모든 마커를 검사해서 조건에 맞는 것만 지도에 추가
        this.markers.forEach(marker => {
            const isEdu = marker.properties.type.includes('교육'); // 교육청 등은 별도 처리
            const isFav = favoriteNames.includes(marker.properties.name);

            // 조건: (전체보기 모드) 또는 (즐겨찾기 모드이면서 즐겨찾기 목록에 있는 경우)
            if (!showOnlyFav || isFav) {
                if (isEdu) this.eduOfficeLayer.addLayer(marker);
                else this.cluster.addLayer(marker);
            }
        });
    } catch(err) {
        console.error(err);
        alert("목록을 불러오는데 실패했습니다.");
        const toggle = document.getElementById('toggle-favorite-only');
        if(toggle) toggle.checked = false;
    }
    },

    async toggleFavorite(schoolName, event) {
        if (event) event.stopPropagation();
        if (AuthManager.userId === null) { alert("로그인 후 이용 가능합니다."); return; }
        try {
            const res = await fetch('/api/favorite/toggle', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({schoolName})
            });
            const data = await res.json();
            if (data.success) this.updateFavoriteUI(schoolName, data.isFavorite);
        } catch(err) { alert("즐겨찾기 변경 실패"); }
    },

    updateFavoriteUI(schoolName, isFavorite) {
        const favBtn = document.getElementById(`fav-btn-${schoolName}`);
        if (favBtn) {
            favBtn.innerText = isFavorite ? "★": "☆";
            favBtn.style.color = isFavorite ? "gold": "#ccc";
        }
    },

    createMarker(lat, lng, p, stackIndex = 0, count = 1) {
        const isMobile = window.innerWidth <= 768;
        const autoPanPaddingVal = isMobile ? L.point(160, 50) : L.point(80, 50);
        const marker = L.marker([lat, lng], {
            icon: this.getMarkerIcon(p, stackIndex, count),
            zIndexOffset: 100 - stackIndex * 10
        }).bindPopup(this.makePopupHtml(p), {
            className: 'custom-popup',
            pane: 'ultraTopPane', 
            autoPanPadding: L.point(20, 20),
            autoPanPaddingTopLeft: autoPanPaddingVal 
        });
        marker.properties = p;
        marker.on('click', () => {
             if (this.activeMarker) this.activeMarker.setZIndexOffset(100); 
             marker.setZIndexOffset(10000); 
             this.activeMarker = marker;
        });
        return marker;
    },

    triggerMarkerPopup(e, name) {
        if (e) { e.stopPropagation(); }
        const target = this.markers.find(m => m.properties.name === name);
        if (target) { 
            if (this.activeMarker) this.activeMarker.setZIndexOffset(100);
            target.setZIndexOffset(10000);
            this.activeMarker = target;
            target.openPopup(); 
        }
    },

    focusMarker(m) {
        this.map.flyTo(m.getLatLng(), 16, { duration: 1.5 });
        this.map.once('moveend', () => {
            if (this.activeMarker) this.activeMarker.setZIndexOffset(100);
            m.setZIndexOffset(10000);
            this.activeMarker = m;
            m.openPopup();
        });
    },

    makePopupHtml(p) {
        const isEduOffice = (p.type && p.type.includes('교육')) || p.name.includes('교육지원청');
        let principalName = p.principal;
        if (!principalName || principalName === 'No Data' || principalName.trim() === '') principalName = '정보 없음'; 
        
        const linkHtml = p.url 
            ? `<a href="${p.url}" target="_blank" class="popup-link-top" title="새 창으로 열기">🏠 홈페이지 이동 ↗</a>` 
            : '<span class="popup-link-none">❌ 홈페이지 없음</span>';
            
        const isLoggedIn = AuthManager.userId !== null;
        
        // 버튼 색상 및 활성 상태 설정
        const btnBg = isLoggedIn ? '#4A90E2' : '#ccc';
        const delBtnBg = isLoggedIn ? '#e74c3c' : '#ccc';
        const btnDisabled = isLoggedIn ? '' : 'disabled';
        
        const estBadge = p.establish ? `<span class="badge-est">${p.establish}</span>` : '';
        
        let bodyContent = '';
        if (isEduOffice) {
            bodyContent = `
                <div style="background:#e3f2fd; padding:12px; border-radius:8px; text-align:center; margin-bottom:15px; border:1px solid #bbdefb;">
                    <span style="font-size:12px; color:#555; display:block; margin-bottom:4px;">교육장</span>
                    <strong style="font-size:18px; color:#0d47a1;">${principalName}</strong>
                </div>
                <div style="text-align:center; color:#555; margin-bottom:15px; font-weight:bold; font-size:13px; line-height:1.5;">
                    행복한 성장, 함께하는 화성오산 교육
                </div>`;
        } else {
            const vicePrincipal = p.vice_principal || '-';
            const chiefAdmin = p.chief_of_administration || '-';
            bodyContent = `
                <div class="popup-admin-row">
                    <span>교장(원장) <strong>${principalName}</strong></span><span class="divider">|</span>
                    <span>교감(원감) <strong>${vicePrincipal}</strong></span><span class="divider">|</span>
                    <span>행정실장 <strong>${chiefAdmin}</strong></span>
                </div>
                <ul class="popup-info-list grid-list">
                    <li><span class="label">학생 수</span> <span class="value"><strong>${Number(p.stdnt_cnt || 0).toLocaleString()}</strong>명</span></li>
                    <li><span class="label">교사 수</span> <span class="value"><strong>${p.tchr_cnt || 0}</strong>명</span></li>
                    <li><span class="label">학급 수</span> <span class="value"><strong>${p.class_cnt || 0}</strong>개</span></li>
                    <li><span class="label">학급당 학생 수</span> <span class="value"><strong>${p.stdnt_per_cl || 0}</strong>명</span></li>
                    <li><span class="label">교사 1인당 학생 수</span> <span class="value"><strong>${p.stdnt_per_tchr || 0}</strong>명</span></li>
                </ul>`;
        }

        return `
            <div class="popup-content compact-mode">
                <div class="popup-header">
                    <div class="popup-category">${p.type || '교육기관'} ${estBadge}</div>
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
                ${bodyContent}
                <div class="memo-section" style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ccc;">
                    <div style="font-weight: bold; font-size: 13px; margin-bottom: 5px;">🏫 개인 메모</div>
                    <textarea id="memo-${p.name}" 
                        style="width: 100%; height: 50px; border: 1px solid #ddd; border-radius: 4px; padding: 5px; font-size: 12px; resize: none;"
                        placeholder="${isLoggedIn ? '메모를 불러오는 중...' : '로그인 후 이용 가능합니다'}"
                        disabled></textarea>
                    
                    <div style="display: flex; gap: 5px; margin-top: 5px;">
                        <button id="btn-save-${p.name}" class="memo-save-btn"
                            onclick="AuthManager.saveMemo('${p.name}', event)" 
                            style="flex: 1; background-color: ${btnBg}; color: white; border: none; padding: 5px; border-radius: 4px; cursor: pointer;"
                            ${btnDisabled}>
                            저장
                        </button>
                        <button id="btn-del-${p.name}" class="memo-del-btn"
                            onclick="AuthManager.deleteMemo('${p.name}', event)" 
                            style="flex: 1; background-color: ${delBtnBg}; color: white; border: none; padding: 5px; border-radius: 4px; cursor: pointer;"
                            ${btnDisabled}>
                            삭제
                        </button>
                    </div>
                </div>
            </div>`;
    },

    // [수정 2] 이벤트 연결 함수 (토글 기능, 메모 UI 즉시 활성화 포함)
    bindEvents() {
        // 1. 줌 레벨 변경 이벤트
        this.map.on('zoomend', () => {
            const zoom = this.map.getZoom();
            document.querySelectorAll('.dist-stat-btn').forEach(btn => btn.className = `dist-stat-btn zoom-lv-${zoom}`);
            
            const mapContainer = this.map.getContainer();
            if (zoom >= 15) mapContainer.classList.add('view-labels-mode');
            else mapContainer.classList.remove('view-labels-mode');
        });

        // 2. 행정구역 경계 토글
        const toggleBtn = document.getElementById('toggle-boundary');
        if (toggleBtn) {
            toggleBtn.addEventListener('change', (e) => {
                if (e.target.checked) this.map.addLayer(this.boundaryGroup);
                else this.map.removeLayer(this.boundaryGroup);
            });
        }

        // 3. 즐겨찾기 필터 토글
        const favOnlyBtn = document.getElementById('toggle-favorite-only');
        if (favOnlyBtn) {
            favOnlyBtn.addEventListener('change', (e) => {
                this.filterFavorites(e.target.checked);
            });
        }

        // 4. 팝업 열림 이벤트 (메모 로딩 순서 최적화 + 삭제 버튼 처리)
        this.map.on('popupopen', async (e) => {
            const popupNode = e.popup.getElement();
            const textarea = popupNode.querySelector('textarea[id^="memo-"]');
            const saveBtn = popupNode.querySelector('.memo-save-btn');
            const delBtn = popupNode.querySelector('.memo-del-btn');
            const favBtn = popupNode.querySelector('.fav-toggle-btn');

            if (textarea && saveBtn) {
                const schoolName = textarea.id.replace('memo-', '');
                const isLoggedIn = AuthManager.userId !== null;

                // [중요] UI부터 즉시 활성화/비활성화 (서버 대기 없음)
                textarea.disabled = !isLoggedIn;
                saveBtn.disabled = !isLoggedIn;
                saveBtn.style.backgroundColor = isLoggedIn ? '#4A90E2' : '#ccc';
                
                if (delBtn) {
                    delBtn.disabled = !isLoggedIn;
                    delBtn.style.backgroundColor = isLoggedIn ? '#e74c3c' : '#ccc';
                }

                if (isLoggedIn) {
                    // 즐겨찾기는 백그라운드에서 확인
                    if (favBtn) {
                        fetch(`/api/favorite/${encodeURIComponent(schoolName)}`)
                            .then(res => res.json())
                            .then(data => this.updateFavoriteUI(schoolName, data.isFavorite))
                            .catch(err => console.log("즐겨찾기 확인 실패"));
                    }

                    // 메모 로딩 시작
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

        L.popup({ className: 'custom-popup stat-popup', pane: 'ultraTopPane' }).setLatLng(latlng).setContent(`
            <div class="popup-content">
                <div class="popup-title" style="color:#4A90E2;">${fullName}</div>
                <hr class="popup-hr">
                <ul class="popup-info-list">
                    <li><span class="label">학교 수</span> <span class="value"><strong>${targets.length - 1}</strong>개교</span></li>
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

    // [신규] 메모 삭제 기능
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

    // [수정] UI 토글 (저장/삭제 버튼 모두 제어)
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
        
        // 팝업이 이미 열려있다면 즉시 반영
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
        
        // 저장 및 삭제 버튼들 일괄 제어
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

const FilterManager = {
    selectedTypes: new Set(),
    selectedDistricts: new Set(),
    selectedEst: new Set(),

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
        document.querySelectorAll('.est-tag').forEach(tag => {
            tag.onclick = () => {
                const est = tag.getAttribute('data-est');
                tag.classList.toggle('active');
                this.selectedEst.has(est) ? this.selectedEst.delete(est) : this.selectedEst.add(est);
            };
        });
    },

    open() { document.getElementById('search-dashboard').style.display = 'flex'; },
    close() { document.getElementById('search-dashboard').style.display = 'none'; },
    
    reset() {
        this.selectedTypes.clear();
        this.selectedDistricts.clear();
        this.selectedEst.clear(); 
        document.querySelectorAll('.filter-tag, .dist-tag, .est-tag').forEach(tag => tag.classList.remove('active'));
        document.getElementById('adv-name-input').value = '';
        const ids = ['min-s', 'max-s', 'min-c', 'max-c', 'min-t', 'max-t', 'min-sc', 'max-sc', 'min-st', 'max-st'];
        ids.forEach(id => {
            const el = document.getElementById(id); if(el) el.value = '';
        });
    },

    execute() {
        const nameQuery = document.getElementById('adv-name-input').value.trim();
        const getVal = (id, def) => {
            const val = document.getElementById(id)?.value;
            return (val === '' || val === null) ? def : Number(val);
        };
        
        const ranges = {
            s: [getVal('min-s', 0), getVal('max-s', Infinity)],      
            c: [getVal('min-c', 0), getVal('max-c', Infinity)],      
            t: [getVal('min-t', 0), getVal('max-t', Infinity)],      
            sc: [getVal('min-sc', 0), getVal('max-sc', Infinity)],   
            st: [getVal('min-st', 0), getVal('max-st', Infinity)]    
        };

        const filtered = MapManager.markers.filter(m => {
            const p = m.properties;
            const matchName = !nameQuery || p.name.includes(nameQuery);
            const matchType = this.selectedTypes.size === 0 || this.selectedTypes.has(p.type);
            const estVal = (p.establish || '').trim();
            const matchEst = this.selectedEst.size === 0 || Array.from(this.selectedEst).some(e => estVal === e);
            let matchDist = this.selectedDistricts.size === 0 || Array.from(this.selectedDistricts).some(distKey => {
                if (distKey === "오산시") return p.adrs.includes("오산시");
                return MapConfig.DISTRICTS[distKey]?.keywords?.some(k => p.adrs.includes(k));
            });

            const sVal = parseFloat(p.stdnt_cnt) || 0;
            const cVal = parseFloat(p.class_cnt) || 0;
            const tVal = parseFloat(p.tchr_cnt) || 0;
            const scVal = parseFloat(p.stdnt_per_cl) || 0;
            const stVal = parseFloat(p.stdnt_per_tchr) || 0;

            return matchName && matchType && matchDist && matchEst &&
                   (sVal >= ranges.s[0] && sVal <= ranges.s[1]) &&
                   (cVal >= ranges.c[0] && cVal <= ranges.c[1]) &&
                   (tVal >= ranges.t[0] && tVal <= ranges.t[1]) &&
                   (scVal >= ranges.sc[0] && scVal <= ranges.sc[1]) &&
                   (stVal >= ranges.st[0] && stVal <= ranges.st[1]);
        });

        this.close();
        if (filtered.length === 0) {
            alert("조건에 맞는 학교가 없습니다.");
        } else {
            if (filtered.length === 1) {
                const target = filtered[0];
                MapManager.map.flyTo(target.getLatLng(), 16, { duration: 1.5 });
                setTimeout(() => target.openPopup(), 1600);
            } else {
                ResultPageManager.open(filtered); 
            }
        }
    }
};

const ResultPageManager = {
    open(results) {
        const container = document.getElementById('results-list-container');
        const badge = document.getElementById('results-count-badge');
        if (badge) badge.innerText = results.length;
        if (!container) return;

        container.innerHTML = '';
        // 이름순 정렬
        [...results].sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'ko')).forEach(m => {
            const p = m.properties;
            
            let typeClass = '';
            if (p.type.includes('유치원')) typeClass = 'type-kinder';
            else if (p.type.includes('초등학교')) typeClass = 'type-elem';
            else if (p.type.includes('중학교')) typeClass = 'type-mid';
            else if (p.type.includes('고등학교')) typeClass = 'type-high';
            else if (p.type.includes('특수')) typeClass = 'type-spec';
            
            const card = document.createElement('div');
            card.className = 'result-card';
            card.innerHTML = `
                <div class="res-type ${typeClass}">${p.type} ${p.establish ? `· ${p.establish}` : ''}</div>
                <div class="res-name" title="${p.name}">${p.name}</div>
                <div class="res-addr" title="${p.adrs}">${p.adrs}</div>
            `;
            card.onclick = () => { this.close(); this.focusSchool(m); };
            container.appendChild(card);
        });
        document.getElementById('search-results-page').style.display = 'flex';
    },
    close() { document.getElementById('search-results-page').style.display = 'none'; },
    focusSchool(marker) {
        MapManager.map.flyTo(marker.getLatLng(), 16, { duration: 1 });
        setTimeout(() => marker.openPopup(), 1100);
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

const App = {
    async init() {
        console.log("앱 초기화 시작...");
        MapManager.init();
        FilterManager.init();
        SearchManager.init(); 
        await AuthManager.checkAuth();
        try {
            const [pRows, lRows, hRows] = await Promise.all([
                this.fetchJson(MapConfig.GIDS.POINTS),
                this.fetchJson(MapConfig.GIDS.LEGEND),
                this.fetchJson(MapConfig.GIDS.HEADER)
            ]);
            if (hRows) HelpManager.init(hRows);
            if (lRows) this.renderLegend(lRows);
            const groupedSchools = {};

            const parseNum = (val) => {
                if (typeof val === 'number') return val;
                if (!val) return 0;
                return parseFloat(String(val).replace(/,/g, '')) || 0;
            };

            pRows.forEach((row) => {
                const c = row.c;
                if (!c || !c[1] || !c[2]) return;
                const lat = parseFloat(c[1]?.v || 0);
                const lng = parseFloat(c[2]?.v || 0);
                const p = {
                    type: c[3]?.v || '', 
                    name: c[4]?.v || '이름 없음', 
                    adrs: c[5]?.v || '',
                    establish: (c[15]?.v || '').trim(),
                    stdnt_cnt: parseNum(c[6]?.v), 
                    stdnt_per_cl: parseNum(c[7]?.v), 
                    tchr_cnt: parseNum(c[8]?.v), 
                    stdnt_per_tchr: parseNum(c[9]?.v),
                    class_cnt: parseNum(c[14]?.v),
                    shape: c[10]?.v || '●', color: c[11]?.v || '#333', url: c[13]?.v,
                    principal: c[16]?.v || c[16]?.f,                 
                    vice_principal: c[17]?.v || c[17]?.f,            
                    chief_of_administration: c[18]?.v || c[18]?.f    
                };
                const locKey = lat.toFixed(5) + "," + lng.toFixed(5);
                if(!groupedSchools[locKey]) groupedSchools[locKey] = [];
                groupedSchools[locKey].push({lat, lng, p});
            });

            Object.values(groupedSchools).forEach(group => {
                group.sort((a, b) => {
                    const getRank = (name) => {
                        if(name.includes('교육')) return 0; 
                        if(name.includes('고등')) return 1;
                        if(name.includes('중학')) return 2;
                        if(name.includes('초등')) return 3;
                        if(name.includes('유치')) return 4;
                        return 5;
                    };
                    return getRank(a.p.name) - getRank(b.p.name);
                });
                const count = group.length;
                group.forEach((item, index) => {
                    const m = MapManager.createMarker(item.lat, item.lng, item.p, index, count);
                    MapManager.markers.push(m); 
                    if ((item.p.type && item.p.type.includes('교육')) || item.p.name.includes('교육지원청')) {
                        MapManager.eduOfficeLayer.addLayer(m);
                    } else {
                        MapManager.cluster.addLayer(m);
                    }
                });
            });
            await MapManager.loadBoundaries();
            MapManager.addDistrictButtons();
            console.log("앱 초기화 완료.");
        } catch (e) { console.error("데이터 로드 중 오류 발생:", e); }
    },
    async fetchJson(gid) {
        const res = await fetch(`https://docs.google.com/spreadsheets/d/${MapConfig.SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}`);
        const txt = await res.text();
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
