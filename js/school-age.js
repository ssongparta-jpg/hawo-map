const SchoolAge3DMap = {
    container: null,
    renderer: null,
    scene: null,
    camera: null,
    mapGroup: null,
    raycaster: null,
    pointer: null,
    meshes: [],
    features: [],
    populationData: null,
    selectedAge: 'total',
    drag: { active: false, x: 0, y: 0 },
    bounds: null,
    mapOffset: { x: 0, y: 0 },
    maxValue: 1,
    hoveredMesh: null,
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
        await this.loadData();
        this.animate();
    },

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x111317, 16, 34);

        this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
        this.camera.position.set(0, -12.5, 9.2);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);

        this.mapGroup = new THREE.Group();
        this.mapGroup.rotation.x = -0.58;
        this.mapGroup.rotation.z = -0.08;
        this.scene.add(this.mapGroup);

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
            const age = event.target.closest('[data-age]')?.dataset.age;
            if (age) this.setAge(age);
            const action = event.target.closest('[data-map-action]')?.dataset.mapAction;
            if (action === 'reset') this.resetView();
            const viewMode = event.target.closest('[data-view-mode]')?.dataset.viewMode;
            if (viewMode === 'total') this.setAge('total');
        });

        this.container.addEventListener('pointerdown', (event) => {
            this.drag.active = true;
            this.drag.x = event.clientX;
            this.drag.y = event.clientY;
            this.container.setPointerCapture(event.pointerId);
        });
        this.container.addEventListener('pointermove', (event) => {
            this.updateHover(event);
            if (!this.drag.active) return;
            const dx = event.clientX - this.drag.x;
            const dy = event.clientY - this.drag.y;
            this.mapGroup.rotation.z += dx * 0.004;
            this.mapGroup.rotation.x = Math.max(-0.95, Math.min(-0.32, this.mapGroup.rotation.x + dy * 0.003));
            this.drag.x = event.clientX;
            this.drag.y = event.clientY;
        });
        this.container.addEventListener('pointerup', (event) => {
            this.drag.active = false;
            this.container.releasePointerCapture(event.pointerId);
        });
        this.container.addEventListener('pointerleave', () => {
            this.drag.active = false;
            this.clearHover();
        });
        this.container.addEventListener('wheel', (event) => {
            event.preventDefault();
            this.camera.position.y = Math.max(-18, Math.min(-8, this.camera.position.y + Math.sign(event.deltaY) * 0.7));
            this.camera.position.z = Math.max(6.5, Math.min(13, this.camera.position.z + Math.sign(event.deltaY) * 0.35));
            this.camera.lookAt(0, 0, 0);
        }, { passive: false });
    },

    resize() {
        if (!this.renderer || !this.camera || !this.container) return;
        const width = Math.max(1, this.container.clientWidth);
        const height = Math.max(1, this.container.clientHeight);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    },

    async loadData() {
        try {
            const [geoRes, popRes] = await Promise.all([
                fetch('data/hwao.geojson', { cache: 'no-store' }),
                fetch('/api/school-age-population?ageFrom=6&ageTo=21', { cache: 'no-store' }).catch(() => null)
            ]);
            if (!geoRes.ok) throw new Error('geojson failed');
            const geojson = await geoRes.json();
            this.populationData = popRes && popRes.ok ? await popRes.json() : null;
            this.features = (geojson.features || []).filter(feature => {
                const sgg = feature.properties?.sggnm || '';
                return sgg.includes('화성시') || sgg.includes('오산시');
            });
            this.attachPopulation();
            this.buildMap();
            this.updatePanel();
        } catch (err) {
            this.setStatus('지도 로드 실패', '행정동 경계 데이터를 불러오지 못했습니다.');
        }
    },

    attachPopulation() {
        const byAdm = new Map();
        const popFeatures = this.populationData?.features || [];
        popFeatures.forEach(feature => {
            const props = feature.properties || {};
            byAdm.set(props.adm_cd2, {
                total: Number(props.schoolAgePopulation),
                byAge: props.agePopulation || {}
            });
        });

        this.features.forEach((feature, index) => {
            const props = feature.properties || {};
            const record = byAdm.get(props.adm_cd2) || {};
            props.schoolAgePopulation = Number.isFinite(record.total) ? record.total : null;
            props.agePopulation = record.byAge || {};
            props.visualFallback = this.fallbackValue(props, index);
        });
    },

    buildMap() {
        this.clearMap();
        this.bounds = this.computeBounds(this.features);
        this.mapOffset = { x: 0, y: 0 };
        this.maxValue = Math.max(...this.features.map(feature => this.getFeatureValue(feature)), 1);

        this.features.forEach(feature => {
            const meshes = this.createFeatureMeshes(feature);
            meshes.forEach(mesh => {
                this.meshes.push(mesh);
                this.mapGroup.add(mesh);
            });
        });

        const box = new THREE.Box3().setFromObject(this.mapGroup);
        const center = box.getCenter(new THREE.Vector3());
        this.mapOffset = { x: center.x, y: center.y };
        this.mapGroup.children.forEach(child => {
            if (child.geometry && child.userData?.isRegion) {
                child.position.x -= this.mapOffset.x;
                child.position.y -= this.mapOffset.y;
            }
        });
        this.addPopulationTowers();
    },

    clearMap() {
        this.meshes.forEach(mesh => {
            if (mesh.parent) mesh.parent.remove(mesh);
            mesh.geometry?.dispose();
            if (Array.isArray(mesh.material)) mesh.material.forEach(material => material.dispose());
            else mesh.material?.dispose();
        });
        this.meshes = [];
        [...this.mapGroup.children].forEach(child => {
            if (child.userData?.generated) {
                this.mapGroup.remove(child);
                child.geometry?.dispose();
                child.material?.dispose();
            }
        });
    },

    createFeatureMeshes(feature) {
        const props = feature.properties || {};
        const color = this.getRegionColor(props);
        const value = this.getFeatureValue(feature);
        const height = this.getHeight(value);
        const material = new THREE.MeshStandardMaterial({
            color,
            roughness: 0.58,
            metalness: 0.08,
            emissive: new THREE.Color(color).multiplyScalar(0.08)
        });
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x111317, transparent: true, opacity: 0.38 });
        const meshes = [];

        this.getPolygons(feature.geometry).forEach(polygon => {
            const shape = this.polygonToShape(polygon);
            if (!shape) return;
            const geometry = new THREE.ExtrudeGeometry(shape, {
                depth: height,
                bevelEnabled: true,
                bevelSize: 0.012,
                bevelThickness: 0.012,
                bevelSegments: 1
            });
            geometry.computeVertexNormals();
            const mesh = new THREE.Mesh(geometry, material.clone());
            mesh.userData = { feature, baseColor: color, isRegion: true, generated: true };
            meshes.push(mesh);

            const edgeGeometry = new THREE.EdgesGeometry(geometry, 34);
            const edge = new THREE.LineSegments(edgeGeometry, lineMaterial.clone());
            edge.userData = { feature, isRegion: true, generated: true, edgeFor: mesh };
            meshes.push(edge);
        });
        return meshes;
    },

    addPopulationTowers() {
        const towerGeometry = new THREE.BoxGeometry(0.07, 0.07, 1);
        this.features.forEach((feature, index) => {
            const center = this.getFeatureCenter(feature);
            const value = this.getFeatureValue(feature);
            const baseHeight = this.getHeight(value);
            const towerCount = value > this.maxValue * 0.62 ? 3 : value > this.maxValue * 0.36 ? 2 : 1;
            for (let i = 0; i < towerCount; i += 1) {
                const towerHeight = baseHeight * (0.55 + i * 0.22);
                const material = new THREE.MeshStandardMaterial({
                    color: this.getRegionColor(feature.properties || {}),
                    roughness: 0.48,
                    metalness: 0.16
                });
                const tower = new THREE.Mesh(towerGeometry, material);
                const angle = (index * 1.7 + i * 2.1) % (Math.PI * 2);
                const distance = 0.08 + i * 0.06;
                tower.position.set(
                    center.x + Math.cos(angle) * distance,
                    center.y + Math.sin(angle) * distance,
                    baseHeight + towerHeight / 2
                );
                tower.scale.z = towerHeight;
                tower.userData = { feature, generated: true, tower: true };
                this.meshes.push(tower);
                this.mapGroup.add(tower);
            }
        });
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
        if (this.selectedAge !== 'total') {
            const ageValue = Number(props.agePopulation?.[this.selectedAge]);
            if (Number.isFinite(ageValue)) return ageValue;
        }
        const total = Number(props.schoolAgePopulation);
        if (Number.isFinite(total)) return total;
        return props.visualFallback || 1;
    },

    getHeight(value) {
        const ratio = Math.max(0.08, Math.min(1, value / this.maxValue));
        return 0.1 + Math.pow(ratio, 0.72) * 1.85;
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

    renderAgeSelector() {
        const selector = document.getElementById('ageSelector');
        if (!selector) return;
        const chips = ['total', ...Array.from({ length: 16 }, (_, index) => String(index + 6))];
        selector.innerHTML = chips.map(age => {
            const label = age === 'total' ? '전체' : `${age}세`;
            return `<button type="button" class="age-chip ${age === this.selectedAge ? 'active' : ''}" data-age="${age}">${label}</button>`;
        }).join('');
    },

    setAge(age) {
        this.selectedAge = age;
        document.querySelectorAll('.age-chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.age === age);
        });
        document.querySelectorAll('[data-view-mode="total"]').forEach(btn => {
            btn.classList.toggle('active', age === 'total');
        });
        if (this.features.length) {
            this.buildMap();
            this.updatePanel();
        }
    },

    resetView() {
        this.mapGroup.rotation.x = -0.58;
        this.mapGroup.rotation.z = -0.08;
        this.camera.position.set(0, -12.5, 9.2);
        this.camera.lookAt(0, 0, 0);
    },

    updatePanel(feature = null) {
        const live = this.populationData?.source === 'kostat-live';
        const values = this.features.map(item => Number(item.properties?.schoolAgePopulation)).filter(Number.isFinite);
        const total = values.reduce((sum, value) => sum + value, 0);
        const selected = feature?.properties || null;

        this.setText('populationDongCount', this.features.length ? `${this.features.length}개` : '-');
        this.setText('populationYear', this.populationData?.year || '-');
        this.setText('populationStatusTitle', live ? '통계청 실시간 동기화' : '통계청 연동 대기');
        this.setText(
            'populationStatusText',
            live
                ? '6~21세 연령별 학령인구 값을 행정동 단위로 반영했습니다.'
                : (this.populationData?.message || '서버 API 키가 설정되면 통계청 값으로 높이가 갱신됩니다.')
        );
        this.setText('selectedRegionName', selected ? (selected.adm_nm || '행정동') : '화성·오산 전체');
        this.setText('selectedRegionMeta', selected ? this.getFeatureLabel({ properties: selected }) : '연령을 선택하면 해당 연령의 높이로 지도가 다시 그려집니다.');
        this.setText('totalPopulation', total ? `${this.format(total)}명` : '-');
        const fill = document.getElementById('rangeBarFill');
        if (fill) fill.style.width = live && total ? '100%' : '38%';
    },

    setStatus(title, text) {
        this.setText('populationStatusTitle', title);
        this.setText('populationStatusText', text);
    },

    updateHover(event) {
        if (!this.renderer || !this.camera) return;
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hit = this.raycaster.intersectObjects(this.meshes.filter(mesh => mesh.userData?.feature), false)[0];
        const mesh = hit?.object?.userData?.edgeFor || hit?.object;
        if (!mesh?.userData?.feature) {
            this.clearHover();
            return;
        }
        if (this.hoveredMesh !== mesh) {
            this.setHighlight(mesh);
            this.updatePanel(mesh.userData.feature);
        }
        this.showHover(event, mesh.userData.feature);
    },

    setHighlight(mesh) {
        if (this.hoveredMesh?.material?.emissive) {
            this.hoveredMesh.material.emissive.setHex(this.hoveredMesh.userData.baseColor);
            this.hoveredMesh.material.emissive.multiplyScalar(0.08);
        }
        this.hoveredMesh = mesh;
        if (mesh.material?.emissive) {
            mesh.material.emissive.setHex(0xffffff);
            mesh.material.emissive.multiplyScalar(0.16);
        }
    },

    clearHover() {
        const card = document.getElementById('hoverCard');
        if (card) card.hidden = true;
        if (this.hoveredMesh?.material?.emissive) {
            this.hoveredMesh.material.emissive.setHex(this.hoveredMesh.userData.baseColor);
            this.hoveredMesh.material.emissive.multiplyScalar(0.08);
        }
        this.hoveredMesh = null;
        this.updatePanel();
    },

    showHover(event, feature) {
        const card = document.getElementById('hoverCard');
        if (!card) return;
        card.hidden = false;
        card.style.left = `${event.clientX - this.container.getBoundingClientRect().left}px`;
        card.style.top = `${event.clientY - this.container.getBoundingClientRect().top}px`;
        this.setText('hoverRegion', feature.properties?.adm_nm || '행정동');
        this.setText('hoverValue', this.getFeatureLabel(feature));
    },

    getFeatureLabel(feature) {
        const value = this.getFeatureValue(feature);
        const suffix = this.selectedAge === 'total' ? '6~21세' : `${this.selectedAge}세`;
        const liveValue = Number(feature.properties?.schoolAgePopulation);
        const isLive = Number.isFinite(liveValue);
        return `${suffix} ${this.format(value)}명${isLive ? '' : ' (대기)'}`;
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
        if (!this.renderer || !this.scene || !this.camera) return;
        this.renderer.render(this.scene, this.camera);
    }
};

document.addEventListener('DOMContentLoaded', () => SchoolAge3DMap.init());
