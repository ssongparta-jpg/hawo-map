const ShareApp = {
    async init() {
        // [핵심] 공유학교에서는 하위 구(동탄구, 병점구 등)를 삭제하고 화성/오산 2개로만 묶음 처리
        MapConfig.DISTRICTS = {
            "화성시": { pos: [37.185, 126.915], color: "#4A90E2", fullName: "화성시 전체" },
            "오산시": { pos: [37.16361, 127.06229], color: "#FF6392", fullName: "오산시" }
        };

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
                    color: '#8E44AD', // 공유학교 전용 색상 (보라색)
                    url: c[13]?.v,
                    program: c[6]?.v || '정보 없음' 
                };
                
                const m = MapManager.createMarker(lat, lng, p);
                MapManager.markers.push(m);
                MapManager.cluster.addLayer(m);
            });
            
            await MapManager.loadBoundaries();
            // 행정구역 통계 버튼 (화성시, 오산시 딱 2개만 렌더링됨)
            MapManager.addDistrictButtons(); 
            
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
            matches.slice(0, 8).forEach(m => {
                const div = document.createElement('div');
                div.className = 'search-item';
                // 타입 뱃지 표시
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

        // 팝업 외부 클릭 시 검색창 닫힘 보장
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-wrapper')) resultBox.style.display = 'none';
        });
    }
};

document.addEventListener('DOMContentLoaded', () => ShareApp.init());