const App = {
    async init() {
        console.log("앱 초기화 시작...");
        MapManager.init();
        FilterManager.init();
        SearchManager.init(); 
        DistanceManager.init();
        await MapConfig.loadCustomColors();
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

            // 데이터 파싱
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
                    shape: c[10]?.v || '●', 
                    color: c[11]?.v || '#333', 
                    url: c[13]?.v,
                    principal: c[16]?.v || c[16]?.f,                 
                    vice_principal: c[17]?.v || c[17]?.f,            
                    chief_of_administration: c[18]?.v || c[18]?.f    
                };
                
                const locKey = lat.toFixed(5) + "," + lng.toFixed(5);
                if(!groupedSchools[locKey]) groupedSchools[locKey] = [];
                groupedSchools[locKey].push({lat, lng, p});
            });

            // 마커 생성 (겹침 처리)
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
        
        // 여기에 예쁜 카드 형태의 HTML 구조를 통째로 렌더링합니다.
        container.innerHTML = `
            <div class="legend-card">
                <div class="legend-header" id="legendToggleBtn">
                    <span class="legend-label">📍 지도 범례</span>
                    <span class="arrow-icon" id="legendArrow">▼</span>
                </div>
                <div class="legend-content" id="legendBody">
                    <div class="legend-reset-row" onclick="location.reload()">↺ 전체 보기</div>
                    <div id="type-list-area"></div>
                </div>
            </div>
        `;

        const toggleBtn = document.getElementById('legendToggleBtn');
        const body = document.getElementById('legendBody');
        const arrow = document.getElementById('legendArrow');

        // 토글 클릭 시 CSS의 .collapsed 클래스를 켰다 껐다 함
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            const isCollapsed = body.classList.toggle('collapsed');
            arrow.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
        };

        const listArea = document.getElementById('type-list-area');
        rows.forEach(row => {
            const type = row.c[1]?.v;
            if (!type || type === '공유학교') return;
            
            const item = document.createElement('div');
            item.className = 'legend-row';
            const color = row.c[3]?.v || '#333';
            const symbol = row.c[2]?.v || '●';
            
            item.innerHTML = `
                <span class="l-symbol" style="color:${color}">${symbol}</span>
                <span class="l-text">${type}</span>
            `;
            
            item.onclick = (e) => {
                e.stopPropagation();
                MapManager.cluster.clearLayers();
                MapManager.markers.filter(m => m.properties.type === type).forEach(m => MapManager.cluster.addLayer(m));
            };
            listArea.appendChild(item);
        });
    }
};

// =========================================
// 거리재기 및 네이버 길찾기 연동 매니저 (경유지 유무 버그 완벽 수정)
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

        // [버그 수정 핵심 파트] 네이버 지도가 인식할 수 있도록 /-/ 구분자 추가!
        if (waypoints.length === 0) {
            // 경유지가 없을 때: 출발 / 도착 /-/ car
            url += `${fmt(startPt, '출발지')}/${fmt(endPt, '도착지')}/-/car`;
        } else {
            // 경유지가 있을 때: 출발 / 도착 / 경유1:경유2 /-/ car
            const waypointsStr = waypoints.map((p, i) => fmt(p, `경유지${i + 1}`)).join(':');
            url += `${fmt(startPt, '출발지')}/${fmt(endPt, '도착지')}/${waypointsStr}/-/car`;
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

document.addEventListener('DOMContentLoaded', () => {
    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) {
    helpBtn.onclick = () => {
        // utils.js가 정상 로드되었는지 확인 후 올바른 함수 호출
        if (typeof HelpManager !== 'undefined') {
            if (typeof HelpManager.showModal === 'function') {
                HelpManager.showModal();
            } else if (typeof HelpManager.open === 'function') {
                HelpManager.open();
            }
        } else {
            console.warn("도움말 데이터를 아직 불러오고 있습니다.");
        }
    };
}
});