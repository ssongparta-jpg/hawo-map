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
        
        // z-index와 동적 색상만 인라인으로 남김 (나머지는 클래스 처리)
        const html = `
            <div class="custom-combined-marker ${typeClass} ${posClass}" style="z-index: ${500 - stackIndex};" onclick="MapManager.triggerMarkerPopup(event, '${safeName}')">
                <div class="marker-label-box ${labelPosClass}" onclick="MapManager.triggerMarkerPopup(event, '${safeName}')">${p.name}</div>
                <div class="marker-symbol" style="color:${symbolColor};">${symbolChar}</div>
            </div>
        `;
        return L.divIcon({ className: 'marker-container-icon', html, iconSize: [0, 0] });
    },

    bindEvents() {
        this.map.on('zoomend', () => {
            const zoom = this.map.getZoom();
            
            // 👇 [핵심 버그 수정] 기존 디자인 클래스를 날려버리지 않고, 오직 zoom-lv-* 클래스만 쏙 골라서 교체합니다!
            document.querySelectorAll('.dist-stat-btn').forEach(btn => {
                btn.classList.forEach(cls => {
                    if (cls.startsWith('zoom-lv-')) btn.classList.remove(cls);
                });
                btn.classList.add(`zoom-lv-${zoom}`);
            });
            
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
                if (delBtn) delBtn.disabled = !isLoggedIn;

                // [리팩토링] 하드코딩 스타일 대신 클래스로 제어
                if (isLoggedIn) {
                    saveBtn.classList.remove('disabled-btn');
                    if (delBtn) delBtn.classList.remove('disabled-btn');
                    
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
                    saveBtn.classList.add('disabled-btn');
                    if (delBtn) delBtn.classList.add('disabled-btn');
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
            // [리팩토링] 하드코딩 색상 대신 active 클래스 사용
            if (isFavorite) favBtn.classList.add('active');
            else favBtn.classList.remove('active');
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
            
        const estBadge = p.establish ? `<span class="badge-est">${p.establish}</span>` : '';
        
        // [리팩토링] 인라인 스타일 걷어내고 시맨틱 태그 및 클래스 적용
        let bodyContent = '';
        if (isEduOffice) {
            bodyContent = `
                <div class="edu-office-box">
                    <span class="edu-office-label">교육장</span>
                    <strong class="edu-office-name">${principalName}</strong>
                </div>
                <div class="edu-office-slogan">행복한 성장, 함께하는 화성오산 교육</div>`;
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
                <div class="popup-title-row">
                    <h3 class="popup-title">${p.name || ''}</h3>
                    <button id="fav-btn-${p.name}" class="fav-toggle-btn" onclick="MapManager.toggleFavorite('${p.name}', event)">☆</button>
                </div>
                <div class="popup-adrs">${p.adrs || ''}</div>
                <hr class="popup-hr">
                ${bodyContent}
                
                <div class="memo-section">
                    <div class="memo-title">🏫 개인 메모</div>
                    <textarea id="memo-${p.name}" class="memo-textarea" disabled></textarea>
                    <div class="memo-btn-group">
                        <button id="btn-save-${p.name}" class="memo-btn memo-save-btn disabled-btn" onclick="AuthManager.saveMemo('${p.name}', event)" disabled>저장</button>
                        <button id="btn-del-${p.name}" class="memo-btn memo-del-btn disabled-btn" onclick="AuthManager.deleteMemo('${p.name}', event)" disabled>삭제</button>
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
                    let hwaseongBorder = '#0047AB';
                    let osanBorder = '#e7733d';
                    
                    if (MapConfig.CustomColors && MapConfig.CustomColors.general) {
                        hwaseongBorder = MapConfig.CustomColors.general.hwaseongBorder;
                        osanBorder = MapConfig.CustomColors.general.osanBorder;
                    }

                    const col = sgg === '화성시' ? hwaseongBorder : sgg === '오산시' ? osanBorder : 'transparent';
                    return { fill: false, color: col, weight: 3, pane: 'boundaryPane' };
                }
            }).addTo(this.boundaryGroup);
        } catch (e) { console.error('경계 로드 실패'); }
    },

    addDistrictButtons() {
        Object.entries(MapConfig.DISTRICTS).forEach(([key, conf]) => {
            if (!conf.pos) return;
            
            let labelName = conf.fullName;
            if (['동탄구', '병점구', '효행구', '만세구'].includes(key)) {
                labelName = key; 
            }
            
            const icon = L.divIcon({
                className: 'district-stat-marker',
                html: `
                    <div class="dist-stat-btn zoom-lv-${this.map.getZoom()}" style="background-color:${conf.color} !important;">
                        <span class="dist-stat-label">${labelName}</span>
                    </div>
                `,
                iconSize: [120, 36]
            });

            // zIndexOffset을 높게 주어 다른 마커들에 파묻히지 않게 고정합니다.
            L.marker(conf.pos, { icon, zIndexOffset: 5000 }).addTo(this.map).on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                this.showDistrictStats(key, conf);
            });
        });
    },

    showDistrictStats(regionKey, config) {
        const keywords = config.keywords || [];
        
        const regionMarkers = this.markers.filter(m => {
            const p = m.properties || {};
            let adrs = String(p.adrs || p.address || p['주소'] || p['학교주소'] || "");
            if (!adrs.trim()) adrs = Object.values(p).join(" ");
            
            if (regionKey === '화성시') return adrs.includes('화성');
            if (regionKey === '오산시') return adrs.includes('오산');
            return keywords.some(kw => adrs.includes(kw));
        });

        const totalSchools = regionMarkers.length;
        let totalStudents = 0;
        let totalTeachers = 0;

        regionMarkers.forEach(m => {
            const p = m.properties || {};
            totalStudents += (p.stdnt_cnt || 0);
            totalTeachers += (p.tchr_cnt || 0);
        });

        const fmt = (num) => num.toLocaleString('ko-KR');

        const popupContent = `
            <div class="stat-popup-card">
                <div class="stat-popup-header" style="border-bottom-color: ${config.color};">
                    <span class="stat-popup-title">${config.fullName}</span>
                    <span class="stat-popup-badge" style="background:${config.color};">총 ${fmt(totalSchools)}개교</span>
                </div>
                
                <div class="stat-popup-body">
                    <div class="stat-row border-orange">
                        <span class="stat-label">학교 수</span>
                        <span class="stat-value">${fmt(totalSchools)}<span class="stat-unit">개교</span></span>
                    </div>
                    <div class="stat-row border-green">
                        <span class="stat-label">총 학생 수</span>
                        <span class="stat-value">${fmt(totalStudents)}<span class="stat-unit">명</span></span>
                    </div>
                    <div class="stat-row border-blue">
                        <span class="stat-label">총 교사 수</span>
                        <span class="stat-value">${fmt(totalTeachers)}<span class="stat-unit">명</span></span>
                    </div>
                </div>

                <div class="stat-popup-footer">
                    <button class="btn-focus-region" onclick="MapManager.focusRegion('${regionKey}')">
                        이 지역으로 지도 이동 🔍
                    </button>
                </div>
            </div>
        `;

        // 팝업이 증발하지 않도록 가장 확실하고 안전한 기본 방식으로 띄웁니다.
        L.popup({
            className: 'custom-stat-popup',
            closeButton: true,
            offset: L.point(0, -20),
            autoPan: true
        })
        .setLatLng(config.pos)
        .setContent(popupContent)
        .openOn(this.map);
    },

    focusRegion(key) {
        const conf = MapConfig.DISTRICTS[key];
        if (conf && conf.pos) {
            this.map.setView(conf.pos, 14);
            this.map.closePopup();
        }
    }
};