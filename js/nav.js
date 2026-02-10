/* nav.js */

const DistanceManager = {
    active: false,
    points: [],
    markers: [],
    lines: [],
    totalDist: 0,
    layerGroup: null,

    init() {
        this.layerGroup = L.layerGroup().addTo(MapManager.map);
    },

    toggle() {
        this.active = !this.active;
        const btn = document.getElementById('btn-measure');
        const map = document.getElementById('map');
        
        if (this.active) {
            btn.classList.add('active');
            btn.innerHTML = `<span>🛑</span> 측정 종료 (ESC)`;
            map.style.cursor = 'crosshair';
            NavManager.resetPanel();
        } else {
            this.reset();
            btn.classList.remove('active');
            btn.innerHTML = `<span>📏</span> 거리재기`;
            map.style.cursor = '';
        }
    },

    reset() {
        this.active = false;
        this.points = [];
        this.markers = [];
        this.lines = [];
        this.totalDist = 0;
        this.layerGroup.clearLayers();
        NavManager.clearRoute();
    },

    addPoint(e) {
        if (!this.active) return;

        const latlng = e.latlng;
        this.points.push(latlng);
        const index = this.points.length - 1;
        const isStart = index === 0;

        let distLabel = "출발";
        
        if (!isStart) {
            const prev = this.points[index - 1];
            const dist = prev.distanceTo(latlng);
            this.totalDist += dist;

            L.polyline([prev, latlng], { 
                color: '#e74c3c', weight: 3, dashArray: '5, 8', opacity: 0.8 
            }).addTo(this.layerGroup);

            distLabel = this.totalDist >= 1000 
                ? (this.totalDist / 1000).toFixed(2) + "km" 
                : Math.round(this.totalDist) + "m";
        }

        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'custom-nav-icon',
                html: `<div style="width:${isStart?14:10}px; height:${isStart?14:10}px; background:white; border:${isStart?'4px':'2px'} solid ${isStart?'#333':'#e74c3c'}; border-radius:50%;"></div>`,
                iconSize: [20, 20], iconAnchor: [10, 10]
            })
        }).addTo(this.layerGroup);

        marker.bindTooltip(distLabel, { 
            permanent: true, direction: 'right', className: 'dist-tooltip', offset: [10, 0] 
        }).openTooltip();

        const popupHtml = isStart ? '🚩 <b>출발지</b>' : `
            <div style="text-align:center; min-width:120px;">
                <div style="font-size:12px; color:#888;">총 거리: ${distLabel}</div>
                <button class="btn-calc-route" onclick="NavManager.calculateRouteFromDistance(${index})">
                    길찾기 (도보/차량)
                </button>
            </div>`;
        
        marker.bindPopup(popupHtml);
        if(!isStart) setTimeout(() => marker.openPopup(), 200);

        this.markers.push(marker);
    }
};

