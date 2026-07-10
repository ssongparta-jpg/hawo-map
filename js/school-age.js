const SchoolAge3DMap = {
    container: null,
    renderer: null,
    scene: null,
    camera: null,
    mapGroup: null,
    raycaster: null,
    pointer: null,
    meshes: [],
    pickMeshes: [],
    features: [],
    visibleFeatures: [],
    geojson: null,
    populationData: null,
    selectedGroups: ['elementary', 'middle', 'high', 'university'],
    selectedYear: null,
    yearRange: null,
    yearInputTimer: null,
    loadToken: 0,
    lastYearRequestAt: 0,
    moundGeometry: null,
    denseOnly: false,
    denseThreshold: 0,
    needsRender: true,
    groups: [
        { id: 'total', label: '전체', shortLabel: '전체', ageLabel: '6~21세' },
        { id: 'elementary', label: '초등학교', shortLabel: '초등', ageLabel: '6~12세' },
        { id: 'middle', label: '중학교', shortLabel: '중등', ageLabel: '13~15세' },
        { id: 'high', label: '고등학교', shortLabel: '고등', ageLabel: '16~18세' },
        { id: 'university', label: '대학교', shortLabel: '대학', ageLabel: '19~21세' }
    ],
    groupColors: {
        elementary: 0x5aa4f2,
        middle: 0x79bf6b,
        high: 0xf2c04b,
        university: 0xd65d91
    },
    drag: { active: false, x: 0, y: 0, moved: false },
    pointers: new Map(),
    gesture: { active: false, distance: 0, cameraY: 0, cameraZ: 0 },
    bounds: null,
    mapOffset: { x: 0, y: 0 },
    maxValue: 1,
    hoveredFeature: null,
    colors: {
        dongtan: 0xd89a2b,
        byeongjeom: 0x5c9d62,
        hyohaeng: 0x2f8edb,
        manse: 0xc04a7a,
        osan: 0x2d7fb8,
        default: 0x60758a
    },

    async init() {
        this.container = document.getElementById('schoolAgeScene');
        if (!this.container) return;
        if (!window.THREE) {
            this.setStatus('3D 엔진 로드 실패', 'Three.js를 불러오지 못했습니다.');
            return;
        }

        this.setupScene();
        this.bindEvents();
        this.renderAgeSelector();
        await this.loadYearRange();
        await this.loadData();
        this.animate();
    },

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x111317, 16, 34);

        this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
        this.camera.position.set(0, -5.4, 13.8);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);

        this.mapGroup = new THREE.Group();
        this.mapGroup.rotation.x = -0.18;
        this.mapGroup.rotation.z = -0.08;
        this.scene.add(this.mapGroup);
        this.moundGeometry = this.createMoundGeometry(1, 1, 20, 6);

        const ambient = new THREE.AmbientLight(0xffffff, 1.45);
        this.scene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xffffff, 2.25);
        keyLight.position.set(-5, -8, 12);
        this.scene.add(keyLight);

        const rimLight = new THREE.DirectionalLight(0x7dd3fc, 1.2);
        rimLight.position.set(8, 7, 8);
        this.scene.add(rimLight);

        const floorGeometry = new THREE.CircleGeometry(7.6, 96);
        const floorMaterial = new THREE.MeshBasicMaterial({
            color: 0xc8bfb4,
            transparent: true,
            opacity: 0.22,
            side: THREE.DoubleSide
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.position.z = -0.03;
        this.mapGroup.add(floor);

        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.resize();
    },

    bindEvents() {
        window.addEventListener('resize', () => this.resize());
        document.addEventListener('click', (event) => {
            const group = event.target.closest('[data-group]')?.dataset.group;
            if (group) this.setGroup(group);
            const action = event.target.closest('[data-map-action]')?.dataset.mapAction;
            if (action === 'reset') this.resetView();
            if (action === 'top') this.setTopView();
            if (action === 'density') this.toggleDensityMode(event.target.closest('[data-map-action]'));
            const viewMode = event.target.closest('[data-view-mode]')?.dataset.viewMode;
            if (viewMode === 'total') this.setGroup('total');
        });

        const yearSlider = document.getElementById('yearSlider');
        if (yearSlider) {
            yearSlider.addEventListener('input', () => {
                this.queueYearChange(yearSlider.value);
            });
            yearSlider.addEventListener('change', () => {
                this.setYear(yearSlider.value, true);
            });
        }

        this.container.addEventListener('pointerdown', (event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            event.preventDefault();
            this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            this.drag.active = this.pointers.size === 1;
            this.drag.x = event.clientX;
            this.drag.y = event.clientY;
            this.drag.moved = false;
            if (this.pointers.size > 1) {
                this.drag.active = false;
                this.drag.moved = true;
                this.startGesture();
            }
            try {
                this.container.setPointerCapture(event.pointerId);
            } catch (err) {
                // 일부 모바일 브라우저는 캡처가 이미 해제된 포인터에서 예외를 냅니다.
            }
        });
        this.container.addEventListener('pointermove', (event) => {
            if (!this.pointers.has(event.pointerId)) {
                if (event.pointerType !== 'touch') this.updateHover(event);
                return;
            }
            event.preventDefault();
            this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (this.pointers.size > 1) {
                this.drag.active = false;
                this.drag.moved = true;
                this.updateGesture();
                return;
            }

            if (!this.drag.active) return;
            const dx = event.clientX - this.drag.x;
            const dy = event.clientY - this.drag.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) this.drag.moved = true;
            this.mapGroup.rotation.z += dx * 0.004;
            this.mapGroup.rotation.x = this.clamp(this.mapGroup.rotation.x + dy * 0.003, -0.95, 0.08);
            this.drag.x = event.clientX;
            this.drag.y = event.clientY;
            this.requestRender();
        });
        this.container.addEventListener('pointerup', (event) => {
            const shouldSelect = this.drag.active && !this.drag.moved && !this.gesture.active && this.pointers.size <= 1;
            if (shouldSelect) this.selectAt(event);
            this.pointers.delete(event.pointerId);
            if (this.pointers.size === 1) {
                const remaining = [...this.pointers.values()][0];
                this.drag.active = true;
                this.drag.moved = true;
                this.drag.x = remaining.x;
                this.drag.y = remaining.y;
                this.gesture.active = false;
            } else {
                this.drag.active = false;
                this.gesture.active = false;
            }
            try {
                this.container.releasePointerCapture(event.pointerId);
            } catch (err) {
                // 포인터 캡처가 없는 경우는 무시합니다.
            }
        });
        this.container.addEventListener('pointercancel', (event) => {
            this.pointers.delete(event.pointerId);
            if (!this.pointers.size) {
                this.drag.active = false;
                this.gesture.active = false;
            }
        });
        this.container.addEventListener('pointerleave', (event) => {
            if (event.pointerType !== 'touch') {
                this.drag.active = false;
                this.pointers.clear();
            }
            this.clearHover();
        });
        this.container.addEventListener('wheel', (event) => {
            event.preventDefault();
            this.zoomCamera(Math.sign(event.deltaY) * 0.72);
            this.camera.lookAt(0, 0, 0);
            this.requestRender();
        }, { passive: false });
    },

    resize() {
        if (!this.renderer || !this.camera || !this.container) return;
        const width = Math.max(1, this.container.clientWidth);
        const height = Math.max(1, this.container.clientHeight);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.requestRender();
    },

    requestRender() {
        this.needsRender = true;
    },

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    getPointerDistance() {
        const points = [...this.pointers.values()];
        if (points.length < 2) return 0;
        const dx = points[0].x - points[1].x;
        const dy = points[0].y - points[1].y;
        return Math.hypot(dx, dy);
    },

    startGesture() {
        this.gesture.active = true;
        this.gesture.distance = this.getPointerDistance();
        this.gesture.cameraY = this.camera.position.y;
        this.gesture.cameraZ = this.camera.position.z;
    },

    updateGesture() {
        if (!this.gesture.active) this.startGesture();
        const distance = this.getPointerDistance();
        if (!distance || !this.gesture.distance) return;
        const zoomDelta = (this.gesture.distance - distance) * 0.018;
        this.camera.position.y = this.clamp(this.gesture.cameraY + zoomDelta * 0.9, -17, -0.1);
        this.camera.position.z = this.clamp(this.gesture.cameraZ + zoomDelta, 5.8, 16.5);
        this.camera.lookAt(0, 0, 0);
        this.requestRender();
    },

    zoomCamera(delta) {
        this.camera.position.y = this.clamp(this.camera.position.y + delta * 0.9, -17, -0.1);
        this.camera.position.z = this.clamp(this.camera.position.z + delta, 5.8, 16.5);
        this.requestRender();
    },

    setTopView() {
        this.mapGroup.rotation.x = 0.04;
        this.camera.position.set(0, -0.2, 15.2);
        this.camera.lookAt(0, 0, 0);
        this.requestRender();
    },

    toggleDensityMode(button = null) {
        this.denseOnly = !this.denseOnly;
        if (button) {
            button.classList.toggle('active', this.denseOnly);
            button.setAttribute('aria-pressed', String(this.denseOnly));
        }
        if (this.features.length) this.buildMap();
        this.updatePanel();
    },

    async loadData() {
        const token = ++this.loadToken;
        try {
            this.setLoadingState(true);
            const yearParam = this.selectedYear ? `&year=${encodeURIComponent(this.selectedYear)}` : '';
            const popPromise = fetch(`/api/school-age-population?${yearParam.replace(/^&/, '')}`, { cache: 'no-store' }).catch(() => null);
            if (!this.geojson) {
                const geoRes = await fetch('data/hwao.geojson', { cache: 'no-store' });
                if (!geoRes.ok) throw new Error('geojson failed');
                this.geojson = await geoRes.json();
            }
            const popRes = await popPromise;
            if (token !== this.loadToken) return;
            const geojson = this.geojson;
            this.populationData = popRes && popRes.ok ? await popRes.json() : null;
            if (token !== this.loadToken) return;
            if (Array.isArray(this.populationData?.groups) && this.populationData.groups.length) {
                this.groups = this.populationData.groups;
                this.renderAgeSelector();
            }
            this.features = (geojson.features || []).filter(feature => {
                const sgg = feature.properties?.sggnm || '';
                return sgg.includes('화성시') || sgg.includes('오산시');
            });
            this.attachPopulation();
            this.buildMap();
            this.updatePanel();
        } catch (err) {
            this.setStatus('지도 로드 실패', '행정동 경계 데이터를 불러오지 못했습니다.');
        } finally {
            if (token === this.loadToken) this.setLoadingState(false);
        }
    },

    async loadYearRange() {
        const fallbackObserved = 2024;
        let range = { min: 2000, max: 2072, defaultYear: fallbackObserved, observedYear: fallbackObserved, forecastFromYear: new Date().getFullYear() + 1 };
        try {
            const res = await fetch('/api/school-age-years', { cache: 'no-store' });
            if (res.ok) range = await res.json();
        } catch (err) {
            // 정적 파일로 열 때는 기본 범위를 사용합니다.
        }

        const min = Number(range.min) || 2000;
        const max = Number(range.max) || 2072;
        const defaultYear = Number(range.defaultYear) || max;
        const observedYear = Number(range.observedYear) || defaultYear;
        const forecastFromYear = Number(range.forecastFromYear) || (new Date().getFullYear() + 1);
        this.yearRange = { min, max, defaultYear, observedYear, forecastFromYear };
        this.selectedYear = String(Math.min(max, Math.max(min, defaultYear)));
        this.renderYearSlider();
    },

    renderYearSlider() {
        const slider = document.getElementById('yearSlider');
        if (!slider || !this.yearRange) return;
        slider.min = String(this.yearRange.min);
        slider.max = String(this.yearRange.max);
        slider.value = this.selectedYear;
        slider.disabled = false;
        this.setText('selectedYearLabel', this.selectedYear);
        this.setText('yearMinLabel', `${this.yearRange.min}`);
        this.setText('yearMaxLabel', `${this.yearRange.max}`);
        this.updateYearSliderProgress();
    },

    queueYearChange(year) {
        const nextYear = String(year);
        this.selectedYear = nextYear;
        this.setText('selectedYearLabel', nextYear);
        this.updateYearSliderProgress();
        const now = window.performance?.now?.() || Date.now();
        const delay = Math.max(0, 120 - (now - this.lastYearRequestAt));
        const run = () => {
            this.lastYearRequestAt = window.performance?.now?.() || Date.now();
            this.clearHover();
            this.loadData();
        };
        window.clearTimeout(this.yearInputTimer);
        if (delay <= 12) run();
        else this.yearInputTimer = window.setTimeout(run, delay);
    },

    async setYear(year, immediate = false) {
        const nextYear = String(year);
        if (nextYear === this.selectedYear && !immediate) return;
        this.selectedYear = nextYear;
        window.clearTimeout(this.yearInputTimer);
        this.lastYearRequestAt = window.performance?.now?.() || Date.now();
        this.clearHover();
        this.setText('selectedYearLabel', nextYear);
        this.updateYearSliderProgress();
        await this.loadData();
    },

    updateYearSliderProgress() {
        const slider = document.getElementById('yearSlider');
        if (!slider || !this.yearRange) return;
        const min = Number(slider.min);
        const max = Number(slider.max);
        const value = Number(this.selectedYear);
        const progress = max > min ? ((value - min) / (max - min)) * 100 : 100;
        slider.style.setProperty('--year-progress', `${this.clamp(progress, 0, 100)}%`);
    },

    setLoadingState(loading) {
        const slider = document.getElementById('yearSlider');
        if (slider) slider.disabled = !this.yearRange;
        document.body.classList.toggle('is-school-age-loading', loading);
    },

    attachPopulation() {
        const byAdm = new Map();
        const popFeatures = this.populationData?.features || [];
        popFeatures.forEach(feature => {
            const props = feature.properties || {};
            byAdm.set(props.adm_cd2, {
                schoolAgePopulation: Number(props.schoolAgePopulation),
                groupPopulation: props.groupPopulation || {},
                byAge: props.agePopulation || {}
            });
        });

        this.features.forEach((feature, index) => {
            const props = feature.properties || {};
            const record = byAdm.get(props.adm_cd2) || {};
            props.schoolAgePopulation = Number.isFinite(record.schoolAgePopulation) ? record.schoolAgePopulation : null;
            props.groupPopulation = record.groupPopulation || {};
            props.agePopulation = record.byAge || {};
            props.visualFallback = this.fallbackValue(props, index);
        });
    },

    buildMap() {
        this.clearMap();
        if (!this.features.length) {
            this.visibleFeatures = [];
            this.requestRender();
            return;
        }
        this.bounds = this.computeBounds(this.features);
        this.mapOffset = { x: 0, y: 0 };
        this.visibleFeatures = this.getRenderableFeatures();
        this.maxValue = Math.max(...this.visibleFeatures.map(feature => this.getFeatureValue(feature)), 1);

        this.visibleFeatures.forEach(feature => {
            const meshes = this.createFeatureMeshes(feature);
            meshes.forEach(mesh => {
                this.meshes.push(mesh);
                this.mapGroup.add(mesh);
            });
        });

        this.addDensityMounds();
        this.requestRender();
    },

    clearMap() {
        this.meshes.forEach(mesh => {
            if (mesh.parent) mesh.parent.remove(mesh);
            if (!mesh.userData?.sharedGeometry) mesh.geometry?.dispose();
            if (Array.isArray(mesh.material)) mesh.material.forEach(material => material.dispose());
            else mesh.material?.dispose();
        });
        this.meshes = [];
        this.pickMeshes = [];
        [...this.mapGroup.children].forEach(child => {
            if (child.userData?.generated) {
                this.mapGroup.remove(child);
                if (!child.userData?.sharedGeometry) child.geometry?.dispose();
                child.material?.dispose();
            }
        });
    },

    getRenderableFeatures() {
        if (!this.denseOnly) return this.features;
        const values = this.features
            .map(feature => this.getFeatureValue(feature))
            .filter(Number.isFinite)
            .sort((a, b) => a - b);
        if (!values.length) return this.features;
        const index = Math.max(0, Math.floor(values.length * 0.68));
        this.denseThreshold = values[index];
        return this.features.filter(feature => this.getFeatureValue(feature) >= this.denseThreshold);
    },

    createFeatureMeshes(feature) {
        const props = feature.properties || {};
        const color = this.getFeatureBlendColor(feature);
        const value = this.getFeatureValue(feature);
        const height = this.getHeight(value);
        const meshes = [];

        this.getPolygons(feature.geometry).forEach(polygon => {
            const shape = this.polygonToShape(polygon);
            if (!shape) return;
            const geometry = new THREE.ExtrudeGeometry(shape, {
                depth: height,
                bevelEnabled: true,
                bevelSize: 0.018,
                bevelThickness: 0.016,
                bevelSegments: 2
            });
            geometry.computeVertexNormals();
            const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
                color,
                roughness: 0.72,
                metalness: 0.02,
                transparent: true,
                opacity: 0.88,
                emissive: new THREE.Color(color).multiplyScalar(0.05)
            }));
            mesh.userData = { feature, baseColor: color, isRegion: true, regionMesh: true, generated: true };
            meshes.push(mesh);

            const edgeGeometry = new THREE.EdgesGeometry(geometry, 34);
            const edge = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0x111317, transparent: true, opacity: 0.18 }));
            edge.userData = { feature, isRegion: true, generated: true, edgeFor: mesh };
            meshes.push(edge);

            const pickGeometry = new THREE.ShapeGeometry(shape);
            const pickMesh = new THREE.Mesh(pickGeometry, new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                side: THREE.DoubleSide
            }));
            pickMesh.position.z = height + 0.03;
            pickMesh.userData = { feature, isRegion: true, pickMesh: true, generated: true };
            meshes.push(pickMesh);
            this.pickMeshes.push(pickMesh);
        });
        return meshes;
    },

    addDensityMounds() {
        this.visibleFeatures.forEach((feature, index) => {
            const center = this.getFeatureCenter(feature);
            const value = this.getFeatureValue(feature);
            const baseHeight = this.getHeight(value);
            const shares = this.getSelectedShares(feature);
            const radiusBase = 0.2 + Math.sqrt(Math.max(value, 1) / this.maxValue) * 0.54;
            const moundHeight = 0.22 + baseHeight * 0.58;
            shares.forEach((share, shareIndex) => {
                const groupOffset = shares.length === 1 ? 0 : radiusBase * 0.2;
                const angle = (shareIndex / Math.max(1, shares.length)) * Math.PI * 2 + index * 0.37;
                const radius = radiusBase * (0.52 + share.ratio * 0.72);
                const height = moundHeight * (0.26 + share.ratio * 0.94);
                const material = new THREE.MeshStandardMaterial({
                    color: this.groupColors[share.id] || this.getRegionColor(feature.properties || {}),
                    roughness: 0.76,
                    metalness: 0.02,
                    transparent: true,
                    opacity: 0.44,
                    depthWrite: false
                });
                const mound = new THREE.Mesh(this.moundGeometry, material);
                mound.scale.set(radius * 1.18, radius * 0.86, height);
                mound.rotation.z = angle * 0.28;
                mound.position.set(
                    center.x + Math.cos(angle) * groupOffset,
                    center.y + Math.sin(angle) * groupOffset,
                    baseHeight + 0.025
                );
                mound.userData = { feature, generated: true, mound: true, sharedGeometry: true };
                this.meshes.push(mound);
                this.mapGroup.add(mound);
            });
        });
    },

    createMoundGeometry(radius = 1, height = 1, segments = 24, rings = 7) {
        const vertices = [0, 0, height];
        const indices = [];
        for (let ring = 1; ring <= rings; ring += 1) {
            const t = ring / rings;
            const ringRadius = radius * t;
            const z = height * Math.pow(1 - t, 1.65);
            for (let segment = 0; segment < segments; segment += 1) {
                const angle = (segment / segments) * Math.PI * 2;
                vertices.push(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, z);
            }
        }
        for (let segment = 0; segment < segments; segment += 1) {
            const next = segment === segments - 1 ? 0 : segment + 1;
            indices.push(0, 1 + next, 1 + segment);
        }
        for (let ring = 1; ring < rings; ring += 1) {
            const currentStart = 1 + (ring - 1) * segments;
            const nextStart = 1 + ring * segments;
            for (let segment = 0; segment < segments; segment += 1) {
                const next = segment === segments - 1 ? 0 : segment + 1;
                indices.push(currentStart + segment, currentStart + next, nextStart + segment);
                indices.push(currentStart + next, nextStart + next, nextStart + segment);
            }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        return geometry;
    },

    polygonToShape(polygon) {
        if (!Array.isArray(polygon?.[0]) || polygon[0].length < 3) return null;
        const outer = polygon[0].map(coord => this.project(coord));
        const shape = new THREE.Shape();
        outer.forEach((point, index) => {
            if (index === 0) shape.moveTo(point.x, point.y);
            else shape.lineTo(point.x, point.y);
        });
        shape.closePath();
        polygon.slice(1).forEach(ring => {
            if (!Array.isArray(ring) || ring.length < 3) return;
            const hole = new THREE.Path();
            ring.forEach((coord, index) => {
                const point = this.project(coord);
                if (index === 0) hole.moveTo(point.x, point.y);
                else hole.lineTo(point.x, point.y);
            });
            hole.closePath();
            shape.holes.push(hole);
        });
        return shape;
    },

    project(coord) {
        const [lng, lat] = coord;
        const width = this.bounds.maxLng - this.bounds.minLng || 1;
        const height = this.bounds.maxLat - this.bounds.minLat || 1;
        return {
            x: ((lng - this.bounds.minLng) / width - 0.5) * 11.5,
            y: ((lat - this.bounds.minLat) / height - 0.5) * 7.2
        };
    },

    computeBounds(features) {
        const bounds = { minLng: Infinity, minLat: Infinity, maxLng: -Infinity, maxLat: -Infinity };
        features.forEach(feature => {
            this.walkCoords(feature.geometry?.coordinates, coord => {
                bounds.minLng = Math.min(bounds.minLng, coord[0]);
                bounds.maxLng = Math.max(bounds.maxLng, coord[0]);
                bounds.minLat = Math.min(bounds.minLat, coord[1]);
                bounds.maxLat = Math.max(bounds.maxLat, coord[1]);
            });
        });
        return bounds;
    },

    walkCoords(coords, visitor) {
        if (!Array.isArray(coords)) return;
        if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
            visitor(coords);
            return;
        }
        coords.forEach(child => this.walkCoords(child, visitor));
    },

    getPolygons(geometry) {
        if (!geometry) return [];
        if (geometry.type === 'Polygon') return [geometry.coordinates];
        if (geometry.type === 'MultiPolygon') return geometry.coordinates;
        return [];
    },

    getFeatureCenter(feature) {
        let totalX = 0;
        let totalY = 0;
        let count = 0;
        this.walkCoords(feature.geometry?.coordinates, coord => {
            const point = this.project(coord);
            totalX += point.x;
            totalY += point.y;
            count += 1;
        });
        return count
            ? {
                x: totalX / count - (this.mapOffset?.x || 0),
                y: totalY / count - (this.mapOffset?.y || 0)
            }
            : { x: 0, y: 0 };
    },

    getFeatureValue(feature) {
        const props = feature.properties || {};
        const selected = this.getSelectedGroupIds();
        const groupPopulation = props.groupPopulation || {};
        const selectedTotal = selected.reduce((sum, groupId) => {
            const value = Number(groupPopulation[groupId]);
            return sum + (Number.isFinite(value) ? value : 0);
        }, 0);
        const hasSelectedGroupData = selected.some(groupId => Object.prototype.hasOwnProperty.call(groupPopulation, groupId));
        if (hasSelectedGroupData) return selectedTotal;
        const total = Number(groupPopulation.total ?? props.schoolAgePopulation);
        if (Number.isFinite(total) && total > 0) return total;
        return props.visualFallback || 1;
    },

    getHeight(value) {
        if (!Number(value)) return 0.045;
        const ratio = Math.max(0.08, Math.min(1, value / this.maxValue));
        return 0.06 + Math.pow(ratio, 0.78) * 0.74;
    },

    fallbackValue(props, index) {
        const seed = Array.from(String(props.adm_nm || props.adm_cd2 || index)).reduce((sum, char) => sum + char.charCodeAt(0), 0);
        return 120 + (seed % 880);
    },

    getRegionColor(props) {
        const admNm = props.adm_nm || '';
        const sgg = props.sggnm || '';
        if (sgg.includes('오산')) return this.colors.osan;
        if (['동탄', '오산동'].some(keyword => admNm.includes(keyword))) return this.colors.dongtan;
        if (['진안', '병점', '반월', '화산', '안녕'].some(keyword => admNm.includes(keyword))) return this.colors.byeongjeom;
        if (['봉담', '비봉', '매송', '정남', '기배'].some(keyword => admNm.includes(keyword))) return this.colors.hyohaeng;
        if (['향남', '우정', '팔탄', '장안', '양감', '마도', '송산', '서신', '남양', '새솔'].some(keyword => admNm.includes(keyword))) return this.colors.manse;
        return this.colors.default;
    },

    getSelectedGroup() {
        const selected = this.getSelectedGroupIds();
        if (selected.length === this.getSelectableGroups().length) return this.groups[0];
        if (selected.length === 1) return this.groups.find(group => group.id === selected[0]) || this.groups[0];
        return {
            id: 'custom',
            label: selected.map(groupId => this.groups.find(group => group.id === groupId)?.shortLabel || groupId).join('+'),
            shortLabel: '선택',
            ageLabel: '복수 구간'
        };
    },

    getSelectableGroups() {
        return this.groups.filter(group => group.id !== 'total');
    },

    getSelectedGroupIds() {
        const validIds = new Set(this.getSelectableGroups().map(group => group.id));
        const selected = this.selectedGroups.filter(groupId => validIds.has(groupId));
        return selected.length ? selected : [...validIds];
    },

    isAllGroupsSelected() {
        return this.getSelectedGroupIds().length === this.getSelectableGroups().length;
    },

    getGroupValue(feature, groupId) {
        const value = Number(feature.properties?.groupPopulation?.[groupId]);
        return Number.isFinite(value) ? value : 0;
    },

    getSelectedShares(feature) {
        const selected = this.getSelectedGroupIds();
        const values = selected.map(groupId => ({
            id: groupId,
            value: this.getGroupValue(feature, groupId)
        }));
        const total = values.reduce((sum, item) => sum + item.value, 0) || 1;
        return values
            .filter(item => item.value > 0)
            .map(item => ({ ...item, ratio: item.value / total }));
    },

    getFeatureBlendColor(feature) {
        const shares = this.getSelectedShares(feature);
        if (!shares.length) return this.getRegionColor(feature.properties || {});
        const color = new THREE.Color(0, 0, 0);
        shares.forEach(share => {
            const shareColor = new THREE.Color(this.groupColors[share.id] || this.getRegionColor(feature.properties || {}));
            color.r += shareColor.r * share.ratio;
            color.g += shareColor.g * share.ratio;
            color.b += shareColor.b * share.ratio;
        });
        return color.getHex();
    },

    renderAgeSelector() {
        const selector = document.getElementById('ageSelector');
        if (!selector) return;
        selector.replaceChildren(...this.groups.map(group => {
            const chip = document.createElement('button');
            chip.type = 'button';
            const active = group.id === 'total' ? this.isAllGroupsSelected() : this.getSelectedGroupIds().includes(group.id);
            chip.className = `age-chip ${active ? 'active' : ''}`;
            chip.dataset.group = group.id;
            chip.textContent = group.id === 'total' ? '전체' : `${group.label} (${group.ageLabel})`;
            return chip;
        }));
    },

    setGroup(group) {
        const selectable = this.getSelectableGroups().map(item => item.id);
        if (group === 'total') {
            this.selectedGroups = selectable;
        } else if (selectable.includes(group)) {
            const current = new Set(this.getSelectedGroupIds());
            if (current.has(group) && current.size > 1) current.delete(group);
            else current.add(group);
            this.selectedGroups = selectable.filter(groupId => current.has(groupId));
        }
        this.renderAgeSelector();
        document.querySelectorAll('[data-view-mode="total"]').forEach(btn => {
            btn.classList.toggle('active', this.isAllGroupsSelected());
        });
        if (this.features.length) {
            this.buildMap();
            this.updatePanel();
        }
    },

    resetView() {
        this.mapGroup.rotation.x = -0.18;
        this.mapGroup.rotation.z = -0.08;
        this.camera.position.set(0, -5.4, 13.8);
        this.camera.lookAt(0, 0, 0);
        this.requestRender();
    },

    updatePanel(feature = null) {
        const source = this.populationData?.source || 'kosis-pending';
        const live = source === 'kosis-live';
        const model = source === 'kosis-model';
        const panelFeatures = this.denseOnly ? this.visibleFeatures : this.features;
        const values = panelFeatures.map(item => this.getFeatureValue(item)).filter(Number.isFinite);
        const total = values.reduce((sum, value) => sum + value, 0);
        const selected = feature?.properties || null;
        const selectedGroup = this.getSelectedGroup();
        const forecast = !!this.populationData?.forecast;

        const visibleCount = this.visibleFeatures?.length || this.features.length;
        this.setText('populationDongCount', visibleCount ? `${visibleCount}개` : '-');
        this.setText('populationYear', this.populationData?.year || '-');
        this.setText(
            'populationStatusTitle',
            live ? 'KOSIS 학령구간 동기화' : (model ? 'KOSIS 기준 예측 모델' : 'KOSIS 연동 대기')
        );
        this.setText(
            'populationStatusText',
            live
                ? `초등·중등·고등·대학 연령대 값을 행정동 단위로 반영했습니다.${forecast ? ' 현재 연도 이후라 예측값으로 표시됩니다.' : ''}`
                : (this.populationData?.message || 'KOSIS API 템플릿이 설정되면 공식 값으로 높이가 갱신됩니다.')
        );
        this.setText('selectedRegionName', selected ? (selected.adm_nm || '행정동') : '화성·오산 전체');
        this.setText('selectedRegionMeta', selected ? this.getFeatureLabel({ properties: selected }) : `${selectedGroup.label} 구간의 합계와 지분으로 지형 높이가 갱신됩니다.${this.denseOnly ? ` 현재 상위 밀집동 ${visibleCount}개만 표시 중입니다.` : ''}`);
        this.setText('totalPopulationLabel', `${selectedGroup.label} 합계${forecast ? ' (예측)' : ''}`);
        this.setText('totalPopulation', total ? `${this.format(total)}명` : '-');
        const fill = document.getElementById('rangeBarFill');
        if (fill) fill.style.width = total ? '100%' : '38%';
    },

    setStatus(title, text) {
        this.setText('populationStatusTitle', title);
        this.setText('populationStatusText', text);
    },

    updateHover(event) {
        if (!this.renderer || !this.camera || this.drag.active) return;
        const feature = this.getFeatureAt(event);
        if (!feature) {
            this.clearHover();
            return;
        }
        if (this.hoveredFeature !== feature) {
            this.setHighlight(feature);
            this.updatePanel(feature);
        }
        this.showHover(event, feature);
    },

    selectAt(event) {
        const feature = this.getFeatureAt(event);
        if (!feature) return;
        this.setHighlight(feature);
        this.updatePanel(feature);
        this.showHover(event, feature);
    },

    getFeatureAt(event) {
        if (!this.renderer || !this.camera || !this.pickMeshes.length) return null;
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hit = this.raycaster.intersectObjects(this.pickMeshes, false)[0];
        return hit?.object?.userData?.feature || null;
    },

    setHighlight(feature) {
        this.meshes.forEach(mesh => {
            if (!mesh.userData?.regionMesh || !mesh.material?.emissive) return;
            mesh.material.emissive.setHex(mesh.userData.baseColor);
            mesh.material.emissive.multiplyScalar(mesh.userData.feature === feature ? 0.22 : 0.06);
            mesh.material.opacity = mesh.userData.feature === feature ? 1 : 0.9;
        });
        this.hoveredFeature = feature;
        this.requestRender();
    },

    clearHover() {
        const card = document.getElementById('hoverCard');
        if (card) card.hidden = true;
        this.meshes.forEach(mesh => {
            if (!mesh.userData?.regionMesh || !mesh.material?.emissive) return;
            mesh.material.emissive.setHex(mesh.userData.baseColor);
            mesh.material.emissive.multiplyScalar(0.06);
            mesh.material.opacity = 0.88;
        });
        this.hoveredFeature = null;
        this.updatePanel();
        this.requestRender();
    },

    showHover(event, feature) {
        const card = document.getElementById('hoverCard');
        if (!card) return;
        card.hidden = false;
        card.style.left = `${event.clientX - this.container.getBoundingClientRect().left}px`;
        card.style.top = `${event.clientY - this.container.getBoundingClientRect().top}px`;
        this.setText('hoverRegion', feature.properties?.adm_nm || '행정동');
        this.setText('hoverValue', this.getFeatureLabel(feature));
        this.renderHoverBreakdown(feature);
    },

    getFeatureLabel(feature) {
        const props = feature.properties || {};
        const group = this.getSelectedGroup();
        const value = this.getFeatureValue(feature);
        const suffix = this.populationData?.forecast ? ' 예측' : '';
        return Number.isFinite(value)
            ? `${group.label} ${this.format(value)}명${suffix}`
            : `${group.label} 데이터 대기`;
    },

    renderHoverBreakdown(feature) {
        const list = document.getElementById('hoverBreakdown');
        if (!list) return;
        const props = feature.properties || {};
        const total = Number(props.groupPopulation?.total ?? props.schoolAgePopulation) || 0;
        const selected = new Set(this.getSelectedGroupIds());
        const rows = this.groups
            .filter(group => group.id !== 'total')
            .map(group => {
                const rawValue = Number(props.groupPopulation?.[group.id]);
                const numericValue = Number.isFinite(rawValue) ? rawValue : 0;
                const ratio = total ? numericValue / total : 0;
                const row = document.createElement('div');
                row.className = `hover-breakdown-row ${selected.has(group.id) ? 'active' : ''}`;
                row.style.setProperty('--share-color', `#${(this.groupColors[group.id] || 0xffffff).toString(16).padStart(6, '0')}`);
                row.style.setProperty('--share-width', `${Math.round(ratio * 100)}%`);

                const label = document.createElement('span');
                label.textContent = `${group.shortLabel || group.label} (${group.ageLabel})`;

                const value = document.createElement('strong');
                value.textContent = `${this.format(numericValue)}명 · ${Math.round(ratio * 100)}%`;

                const bar = document.createElement('i');
                row.append(label, value, bar);
                return row;
            });
        list.replaceChildren(...rows);
    },

    setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    },

    format(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return '-';
        return Math.round(num).toLocaleString('ko-KR');
    },

    animate() {
        requestAnimationFrame(() => this.animate());
        if (!this.renderer || !this.scene || !this.camera || !this.needsRender) return;
        this.renderer.render(this.scene, this.camera);
        this.needsRender = false;
    }
};

document.addEventListener('DOMContentLoaded', () => SchoolAge3DMap.init());
