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