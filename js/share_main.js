const ShareApp = {
    async init() {
        MapManager.init();
        await AuthManager.checkAuth();
        
        // 공유학교 데이터 GID 설정 
        const SHARE_GID = '1582242290';
        
        try {
            const rows = await this.fetchJson(SHARE_GID);
            
            rows.forEach((row) => {
                const c = row.c;
                if (!c || !c[1] || !c[2]) return;
                
                const lat = parseFloat(c[1]?.v || 0);
                const lng = parseFloat(c[2]?.v || 0);
                
                const p = {
                    type: '공유학교',
                    name: c[4]?.v || '이름 없음',
                    adrs: c[5]?.v || '',
                    color: '#8E44AD', // 공유학교 전용 색상
                    url: c[13]?.v,
                    program: c[6]?.v || '정보 없음' // 예시: 공유학교 프로그램 데이터 열
                };
                
                const m = MapManager.createMarker(lat, lng, p);
                MapManager.markers.push(m);
                MapManager.cluster.addLayer(m);
            });
            
            await MapManager.loadBoundaries();
            this.initSearch();
        } catch (e) { console.error("데이터 로드 실패:", e); }
    },

    async fetchJson(gid) {
        const res = await fetch(`https://docs.google.com/spreadsheets/d/${MapConfig.SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}`);
        const txt = await res.text();
        return JSON.parse(txt.substring(47).slice(0, -2)).table.rows;
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
                div.innerHTML = `<span>${m.properties.name}</span>`;
                div.onclick = () => {
                    MapManager.focusMarker(m);
                    resultBox.style.display = 'none';
                    input.value = m.properties.name;
                };
                resultBox.appendChild(div);
            });
            resultBox.style.display = matches.length > 0 ? 'block' : 'none';
        });
    }
};

document.addEventListener('DOMContentLoaded', () => ShareApp.init());