const NavManager = {
    mode: 'walking', // 'walking' or 'driving'
    routeLayer: null,

    init() {
        this.routeLayer = L.layerGroup().addTo(MapManager.map);
        
        MapManager.map.on('click', (e) => { if(DistanceManager.active) DistanceManager.addPoint(e); });
        MapManager.map.on('contextmenu', () => { if(DistanceManager.active) DistanceManager.toggle(); });
        document.addEventListener('keydown', (e) => { if(e.key === 'Escape' && DistanceManager.active) DistanceManager.toggle(); });
    },

    setMode(newMode) {
        this.mode = newMode;
        document.querySelectorAll('.nav-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === newMode);
        });
        
        // 모드 변경 시 재계산
        if (DistanceManager.points.length >= 2 && document.getElementById('nav-panel').style.display !== 'none') {
            // 마지막 도착지점 기준으로 재계산
            this.calculateRouteFromDistance(DistanceManager.points.length - 1);
        }
    },

    async calculateRouteFromDistance(endIndex) {
        if (DistanceManager.points.length < 2) return;

        const start = DistanceManager.points[0];
        const end = DistanceManager.points[endIndex];
        
        // [프로필 설정]
        // OSRM v1: car(driving), foot(walking)
        const profile = this.mode === 'walking' ? 'foot' : 'driving';
        
        // [캐시 방지] URL에 타임스탬프 추가하여 매번 새로운 요청 전송
        const url = `https://router.project-osrm.org/route/v1/${profile}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&_=${Date.now()}`;

        const panel = document.getElementById('nav-panel');
        const resDiv = document.getElementById('nav-result');
        panel.style.display = 'block';
        resDiv.innerHTML = '<div style="color:#666;">🔄 경로 탐색 중...</div>';

        try {
            const res = await fetch(url);
            const data = await res.json();

            if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
                resDiv.innerHTML = '<div style="color:red;">❌ 경로를 찾을 수 없습니다.</div>';
                return;
            }

            const route = data.routes[0];
            let duration = route.duration;
            let distance = route.distance;

            // [시간 보정]
            // API가 가끔 모드별로 비슷한 시간을 줄 때를 대비한 강제 보정 로직
            if (this.mode === 'driving') {
                // 차량: 도심 평균 속도(약 30km/h) 고려하여 너무 빠른 시간은 보정
                // API 예상시간에 1.3배 (신호대기 등)
                duration = duration * 1.3;
            } else {
                // 도보: 성인 평균 시속 4km/h = 분속 67m
                // API 데이터가 너무 빠르면 강제로 평균 속도로 맞춤 (최소 안전장치)
                const estimatedWalkSec = distance / (4000 / 3600); // 4km/h 기준
                // API 값과 계산 값 중 더 보수적인(오래 걸리는) 값 사용
                duration = Math.max(duration, estimatedWalkSec);
            }

            this.drawRoute(route.geometry);
            this.showResult(distance, duration);

        } catch (e) {
            console.error(e);
            resDiv.innerHTML = '<div style="color:red;">⚠️ 서버 연결 실패</div>';
        }
    },

    drawRoute(geojson) {
        this.clearRoute();
        
        const isWalk = this.mode === 'walking';
        const color = isWalk ? '#03c75a' : '#007aff';
        const dashArray = isWalk ? '5, 10' : null;
        const weight = isWalk ? 6 : 7;

        L.geoJSON(geojson, {
            style: { color: 'white', weight: weight + 3, opacity: 0.9 }
        }).addTo(this.routeLayer);

        const mainLine = L.geoJSON(geojson, {
            style: { 
                color: color, 
                weight: weight, 
                opacity: 0.9,
                dashArray: dashArray,
                lineCap: 'round',
                lineJoin: 'round'
            }
        }).addTo(this.routeLayer);

        MapManager.map.fitBounds(mainLine.getBounds(), { padding: [60, 60] });
    },

    showResult(distMeter, durationSec) {
        let distText = distMeter >= 1000 
            ? (distMeter / 1000).toFixed(1) + "km" 
            : Math.round(distMeter) + "m";

        let timeText = "";
        const minTotal = Math.round(durationSec / 60);
        
        if (minTotal < 1) {
            timeText = "1분 미만";
        } else if (minTotal >= 60) {
            const h = Math.floor(minTotal / 60);
            const m = minTotal % 60;
            timeText = `${h}<span style="font-size:16px; font-weight:500;">시간</span> ${m}<span style="font-size:16px; font-weight:500;">분</span>`;
        } else {
            timeText = `${minTotal}<span style="font-size:18px; font-weight:500;">분</span>`;
        }

        const icon = this.mode === 'walking' ? '🏃 도보' : '🚘 차량';
        const color = this.mode === 'walking' ? '#03c75a' : '#007aff';
        
        // 사용자에게 현재 상태 설명 (API 연동 불가에 대한 대안 안내)
        const desc = this.mode === 'driving' 
            ? '실시간 교통 미반영 (평균 속도 기준)' 
            : '횡단보도/육교 포함 (평균 4km/h)';

        document.getElementById('nav-result').innerHTML = `
            <div class="nav-time-big" style="color:${color}">${timeText}</div>
            <div class="nav-info-detail">
                <span>${icon}</span>
                <span style="color:#ddd;">|</span>
                <span>총 거리 ${distText}</span>
            </div>
            <div class="traffic-badge">${desc}</div>
        `;
    },

    clearRoute() { if(this.routeLayer) this.routeLayer.clearLayers(); },
    resetPanel() { this.clearRoute(); document.getElementById('nav-panel').style.display = 'none'; }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if(typeof MapManager !== 'undefined' && MapManager.map) {
            DistanceManager.init();
            NavManager.init();
        }
    }, 800);
});