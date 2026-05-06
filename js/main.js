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

document.addEventListener('DOMContentLoaded', () => App.init());