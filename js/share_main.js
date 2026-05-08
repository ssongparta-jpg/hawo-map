const ShareApp = {
    async init() {
        MapManager.init();
        DistanceManager.init(); 
        await AuthManager.checkAuth();
        
        // [핵심] 겹치는 마커들의 라벨이 절대 가려지지 않도록 하는 CSS 동적 삽입
        const shareStyle = document.createElement('style');
        shareStyle.innerHTML = `
            /* 겹친 마커(is-stacked)는 라벨을 기호의 우측에 리스트처럼 배치 */
            .is-stacked .marker-label-box {
                bottom: auto !important;
                top: 0 !important;
                left: 14px !important;
                transform: translateY(-50%) !important;
                white-space: nowrap !important;
            }
            .view-labels-mode .is-stacked .marker-label-box {
                transform: translateY(-50%) !important;
            }
        `;
        document.head.appendChild(shareStyle);

        // 행정구역 버튼 클릭 시 아무 일도 일어나지 않게 오버라이드
        MapManager.showDistrictStats = function() {
            console.log("공유학교 모드: 행정구역 통계 팝업 비활성화");
        };

        MapManager.map.on('zoomend', () => {
            const zoom = MapManager.map.getZoom();
            const mapContainer = MapManager.map.getContainer();
            if (zoom >= 14) mapContainer.classList.add('view-labels-mode');
            else mapContainer.classList.remove('view-labels-mode');
        });
        if (MapManager.map.getZoom() >= 14) MapManager.map.getContainer().classList.add('view-labels-mode');

        MapManager.map.removeLayer(MapManager.cluster);
        MapManager.cluster = L.markerClusterGroup({
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            maxClusterRadius: 60, 
            disableClusteringAtZoom: 13, 
            singleMarkerMode: false,
            iconCreateFunction: (cluster) => {
                const count = cluster.getChildCount();
                let cSize = count >= 3 ? 'red' : 'small'; 
                return L.divIcon({
                    html: `<div><span>${count}</span></div>`,
                    className: `marker-cluster marker-cluster-${cSize}`,
                    iconSize: [40, 40]
                });
            }
        }).addTo(MapManager.map);

        const SHARE_GID = '1582242290';
        
        try {
            const [rows, hRows] = await Promise.all([
                this.fetchJson(SHARE_GID),
                this.fetchJson(MapConfig.GIDS.HEADER)
            ]);
            
            if (hRows) {
                HelpManager.init(hRows);
                const titleEl = document.getElementById('header-title');
                if (titleEl) titleEl.innerText = '경기도 화성오산 공유학교 지도';
            }
            
            // 오산시 버튼 좌표 이동
            MapConfig.DISTRICTS = {
                "화성시": { pos: [37.185, 126.915], color: "#4A90E2", fullName: "화성시 전체", keywords: ['화성'] },
                "오산시": { pos: [37.145, 127.080], color: "#FF6392", fullName: "오산시", keywords: ['오산'] } 
            };

            const groupedSchools = {};

            rows.forEach((row) => {
                const c = row.c;
                if (!c || c[3]?.v === 'name') return; 
                
                const lat = parseFloat(c[0]?.v);
                const lng = parseFloat(c[1]?.v);
                
                if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;
                
                const adrs = c[4]?.v || '';
                let region = '기타';
                if (adrs.includes('화성')) region = '화성시';
                if (adrs.includes('오산')) region = '오산시';

                const p = {
                    type: c[2]?.v || '공유학교',
                    name: c[3]?.v || '이름 없음',
                    adrs: adrs,
                    duration: c[5]?.v || '-',
                    target: c[6]?.v || '-',
                    place: c[7]?.v || '-',
                    activity: c[8]?.v || '-',
                    shape: c[9]?.v || '●',
                    color: c[10]?.v || '#8E44AD',
                    region: region
                };
                
                // 좌표 묶기
                const locKey = lat.toFixed(5) + "," + lng.toFixed(5);
                if(!groupedSchools[locKey]) groupedSchools[locKey] = [];
                groupedSchools[locKey].push({lat, lng, p});
            });

            // 마커 생성 및 렌더링
            Object.values(groupedSchools).forEach(group => {
                const count = group.length;
                group.forEach((item, index) => {
                    const m = this.createSharedMarker(item.lat, item.lng, item.p, index, count);
                    MapManager.markers.push(m);
                    MapManager.cluster.addLayer(m);
                });
            });
            
            await MapManager.loadBoundaries();
            MapManager.addDistrictButtons(); 
            
            this.initLegend();
            this.initSearch();
        } catch (e) { console.error("데이터 로드 실패:", e); }
    },

    async fetchJson(gid) {
        const res = await fetch(`https://docs.google.com/spreadsheets/d/${MapConfig.SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}`);
        const txt = await res.text();
        return JSON.parse(txt.substring(47).slice(0, -2)).table.rows;
    },

    // [핵심] 수직 리스트형(Vertical Stacking) 마커 분리 로직
    createSharedMarker(lat, lng, p, stackIndex = 0, count = 1) {
        // 겹치는 개수가 2개 이상일 때 'is-stacked' 클래스 부여
        const stackedClass = count > 1 ? 'is-stacked' : '';
        
        // 28px 간격으로 아래로 차곡차곡 나열하며, 덩어리가 중앙에 오도록 Y 위치 보정
        const yOffset = count > 1 ? (stackIndex * 28) - ((count - 1) * 14) : 0; 

        const safeName = p.name.replace(/'/g, "\\'");
        
        const iconHtml = `
            <div class="custom-combined-marker is-shared ${stackedClass}" style="position: relative; z-index: ${100 - stackIndex}; top: ${yOffset}px;" onclick="MapManager.triggerMarkerPopup(event, '${safeName}')">
                <div class="marker-label-box" onclick="MapManager.triggerMarkerPopup(event, '${safeName}')">${p.name}</div>
                <div class="marker-symbol" style="color:${p.color}; font-size:18px;">${p.shape}</div>
            </div>
        `;
        const icon = L.divIcon({ className: 'marker-container-icon', html: iconHtml, iconSize: [0, 0] });

        const marker = L.marker([lat, lng], { icon: icon, zIndexOffset: 100 - stackIndex })
            .bindPopup(this.makeSharedPopupHtml(p), {
                className: 'custom-popup', pane: 'ultraTopPane', autoPanPadding: L.point(20, 20)
            });
            
        marker.properties = p;
        marker.on('click', () => {
             if (MapManager.activeMarker) MapManager.activeMarker.setZIndexOffset(100);
             marker.setZIndexOffset(10000);
             MapManager.activeMarker = marker;
        });
        return marker;
    },

    makeSharedPopupHtml(p) {
        const isLoggedIn = AuthManager.userId !== null;
        const btnBg = isLoggedIn ? '#4A90E2' : '#ccc';
        const delBtnBg = isLoggedIn ? '#e74c3c' : '#ccc';
        const btnDisabled = isLoggedIn ? '' : 'disabled';

        return `
            <div class="popup-content compact-mode">
                <div class="popup-header">
                    <div class="popup-category" style="color:${p.color}">${p.type}</div>
                </div>
                <div class="popup-title-row" style="display: flex; align-items: center; justify-content: space-between;">
                    <div class="popup-title" style="margin: 0;">${p.name}</div>
                    <button id="fav-btn-${p.name}" class="fav-toggle-btn"
                            onclick="MapManager.toggleFavorite('${p.name}', event)"
                            style="background:none; border:none; font-size: 20px; cursor: pointer; color: #ccc;">
                        ☆
                    </button>
                </div>
                <div class="popup-adrs" style="margin-bottom: 12px;">${p.adrs}</div>
                <hr class="popup-hr">
                
                <ul class="popup-info-list" style="display:block;">
                    <li style="margin-bottom:6px;"><span class="label" style="width:65px; display:inline-block;">진행장소</span> <span class="value" style="font-weight:bold;">${p.place}</span></li>
                    <li style="margin-bottom:6px;"><span class="label" style="width:65px; display:inline-block;">모집대상</span> <span class="value">${p.target}</span></li>
                    <li style="margin-bottom:6px;"><span class="label" style="width:65px; display:inline-block;">운영기간</span> <span class="value">${p.duration}</span></li>
                    <li style="align-items:flex-start; margin-top:8px;">
                        <span class="label" style="width:65px; display:inline-block; flex-shrink:0;">주요활동</span>
                        <span class="value" style="line-height:1.5; white-space:pre-wrap; word-break:keep-all;">${p.activity}</span>
                    </li>
                </ul>

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

    initLegend() {
        const container = document.createElement('div');
        container.id = 'share-legend';
        container.innerHTML = `
            <div class="legend-card">
                <div class="legend-header" id="shareLegendToggle">
                    <span class="legend-label">📍 지역 필터</span>
                    <span class="arrow-icon" id="shareLegendArrow">▼</span>
                </div>
                <div class="legend-content" id="shareLegendBody">
                    <div class="legend-reset-row" onclick="ShareApp.filterRegion('전체')">↺ 전체 보기</div>
                    <div class="legend-row" onclick="ShareApp.filterRegion('화성시')">
                        <span class="l-symbol" style="color:#4A90E2">●</span>
                        <span class="l-text">화성시</span>
                    </div>
                    <div class="legend-row" onclick="ShareApp.filterRegion('오산시')">
                        <span class="l-symbol" style="color:#FF6392">●</span>
                        <span class="l-text">오산시</span>
                    </div>
                </div>
            </div>
        `;
        document.querySelector('.container').appendChild(container);

        const toggleBtn = document.getElementById('shareLegendToggle');
        const body = document.getElementById('shareLegendBody');
        const arrow = document.getElementById('shareLegendArrow');
        
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            const isCollapsed = body.classList.toggle('collapsed');
            arrow.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
        };
    },

    filterRegion(region) {
        MapManager.cluster.clearLayers();
        MapManager.markers.forEach(m => {
            if (region === '전체' || m.properties.region === region) {
                MapManager.cluster.addLayer(m);
            }
        });
    },

    initSearch() {
        const input = document.getElementById('schoolSearch');
        const resultBox = document.getElementById('searchResults');
        
        input.addEventListener('keyup', (e) => {
            const val = e.target.value.trim();
            if (val.length < 1) { resultBox.style.display = 'none'; return; }
            
            const matches = MapManager.markers.filter(m => m.properties.name.includes(val));
            
            resultBox.innerHTML = '';
            matches.slice(0, 5).forEach(m => {
                const div = document.createElement('div');
                div.className = 'search-item';
                div.innerHTML = `<span>${m.properties.name}</span> <span style="font-size:11px; color:#8E44AD; font-weight:bold;">${m.properties.type}</span>`;
                div.onclick = () => {
                    MapManager.focusMarker(m);
                    resultBox.style.display = 'none';
                    input.value = m.properties.name;
                    input.blur();
                };
                resultBox.appendChild(div);
            });
            resultBox.style.display = matches.length > 0 ? 'block' : 'none';
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-wrapper')) resultBox.style.display = 'none';
        });
    }
};

// =========================================
// 거리재기 및 네이버 길찾기 연동 매니저
// =========================================
const DistanceManager = {
    active: false,
    isPaused: false,
    points: [],
    lines: [],
    markers: [],
    tempLine: null,
    totalDistance: 0,
    hoverTimer: null,

    init() {
        const style = document.createElement('style');
        style.innerHTML = `
            #btn-pause-measure {
                position: absolute; bottom: 30px; right: 120px; z-index: 1200;
                background: white; color: #333; border: 1px solid #ccc; padding: 8px 14px;
                border-radius: 20px; font-size: 13px; font-weight: bold; cursor: pointer;
                box-shadow: 0 2px 6px rgba(0,0,0,0.2); transition: all 0.2s; display: none;
            }
            #btn-pause-measure.paused { background: #f39c12; color: white; border-color: #e67e22; }
            
            .dist-tooltip { 
                pointer-events: auto !important; 
                cursor: pointer !important;
                border: 1px solid #e74c3c !important;
                background: white !important;
                color: #e74c3c !important;
                font-weight: bold !important;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
            }
            @media (max-width: 768px) { #btn-pause-measure { bottom: 70px; right: 105px; padding: 8px 12px; font-size: 12px; } }
        `;
        document.head.appendChild(style);

        const pauseBtn = document.createElement('button');
        pauseBtn.id = 'btn-pause-measure';
        pauseBtn.innerHTML = '⏸ 일시정지';
        const container = document.querySelector('.container') || document.body;
        container.appendChild(pauseBtn);

        document.addEventListener('click', (e) => {
            const pBtn = e.target.closest('#btn-pause-measure');
            if (pBtn) { e.preventDefault(); this.togglePause(); }
        });
        
        if (MapManager && MapManager.map) {
            MapManager.map.on('click', (e) => {
                if (this.active && !this.isPaused) this.addPoint(e.latlng);
            });
            MapManager.map.on('mousemove', (e) => {
                if (this.active && !this.isPaused && this.points.length > 0) this.drawTempLine(e.latlng);
            });
        }
    },

    toggle(btnElem) {
        this.active = !this.active;
        this.isPaused = false;
        const btn = btnElem || document.getElementById('btn-measure');
        const pauseBtn = document.getElementById('btn-pause-measure');
        const mapEl = document.getElementById('map');
        
        if (this.active) {
            if (btn) { btn.classList.add('active'); btn.innerHTML = '🛑 중단'; }
            if (pauseBtn) { pauseBtn.style.display = 'block'; pauseBtn.classList.remove('paused'); pauseBtn.innerHTML = '⏸ 일시정지'; }
            if (mapEl) mapEl.classList.add('cursor-crosshair');
            this.clearAll();
        } else {
            if (btn) { btn.classList.remove('active'); btn.innerHTML = '📏 거리재기'; }
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (mapEl) mapEl.classList.remove('cursor-crosshair');
            this.clearAll();
        }
    },

    togglePause() {
        if (!this.active) return;
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('btn-pause-measure');
        const mapEl = document.getElementById('map');
        if (this.isPaused) {
            pauseBtn.classList.add('paused');
            pauseBtn.innerHTML = '▶ 그리기 재개';
            if (mapEl) mapEl.classList.remove('cursor-crosshair');
            if (this.tempLine) { MapManager.map.removeLayer(this.tempLine); this.tempLine = null; }
        } else {
            pauseBtn.classList.remove('paused');
            pauseBtn.innerHTML = '⏸ 일시정지';
            if (mapEl) mapEl.classList.add('cursor-crosshair');
        }
    },

    addPoint(latlng) {
        this.points.push(latlng);
        const pIndex = this.points.length - 1; 
        
        if (this.points.length > 1) {
            const prev = this.points[this.points.length - 2];
            const dist = MapManager.map.distance(prev, latlng); 
            this.totalDistance += dist;
            const line = L.polyline([prev, latlng], { color: '#e74c3c', weight: 3, dashArray: '5, 5' }).addTo(MapManager.map);
            this.lines.push(line);
        }

        const marker = L.circleMarker(latlng, { radius: 7, color: '#c0392b', fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(MapManager.map);
        const distStr = this.formatDistance(this.totalDistance);
        
        const popupHtml = `
            <div id="route-popup-${pIndex}" style="text-align:center; padding:8px; min-width:180px;">
                <div style="font-weight:bold; font-size:13px; margin-bottom:8px; color:#333;">이 지점까지 길 찾기</div>
                <button onclick="DistanceManager.openNaverUpTo(${pIndex})" style="background:#03c75a; color:white; border:none; padding:8px 12px; border-radius:6px; font-weight:bold; cursor:pointer; width:100%;">네이버 지도 열기 ↗</button>
                <div style="color:#e74c3c; font-size:11px; margin-top:8px; font-weight:bold;">※ 경유지는 최대 5개 설정 가능합니다</div>
            </div>
        `;
        marker.bindPopup(popupHtml, { closeButton: false, autoClose: false, offset: [0, -5] });

        const tooltip = marker.bindTooltip(`<div class="tooltip-inner">${this.points.length === 1 ? '출발지' : distStr}</div>`, {
            permanent: true, direction: 'right', className: 'dist-tooltip', interactive: true
        }).openTooltip();

        const openAction = (e) => {
            clearTimeout(this.hoverTimer);
            marker.openPopup();
        };

        const closeAction = (e) => {
            this.hoverTimer = setTimeout(() => { marker.closePopup(); }, 600);
        };

        marker.on('mouseover', openAction).on('mouseout', closeAction);
        
        setTimeout(() => {
            const tooltipEl = tooltip.getTooltip().getElement();
            if (tooltipEl) {
                tooltipEl.addEventListener('mouseenter', openAction);
                tooltipEl.addEventListener('mouseleave', closeAction);
            }
        }, 50);

        marker.on('popupopen', (e) => {
            const node = e.popup.getElement();
            node.addEventListener('mouseenter', openAction);
            node.addEventListener('mouseleave', closeAction);
        });

        this.markers.push(marker);
    },

    drawTempLine(latlng) {
        if (this.tempLine) MapManager.map.removeLayer(this.tempLine);
        const lastPoint = this.points[this.points.length - 1];
        this.tempLine = L.polyline([lastPoint, latlng], { color: '#e74c3c', weight: 3, dashArray: '5, 5', opacity: 0.5 }).addTo(MapManager.map);
    },

    openNaverUpTo(endIndex) {
        if (endIndex < 1 || this.points.length < 2) return;
        
        let fullPath = this.points.slice(0, endIndex + 1);
        let finalPoints = [];

        if (fullPath.length <= 7) {
            finalPoints = fullPath;
        } else {
            finalPoints.push(fullPath[0]); 
            let mid = fullPath.slice(1, -1);
            let step = (mid.length - 1) / 4;
            for (let i = 0; i < 5; i++) finalPoints.push(mid[Math.round(i * step)]);
            finalPoints.push(fullPath[fullPath.length - 1]); 
        }
        
        const fmt = (p, name) => `${p.lng},${p.lat},${encodeURIComponent(name)}`;
        let url = "https://map.naver.com/p/directions/";

        const startPt = finalPoints[0];
        const endPt = finalPoints[finalPoints.length - 1];
        const waypoints = finalPoints.slice(1, -1); 

        if (waypoints.length === 0) {
            url += `${fmt(startPt, '출발지')}/${fmt(endPt, '도착지')}/car`;
        } else {
            const waypointsStr = waypoints.map((p, i) => fmt(p, `경유지${i + 1}`)).join(':');
            url += `${fmt(startPt, '출발지')}/${fmt(endPt, '도착지')}/${waypointsStr}/car`;
        }
        
        window.open(url, '_blank');
    },

    clearAll() {
        if (MapManager && MapManager.map) {
            this.lines.forEach(l => MapManager.map.removeLayer(l));
            this.markers.forEach(m => MapManager.map.removeLayer(m));
            if (this.tempLine) MapManager.map.removeLayer(this.tempLine);
        }
        this.lines = []; this.markers = []; this.points = [];
        this.totalDistance = 0; this.tempLine = null;
    },

    formatDistance(m) {
        return m < 1000 ? Math.round(m) + 'm' : (m / 1000).toFixed(1) + 'km';
    }
};

document.addEventListener('DOMContentLoaded', () => ShareApp.init());