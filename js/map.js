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
        this.map.on('contextmenu', () => {
            if (window.DistanceManager && DistanceManager.active) DistanceManager.finish(); 
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
        this.map.on('zoomend', () => {
            const zoom = this.map.getZoom();
            document.querySelectorAll('.dist-stat-btn').forEach(btn => btn.className = `dist-stat-btn zoom-lv-${zoom}`);
            
            const mapContainer = this.map.getContainer();
            if (zoom >= 15) mapContainer.classList.add('view-labels-mode');
            else mapContainer.classList.remove('view-labels-mode');
        });

        const toggleBtn = document.getElementById('toggle-boundary');
        if (toggleBtn) {
            toggleBtn.addEventListener('change', (e) => {
                if (e.target.checked) this.map.addLayer(this.boundaryGroup);
                else this.map.removeLayer(this.boundaryGroup);
            });
        }

        const favOnlyBtn = document.getElementById('toggle-favorite-only');
        if (favOnlyBtn) {
            favOnlyBtn.addEventListener('change', (e) => {
                this.filterFavorites(e.target.checked);
            });
        }

        this.map.on('popupopen', async (e) => {
            const popupNode = e.popup.getElement();
            const textarea = popupNode.querySelector('textarea[id^="memo-"]');
            const saveBtn = popupNode.querySelector('.memo-save-btn');
            const delBtn = popupNode.querySelector('.memo-del-btn');
            const favBtn = popupNode.querySelector('.fav-toggle-btn');

            if (textarea && saveBtn) {
                const schoolName = textarea.id.replace('memo-', '');
                const isLoggedIn = AuthManager.userId !== null;

                textarea.disabled = !isLoggedIn;
                saveBtn.disabled = !isLoggedIn;
                saveBtn.style.backgroundColor = isLoggedIn ? '#4A90E2' : '#ccc';
                
                if (delBtn) {
                    delBtn.disabled = !isLoggedIn;
                    delBtn.style.backgroundColor = isLoggedIn ? '#e74c3c' : '#ccc';
                }

                if (isLoggedIn) {
                    if (favBtn) {
                        fetch(`/api/favorite/${encodeURIComponent(schoolName)}`)
                            .then(res => res.json())
                            .then(data => this.updateFavoriteUI(schoolName, data.isFavorite))
                            .catch(err => console.log("즐겨찾기 확인 실패"));
                    }

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

    async filterFavorites(showOnlyFav) {
        if (showOnlyFav && !AuthManager.userId) {
            alert("로그인이 필요한 기능입니다.");
            const toggle = document.getElementById('toggle-favorite-only');
            if(toggle) toggle.checked = false;
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
            this.eduOfficeLayer.clearLayers();

            this.markers.forEach(marker => {
                const isEdu = marker.properties.type.includes('교육');
                const isFav = favoriteNames.includes(marker.properties.name);

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
        
        // [수정] 학교가 아닌 것(교육지원청, 도서관 등 type에 '교육'이 들어간 것) 제외 필터링
        const targets = this.markers.filter(m => {
            const p = m.properties;
            const isSchool = !p.type.includes('교육') && !p.name.includes('교육지원청'); // 학교만 필터
            if (!isSchool) return false;

            const adrs = p.adrs || '';
            if (fullName === '화성시 전체') return adrs.includes('화성시');
            if (fullName === '오산시') return adrs.includes('오산시');
            return MapConfig.DISTRICTS[keyword]?.keywords?.some(k => adrs.includes(k));
        });

        // 통계 계산
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
                    <li><span class="label">학교 수</span> <span class="value"><strong>${targets.length}</strong>개교</span></li>
                    <li><span class="label">총 학생 수</span> <span class="value"><strong>${stats.s.toLocaleString()}</strong>명</span></li>
                    <li><span class="label">총 교사 수</span> <span class="value"><strong>${stats.t.toLocaleString()}</strong>명</span></li>
                </ul>
            </div>
        `).openOn(this.map);
    }
};