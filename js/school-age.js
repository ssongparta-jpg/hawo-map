const SchoolAgeGlobePage = {
    canvas: null,
    ctx: null,
    angle: 0,
    dpr: 1,
    animationId: null,

    init() {
        this.canvas = document.getElementById('schoolAgeGlobe');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.bindEvents();
        this.resize();
        this.loadPopulationStatus();
        this.start();
    },

    bindEvents() {
        window.addEventListener('resize', () => this.resize());
        document.addEventListener('click', (event) => {
            const action = event.target.closest('[data-globe-action]')?.dataset.globeAction;
            if (action === 'reset') {
                this.angle = 0;
            }
        });
    },

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
        this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
        this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    },

    start() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        const tick = () => {
            this.draw();
            this.animationId = requestAnimationFrame(tick);
        };
        this.animationId = requestAnimationFrame(tick);
    },

    async loadPopulationStatus() {
        try {
            const res = await fetch('/api/school-age-population', { cache: 'no-store' });
            if (!res.ok) throw new Error('population request failed');
            const data = await res.json();
            const features = Array.isArray(data.features) ? data.features : [];
            const values = features
                .map(feature => Number(feature.properties?.schoolAgePopulation))
                .filter(Number.isFinite);

            this.setText('populationDongCount', features.length ? `${features.length}개` : '-');
            this.setText('populationYear', data.year || '-');

            if (data.source === 'kostat-live' && values.length) {
                this.setText('populationStatusTitle', '통계청 동기화 완료');
                this.setText('populationStatusText', `행정동 ${values.length}개 학령인구 값이 연결되었습니다.`);
            } else {
                this.setText('populationStatusTitle', '통계청 연동 대기');
                this.setText('populationStatusText', data.message || 'API 키와 지도 엔진 연결 후 실제 값이 표시됩니다.');
            }
        } catch (err) {
            this.setText('populationStatusTitle', '데이터 연결 대기');
            this.setText('populationStatusText', '서버 실행 또는 통계청 API 설정 후 이 영역에 상태가 표시됩니다.');
        }
    },

    setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    },

    draw() {
        if (!this.ctx || !this.canvas) return;
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(width, height) * 0.38;

        ctx.clearRect(0, 0, width, height);
        this.drawShadow(ctx, cx, cy, radius);
        this.drawSphere(ctx, cx, cy, radius);
        this.drawGrid(ctx, cx, cy, radius);
        this.drawKoreaFocus(ctx, cx, cy, radius);

        this.angle += 0.0025;
    },

    drawShadow(ctx, cx, cy, radius) {
        const gradient = ctx.createRadialGradient(cx, cy + radius * 0.92, radius * 0.12, cx, cy + radius * 0.92, radius * 0.95);
        gradient.addColorStop(0, 'rgba(15, 23, 42, 0.22)');
        gradient.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(cx, cy + radius * 0.88, radius * 0.78, radius * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
    },

    drawSphere(ctx, cx, cy, radius) {
        const gradient = ctx.createRadialGradient(cx - radius * 0.28, cy - radius * 0.32, radius * 0.1, cx, cy, radius);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.34, '#dbeafe');
        gradient.addColorStop(0.72, '#93c5fd');
        gradient.addColorStop(1, '#1e3a8a');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = Math.max(2, radius * 0.012);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.86)';
        ctx.stroke();
    },

    drawGrid(ctx, cx, cy, radius) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
        ctx.lineWidth = Math.max(1, radius * 0.004);

        for (let i = -3; i <= 3; i += 1) {
            ctx.beginPath();
            ctx.ellipse(cx, cy, radius * Math.cos(i * 0.22), radius * 0.18, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        for (let i = 0; i < 8; i += 1) {
            const phase = this.angle + (i / 8) * Math.PI * 2;
            const xScale = Math.abs(Math.cos(phase));
            ctx.beginPath();
            ctx.ellipse(cx, cy, radius * xScale, radius, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    },

    drawKoreaFocus(ctx, cx, cy, radius) {
        const focusX = cx + radius * 0.32;
        const focusY = cy - radius * 0.08;
        const halo = ctx.createRadialGradient(focusX, focusY, 0, focusX, focusY, radius * 0.24);
        halo.addColorStop(0, 'rgba(16, 185, 129, 0.55)');
        halo.addColorStop(1, 'rgba(16, 185, 129, 0)');

        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(focusX, focusY, radius * 0.24, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#10b981';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(3, radius * 0.018);
        ctx.beginPath();
        ctx.arc(focusX, focusY, radius * 0.045, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(12, radius * 0.042)}px 'Noto Sans KR', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('화성·오산', focusX, focusY + radius * 0.12);
    }
};

document.addEventListener('DOMContentLoaded', () => SchoolAgeGlobePage.init());
