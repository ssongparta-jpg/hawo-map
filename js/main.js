const App = {
    async init() {
        console.log("앱 초기화 시작...");
        MapManager.init();
        FilterManager.init();
        SearchManager.init(); 
        await AuthManager.checkAuth();
        try {
            const [pRows, lRows, hRows, sRows] = await Promise.all([
                this.fetchJson(MapConfig.GIDS.POINTS),
                this.fetchJson(MapConfig.GIDS.LEGEND),
                this.fetchJson(MapConfig.GIDS.HEADER),
                this.fetchJson(MapConfig.GIDS.SHARED)
            ]);
            if (hRows) HelpManager.init(hRows);
            if (lRows) this.renderLegend(lRows);
            const groupedSchools = {};

            const parseNum = (val) => {
                if (typeof val === 'number') return val;
                if (!val) return 0;
                return parseFloat(String(val).replace(/,/g, '')) || 0;
            };

            // 데이터 파싱 (1차 업데이트 버전 기준)
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

            // 마커 생성 및 정렬
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
        const timestamp = new Date().getTime();
        const res = await fetch(`https://docs.google.com/spreadsheets/d/${MapConfig.SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}&t=${timestamp}`);
        const txt = await res.text();
        return JSON.parse(txt.substring(47).slice(0, -2)).table.rows;
    },

    renderLegend(rows) {
        const container = document.getElementById('legend');
        if (!container) return;

        // 범례 초기화 및 '전체 보기' 추가
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

        // 공유학교 항목 별도 추가
        const sharedItem = document.createElement('div');
        sharedItem.className = 'legend-item';
        sharedItem.style.cssText = "display:flex; align-items:center; padding:4px; cursor:pointer;";
        sharedItem.innerHTML = `
            <div class="legend-icon" style="color:#e84393; width:20px; text-align:center; margin-right:8px; font-weight:bold;">❤</div>
            <div class="legend-text" style="font-size:13px;">공유학교</div>
        `;
        sharedItem.onclick = () => {
            MapManager.cluster.clearLayers();
            MapManager.markers.filter(m => m.properties.type === '공유학교').forEach(m => MapManager.cluster.addLayer(m));
        };
        container.appendChild(sharedItem);
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());