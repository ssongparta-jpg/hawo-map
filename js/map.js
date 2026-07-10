const MapManager = {
    map: null,
    cluster: null,
    eduOfficeLayer: null,
    markers: [],
    boundaryGroup: L.layerGroup(),
    activeMarker: null, 
    activeTypeFilters: new Set(),
    showOnlyFavorites: false,
    favoriteNames: [],
    lastDistanceMarkerClickAt: 0,
    lastDistanceMarkerClickKey: '',

    init() {
        this.map = L.map('map', { zoomControl: false, minZoom: 10, maxZoom: 18, attributionControl: false });
        this.map.setView(MapConfig.MAP_CENTER, 11);
        this.map.setMaxBounds(MapConfig.BOUNDS);
        
        this.map.createPane('ultraTopPane');
        this.map.getPane('ultraTopPane').style.zIndex = 20000; 

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
        this.boundaryGroup.addTo(this.map);

        this.eduOfficeLayer = L.layerGroup().addTo(this.map);

        this.cluster = L.markerClusterGroup({
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            maxClusterRadius: 80, 
            disableClusteringAtZoom: 14, 
            singleMarkerMode: false,
            iconCreateFunction: (cluster) => {
                const count = cluster.getChildCount();
                let cSize = count >= 50 ? 'red' : count >= 15 ? 'yellow' : 'small';
                return L.divIcon({
                    html: `<div><span>${count}</span></div>`,
                    className: `marker-cluster marker-cluster-${cSize}`,
                    iconSize: [40, 40]
                });
            }
        }).addTo(this.map);

        this.bindEvents();
        this.map.on('contextmenu', () => {
            if (window.DistanceManager && DistanceManager.active && typeof DistanceManager.finish === 'function') {
                DistanceManager.finish();
            }
        });
    },

    getMarkerIcon(p, stackIndex = 0, count = 1) {
        let typeClass = 'is-spec';
        let symbolColor = this.safeCssColor(p.color, '#333');
        let stackClass = '';

        if (p.type.includes('교육') || p.name.includes('교육지원청')) {
            typeClass = 'is-edu'; 
        }
        else if (p.name.includes('유치원')) { typeClass = 'is-kinder'; }
        else if (p.name.includes('초등학교')) { typeClass = 'is-elem'; }
        else if (p.name.includes('중학교')) { typeClass = 'is-mid'; }
        else if (p.name.includes('고등학교')) { typeClass = 'is-high'; }

        if (count > 1) stackClass = `has-stack stack-pos-${stackIndex % 8}`;
        const safeName = this.escapeHtml(p.name);
        const stackBadge = count > 2 && stackIndex === 0
            ? `<div class="marker-stack-badge">${count > 9 ? '9+' : count}</div>`
            : '';
        
        // 동적 색상은 데이터에서 오므로 CSS 변수로만 전달합니다.
        const html = `
            <div class="custom-combined-marker ${typeClass} ${stackClass}" style="--marker-color:${symbolColor};">
                <div class="marker-label-box">${safeName}</div>
                <div class="marker-symbol"></div>
                ${stackBadge}
            </div>
        `;
        return L.divIcon({ className: 'marker-container-icon', html, iconSize: [0, 0] });
    },

    bindEvents() {
        this.map.on('zoomend', () => this.updateZoomState());
        this.updateZoomState();

        const toggleBtn = document.getElementById('toggle-boundary');
        if (toggleBtn) {
            toggleBtn.addEventListener('change', (e) => {
                if (e.target.checked) this.map.addLayer(this.boundaryGroup);
                else this.map.removeLayer(this.boundaryGroup);
            });
        }

        const favOnlyBtn = document.getElementById('toggle-favorite-only');
        if (favOnlyBtn) {
            favOnlyBtn.addEventListener('change', (e) => {
                this.filterFavorites(e.target.checked);
            });
        }

        document.addEventListener('click', (event) => {
            const focusBtn = event.target.closest('[data-focus-region]');
            if (focusBtn) this.focusRegion(focusBtn.dataset.focusRegion);
        });

        this.map.on('popupopen', async (e) => {
            const popupSource = e.popup?._source;
            if (window.DistanceManager && DistanceManager.active && popupSource?.properties) {
                popupSource.closePopup();
                this.map.closePopup(e.popup);
                return;
            }

            const popupNode = e.popup.getElement();
            const textarea = popupNode.querySelector('textarea[data-school-name]');
            const saveBtn = popupNode.querySelector('.memo-save-btn');
            const delBtn = popupNode.querySelector('.memo-del-btn');
            const favBtn = popupNode.querySelector('.fav-toggle-btn');

            requestAnimationFrame(() => {
                this.fitSpecialBusinessList(popupNode);
                requestAnimationFrame(() => this.fitSpecialBusinessList(popupNode));
            });

            if (textarea && saveBtn) {
                const schoolName = textarea.dataset.schoolName || '';
                const isLoggedIn = AuthManager.userId !== null;

                textarea.disabled = !isLoggedIn;
                saveBtn.disabled = !isLoggedIn;
                if (delBtn) delBtn.disabled = !isLoggedIn;
                if (favBtn) favBtn.onclick = (event) => this.toggleFavorite(schoolName, event);
                saveBtn.onclick = (event) => AuthManager.saveMemo(schoolName, event);
                if (delBtn) delBtn.onclick = (event) => AuthManager.deleteMemo(schoolName, event);

                // [리팩토링] 하드코딩 스타일 대신 클래스로 제어
                if (isLoggedIn) {
                    saveBtn.classList.remove('disabled-btn');
                    if (delBtn) delBtn.classList.remove('disabled-btn');
                    
                    if (favBtn) {
                        fetch(`/api/favorite/${encodeURIComponent(schoolName)}`)
                            .then(res => res.json())
                            .then(data => this.updateFavoriteUI(schoolName, data.isFavorite))
                            .catch(err => console.log("즐겨찾기 확인 실패"));
                    }

                    textarea.placeholder = "메모를 불러오는 중...";
                    try {
                        const res = await fetch(`/api/memo/${encodeURIComponent(schoolName)}`);
                        const data = await res.json();
                        textarea.value = data.content || "";
                        textarea.placeholder = "여기에 메모를 작성하세요";
                    } catch(err) { 
                        textarea.placeholder = "메모 로드 실패"; 
                    }
                } else {
                    saveBtn.classList.add('disabled-btn');
                    if (delBtn) delBtn.classList.add('disabled-btn');
                    textarea.value = ""; 
                    textarea.placeholder = "로그인 후 이용 가능합니다";
                }
            }
        });
    },

    updateZoomState() {
        if (!this.map) return;
        const zoom = this.map.getZoom();

        document.querySelectorAll('.dist-stat-btn').forEach(btn => {
            btn.classList.forEach(cls => {
                if (cls.startsWith('zoom-lv-')) btn.classList.remove(cls);
            });
            btn.classList.add(`zoom-lv-${zoom}`);
        });

        const mapContainer = this.map.getContainer();
        if (!mapContainer) return;
        const labelZoom = MapConfig.isSharedMode ? 13 : 15;
        mapContainer.classList.toggle('view-labels-mode', zoom >= labelZoom);
    },

    async filterFavorites(showOnlyFav) {
        if (showOnlyFav && !AuthManager.userId) {
            alert("로그인이 필요한 기능입니다.");
            const toggle = document.getElementById('toggle-favorite-only');
            if(toggle) toggle.checked = false;
            return;
        }

        try {
            this.showOnlyFavorites = showOnlyFav;
            this.favoriteNames = [];
            if (showOnlyFav) {
                const res = await fetch('/api/my-favorites');
                const data = await res.json();
                this.favoriteNames = data.favorites || [];
            }

            this.applyMarkerFilters();
        } catch(err) {
            console.error(err);
            alert("목록을 불러오는데 실패했습니다.");
            const toggle = document.getElementById('toggle-favorite-only');
            if(toggle) toggle.checked = false;
        }
    },

    setTypeFilters(types) {
        this.activeTypeFilters = new Set(types || []);
        this.applyMarkerFilters();
    },

    applyMarkerFilters() {
        this.cluster.clearLayers();
        this.eduOfficeLayer.clearLayers();

        this.markers.forEach(marker => {
            const p = marker.properties || {};
            const isEdu = String(p.type || '').includes('교육') || String(p.name || '').includes('교육지원청');
            const matchesType = this.activeTypeFilters.size === 0 || this.activeTypeFilters.has(p.type);
            const matchesFavorite = !this.showOnlyFavorites || this.favoriteNames.includes(p.name);

            if (!matchesFavorite) return;
            if (isEdu) {
                if (this.activeTypeFilters.size === 0) this.eduOfficeLayer.addLayer(marker);
                return;
            }
            if (matchesType) this.cluster.addLayer(marker);
        });
    },

    async toggleFavorite(schoolName, event) {
        if (event) event.stopPropagation();
        if (AuthManager.userId === null) { alert("로그인 후 이용 가능합니다."); return; }
        try {
            const res = await fetch('/api/favorite/toggle', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({schoolName})
            });
            const data = await res.json();
            if (data.success) this.updateFavoriteUI(schoolName, data.isFavorite);
        } catch(err) { alert("즐겨찾기 변경 실패"); }
    },

    updateFavoriteUI(schoolName, isFavorite) {
        const favBtn = document.getElementById(`fav-btn-${this.getSchoolDomId(schoolName)}`);
        if (favBtn) {
            favBtn.innerText = isFavorite ? "★": "☆";
            // [리팩토링] 하드코딩 색상 대신 active 클래스 사용
            if (isFavorite) favBtn.classList.add('active');
            else favBtn.classList.remove('active');
        }
    },

    createMarker(lat, lng, p, stackIndex = 0, count = 1) {
        const isMobile = window.innerWidth <= 768;
        const autoPanPaddingVal = isMobile ? L.point(160, 50) : L.point(80, 50);
        const marker = L.marker([lat, lng], {
            icon: this.getMarkerIcon(p, stackIndex, count),
            zIndexOffset: 100 - stackIndex * 10
        }).bindPopup(this.makePopupHtml(p), {
            className: 'custom-popup',
            pane: 'ultraTopPane', 
            autoPanPadding: L.point(20, 20),
            autoPanPaddingTopLeft: autoPanPaddingVal 
        });
        this.disableAutoPopup(marker);
        this.wireDistanceMarkerDom(marker);
        marker.properties = p;
        marker.on('click', (e) => {
             if (this.handleDistanceMarkerClick(marker, e)) return;
             if (this.activeMarker) this.activeMarker.setZIndexOffset(100); 
             marker.setZIndexOffset(10000); 
             this.activeMarker = marker;
             marker.openPopup();
        });
        return marker;
    },

    disableAutoPopup(marker) {
        if (marker && typeof marker.off === 'function' && marker._openPopup) {
            marker.off('click', marker._openPopup, marker);
        }
    },

    wireDistanceMarkerDom(marker) {
        const bind = () => {
            const icon = marker.getElement?.();
            if (!icon || icon.dataset.distancePickBound === '1') return;

            icon.dataset.distancePickBound = '1';
            const pickPoint = (event) => {
                this.handleDistanceMarkerClick(marker, { originalEvent: event });
            };

            L.DomEvent.on(icon, 'pointerdown', pickPoint, this);
            L.DomEvent.on(icon, 'mousedown', pickPoint, this);
            L.DomEvent.on(icon, 'click', pickPoint, this);
            L.DomEvent.on(icon, 'touchend', pickPoint, this);
        };

        marker.on('add', () => requestAnimationFrame(bind));
        setTimeout(bind, 0);
    },

    handleDistanceMarkerClick(marker, e) {
        if (!window.DistanceManager || !DistanceManager.active || DistanceManager.isPaused) return false;
        if (e?.originalEvent) {
            e.originalEvent.preventDefault?.();
            L.DomEvent.stop(e.originalEvent);
        }
        const latlng = marker.getLatLng();
        const clickKey = `${latlng.lat.toFixed(7)},${latlng.lng.toFixed(7)}`;
        const now = Date.now();
        if (this.lastDistanceMarkerClickKey === clickKey && now - this.lastDistanceMarkerClickAt < 500) return true;

        this.lastDistanceMarkerClickKey = clickKey;
        this.lastDistanceMarkerClickAt = now;

        if (typeof DistanceManager.addPoint === 'function') DistanceManager.addPoint(latlng);
        marker.closePopup();
        if (this.map) this.map.closePopup();
        return true;
    },

    triggerMarkerPopup(e, name) {
        if (e) { e.stopPropagation(); }
        const target = this.markers.find(m => m.properties.name === name);
        if (target) {
            if (this.handleDistanceMarkerClick(target, e ? { originalEvent: e } : null)) return;
            if (this.activeMarker) this.activeMarker.setZIndexOffset(100);
            target.setZIndexOffset(10000);
            this.activeMarker = target;
            target.openPopup(); 
        }
    },

    focusMarker(m) {
        this.map.flyTo(m.getLatLng(), 16, { duration: 1.5 });
        this.map.once('moveend', () => {
            if (this.handleDistanceMarkerClick(m)) return;
            if (this.activeMarker) this.activeMarker.setZIndexOffset(100);
            m.setZIndexOffset(10000);
            this.activeMarker = m;
            m.openPopup();
        });
    },

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    },

    escapeAttr(value) {
        return this.escapeHtml(value).replace(/`/g, '&#96;');
    },

    safeUrl(value) {
        try {
            const url = new URL(String(value || ''), window.location.origin);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch(e) {
            return '';
        }
    },

    safeCssColor(value, fallback = '#333') {
        const color = String(value || '').trim();
        if (/^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(color)) return color;
        if (/^(rgb|hsl)a?\([\d\s,%.]+\)$/.test(color)) return color;
        return fallback;
    },

    getSchoolDomId(schoolName) {
        return encodeURIComponent(String(schoolName || '')).replace(/%/g, '_');
    },

    getSpecialBusinessItems(rawValue) {
        return String(rawValue || '')
            .split(/[,，\n]+/)
            .map(item => item.trim())
            .filter(item => item && item !== '-' && item.toLowerCase() !== 'no data');
    },

    getVisualTextLength(text) {
        return Array.from(String(text ?? '')).reduce((total, char) => {
            return total + (/^[\x00-\x7F]$/.test(char) ? 0.58 : 1);
        }, 0);
    },

    getSpecialBusinessFontSize(items) {
        const totalLength = items.reduce((sum, item) => sum + this.getVisualTextLength(item), 0);
        const separatorLength = Math.max(0, items.length - 1) * 1.5;
        const longestLength = Math.max(...items.map(item => this.getVisualTextLength(item)));
        const fitLength = totalLength + separatorLength + Math.max(0, longestLength - 18) * 0.5;

        if (fitLength > 78 || items.length >= 7) return 8;
        if (fitLength > 64 || items.length >= 5) return 8.8;
        if (fitLength > 50 || longestLength > 16) return 9.5;
        return 10.5;
    },

    fitSpecialBusinessList(scope = document) {
        const lists = scope.querySelectorAll('.popup-special-bs-list');
        lists.forEach(list => {
            const chips = [...list.querySelectorAll('.popup-special-bs-badge')];
            if (!chips.length) return;

            const card = list.closest('.popup-special-bs-box');
            const minFontSize = 7.8;
            const baseFontSize = Number(list.dataset.fontSize || 10.5);
            let fontSize = baseFontSize;

            const setFontSize = (size) => {
                list.style.setProperty('--popup-special-bs-font-size', `${size}px`);
            };
            const isOverflowing = () => {
                return list.scrollHeight > list.clientHeight + 1 ||
                    chips.some(chip => chip.scrollWidth > chip.clientWidth + 1);
            };

            if (card) card.classList.remove('is-overflowing');
            setFontSize(fontSize);

            while (fontSize > minFontSize && isOverflowing()) {
                fontSize = Math.max(minFontSize, Number((fontSize - 0.4).toFixed(1)));
                setFontSize(fontSize);
            }

            if (isOverflowing()) {
                if (card) card.classList.add('is-overflowing');
            }
        });
    },

    makeSpecialBusinessHtml(rawValue) {
        const items = this.getSpecialBusinessItems(rawValue);
        if (!items.length) return '';

        const fontSize = this.getSpecialBusinessFontSize(items);
        const itemHtml = items
            .map(item => {
                const safeItem = this.escapeHtml(item);
                return `<span class="popup-special-bs-badge" title="${safeItem}">${safeItem}</span>`;
            })
            .join('');

        return `
                <fieldset class="popup-special-bs-box" aria-label="특색사업">
                    <legend class="popup-special-bs-title">🎨 특색사업</legend>
                    <div class="popup-special-bs-list" aria-label="특색사업명 목록" data-font-size="${fontSize}" style="--popup-special-bs-font-size:${fontSize}px;">${itemHtml}</div>
                </fieldset>`;
    },

    makePopupHtml(p) {
        const isEduOffice = (p.type && p.type.includes('교육')) || p.name.includes('교육지원청');
        let principalName = p.principal;
        if (!principalName || principalName === 'No Data' || principalName.trim() === '') principalName = '정보 없음'; 

        const safeUrl = this.safeUrl(p.url);
        const linkHtml = safeUrl
            ? `<a href="${this.escapeAttr(safeUrl)}" target="_blank" rel="noopener noreferrer" class="popup-link-top" title="새 창으로 열기">🏠 홈페이지 이동 ↗</a>`
            : '<span class="popup-link-none">❌ 홈페이지 없음</span>';
            
        const estBadge = p.establish ? `<span class="badge-est">${this.escapeHtml(p.establish)}</span>` : '';
        const specialBusinessHtml = this.makeSpecialBusinessHtml(p.special_bs);
        const safeName = this.escapeHtml(p.name || '');
        const safeType = this.escapeHtml(p.type || '교육기관');
        const safeAddress = this.escapeHtml(p.adrs || '');
        const schoolNameAttr = this.escapeAttr(p.name || '');
        const schoolDomId = this.getSchoolDomId(p.name || '');
        
        // [리팩토링] 인라인 스타일 걷어내고 시맨틱 태그 및 클래스 적용
        let bodyContent = '';
        if (isEduOffice) {
            bodyContent = `
                <div class="edu-office-box">
                    <span class="edu-office-label">교육장</span>
                    <strong class="edu-office-name">${this.escapeHtml(principalName)}</strong>
                </div>
                <div class="edu-office-slogan">행복한 성장, 함께하는 화성오산 교육</div>`;
        } else {
            const vicePrincipal = p.vice_principal || '-';
            const chiefAdmin = p.chief_of_administration || '-';
            bodyContent = `
                <div class="popup-admin-row">
                    <span>교장(원장) <strong>${this.escapeHtml(principalName)}</strong></span><span class="divider">|</span>
                    <span>교감(원감) <strong>${this.escapeHtml(vicePrincipal)}</strong></span><span class="divider">|</span>
                    <span>행정실장 <strong>${this.escapeHtml(chiefAdmin)}</strong></span>
                </div>
                <ul class="popup-info-list grid-list">
                    <li><span class="label">학생 수</span> <span class="value"><strong>${Number(p.stdnt_cnt || 0).toLocaleString()}</strong>명</span></li>
                    <li><span class="label">교사 수</span> <span class="value"><strong>${p.tchr_cnt || 0}</strong>명</span></li>
                    <li><span class="label">학급 수</span> <span class="value"><strong>${p.class_cnt || 0}</strong>개</span></li>
                    <li><span class="label">학급당 학생 수</span> <span class="value"><strong>${p.stdnt_per_cl || 0}</strong>명</span></li>
                    <li><span class="label">교사 1인당 학생 수</span> <span class="value"><strong>${p.stdnt_per_tchr || 0}</strong>명</span></li>
                </ul>`;
        }

        return `
            <div class="popup-content compact-mode">
                <div class="popup-header">
                    <div class="popup-category">${safeType} ${estBadge}</div>
                    ${linkHtml}
                </div>
                <div class="popup-title-row">
                    <h3 class="popup-title">${safeName}</h3>
                    <button id="fav-btn-${schoolDomId}" class="fav-toggle-btn" data-school-name="${schoolNameAttr}" type="button">☆</button>
                </div>
                <div class="popup-adrs">${safeAddress}</div>
                ${specialBusinessHtml}
                <hr class="popup-hr">
                ${bodyContent}
                
                <div class="memo-section">
                    <div class="memo-title">🏫 개인 메모</div>
                    <textarea id="memo-${schoolDomId}" class="memo-textarea" data-school-name="${schoolNameAttr}" disabled></textarea>
                    <div class="memo-btn-group">
                        <button id="btn-save-${schoolDomId}" class="memo-btn memo-save-btn disabled-btn" type="button" disabled>저장</button>
                        <button id="btn-del-${schoolDomId}" class="memo-btn memo-del-btn disabled-btn" type="button" disabled>삭제</button>
                    </div>
                </div>
            </div>`;
    },

    async loadBoundaries() {
        try {
            const [dongRes, boundaryRes] = await Promise.all([
                fetch('data/hwao.geojson'),
                fetch('data/hwao_boundary.geojson')
            ]);
            if (!dongRes.ok || !boundaryRes.ok) throw new Error();
            const dongData = await dongRes.json();
            const boundaryData = await boundaryRes.json();

            this.boundaryGroup.clearLayers();
            if (!this.map.getPane('boundaryPane')) {
                this.map.createPane('boundaryPane');
                this.map.getPane('boundaryPane').style.zIndex = 250; 
                this.map.getPane('boundaryPane').style.pointerEvents = 'none';
            }
            L.geoJson(dongData, {
                style: (feature) => {
                    const admNm = feature.properties?.adm_nm || '';
                    let fillColor = '#ccc';
                    if (admNm.includes('오산시')) fillColor = MapConfig.DISTRICTS['오산시'].color;
                    else {
                        const guKey = Object.keys(MapConfig.DISTRICTS).find(k => MapConfig.DISTRICTS[k].keywords?.some(w => admNm.includes(w)));
                        fillColor = guKey ? MapConfig.DISTRICTS[guKey].color : MapConfig.DISTRICTS['화성시'].color;
                    }
                    return { fillColor, fillOpacity: 0.35, color: '#ffffff', weight: 2.5, dashArray: '20,5,2,5', pane: 'boundaryPane' };
                }
            }).addTo(this.boundaryGroup);

            L.geoJson(boundaryData, {
                style: (f) => {
                    const sgg = f.properties.sggnm;
                    let hwaseongBorder = '#0047AB';
                    let osanBorder = '#e7733d';
                    
                    if (MapConfig.CustomColors && MapConfig.CustomColors.general) {
                        hwaseongBorder = MapConfig.CustomColors.general.hwaseongBorder;
                        osanBorder = MapConfig.CustomColors.general.osanBorder;
                    }

                    const col = sgg === '화성시' ? hwaseongBorder : sgg === '오산시' ? osanBorder : 'transparent';
                    return { fill: false, color: col, weight: 3, pane: 'boundaryPane' };
                }
            }).addTo(this.boundaryGroup);
        } catch (e) { console.error('경계 로드 실패'); }
    },

    addDistrictButtons() {
        Object.entries(MapConfig.DISTRICTS).forEach(([key, conf]) => {
            if (!conf.pos) return;
            
            let labelName = conf.fullName;
            if (['동탄구', '병점구', '효행구', '만세구'].includes(key)) {
                labelName = key; 
            }
            
            const icon = L.divIcon({
                className: 'district-stat-marker',
                html: `
                        <div class="dist-stat-btn zoom-lv-${this.map.getZoom()}" style="background-color:${this.safeCssColor(conf.color, '#4A90E2')} !important;">
                        <span class="dist-stat-label">${labelName}</span>
                    </div>
                `,
                iconSize: [120, 36]
            });

            // zIndexOffset을 높게 주어 다른 마커들에 파묻히지 않게 고정합니다.
            L.marker(conf.pos, { icon, zIndexOffset: 5000 }).addTo(this.map).on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                this.showDistrictStats(key, conf);
            });
        });
    },

    showDistrictStats(regionKey, config) {
        const keywords = config.keywords || [];
        
        const regionMarkers = this.markers.filter(m => {
            const p = m.properties || {};
            let adrs = String(p.adrs || p.address || p['주소'] || p['학교주소'] || "");
            if (!adrs.trim()) adrs = Object.values(p).join(" ");
            
            if (regionKey === '화성시') return adrs.includes('화성');
            if (regionKey === '오산시') return adrs.includes('오산');
            return keywords.some(kw => adrs.includes(kw));
        });

        const totalSchools = regionMarkers.length;
        let totalStudents = 0;
        let totalTeachers = 0;

        regionMarkers.forEach(m => {
            const p = m.properties || {};
            totalStudents += (p.stdnt_cnt || 0);
            totalTeachers += (p.tchr_cnt || 0);
        });

        const fmt = (num) => num.toLocaleString('ko-KR');

        const popupContent = `
            <div class="stat-popup-card">
                <div class="stat-popup-header" style="border-bottom-color: ${this.safeCssColor(config.color, '#4A90E2')};">
                    <span class="stat-popup-title">${this.escapeHtml(config.fullName)}</span>
                    <span class="stat-popup-badge" style="background:${this.safeCssColor(config.color, '#4A90E2')};">총 ${fmt(totalSchools)}개교</span>
                </div>
                
                <div class="stat-popup-body">
                    <div class="stat-row border-orange">
                        <span class="stat-label">학교 수</span>
                        <span class="stat-value">${fmt(totalSchools)}<span class="stat-unit">개교</span></span>
                    </div>
                    <div class="stat-row border-green">
                        <span class="stat-label">총 학생 수</span>
                        <span class="stat-value">${fmt(totalStudents)}<span class="stat-unit">명</span></span>
                    </div>
                    <div class="stat-row border-blue">
                        <span class="stat-label">총 교사 수</span>
                        <span class="stat-value">${fmt(totalTeachers)}<span class="stat-unit">명</span></span>
                    </div>
                </div>

                <div class="stat-popup-footer">
                    <button class="btn-focus-region" data-focus-region="${this.escapeAttr(regionKey)}">
                        이 지역으로 지도 이동 🔍
                    </button>
                </div>
            </div>
        `;

        // 팝업이 증발하지 않도록 가장 확실하고 안전한 기본 방식으로 띄웁니다.
        L.popup({
            className: 'custom-stat-popup',
            closeButton: true,
            offset: L.point(0, -20),
            autoPan: true
        })
        .setLatLng(config.pos)
        .setContent(popupContent)
        .openOn(this.map);
    },

    focusRegion(key) {
        const conf = MapConfig.DISTRICTS[key];
        if (conf && conf.pos) {
            this.map.setView(conf.pos, 14);
            this.map.closePopup();
        }
    }
};

const SchoolAgePopulationMap = {
    active: false,
    loading: false,
    layerGroup: L.layerGroup(),
    barGroup: L.layerGroup(),
    panel: null,
    activeButton: null,

    async toggle(button) {
        if (!MapManager.map || this.loading) return;
        this.activeButton = button || this.activeButton;
        if (this.active) {
            this.hide();
            return;
        }

        this.loading = true;
        this.setButtonState(true, true);
        try {
            const data = await this.fetchPopulation();
            this.show(data);
        } catch (err) {
            this.showError('학령인구 데이터를 불러오지 못했습니다.');
        } finally {
            this.loading = false;
            this.setButtonState(this.active, false);
        }
    },

    async fetchPopulation() {
        const res = await fetch('/api/school-age-population');
        if (!res.ok) throw new Error('population request failed');
        return res.json();
    },

    show(data) {
        this.active = true;
        this.ensurePane();
        this.layerGroup.clearLayers();
        this.barGroup.clearLayers();
        this.layerGroup.addTo(MapManager.map);
        this.barGroup.addTo(MapManager.map);

        const features = Array.isArray(data?.features) ? data.features : [];
        const values = features.map(f => Number(f.properties?.schoolAgePopulation)).filter(Number.isFinite);
        const max = values.length ? Math.max(...values) : 0;
        const min = values.length ? Math.min(...values) : 0;

        L.geoJson({ type: 'FeatureCollection', features }, {
            pane: 'schoolAgePane',
            style: (feature) => this.getPolygonStyle(feature, min, max),
            onEachFeature: (feature, layer) => {
                const props = feature.properties || {};
                const value = Number(props.schoolAgePopulation);
                const hasValue = Number.isFinite(value);
                const name = MapManager.escapeHtml(props.adm_nm || props.name || '행정동');
                const label = hasValue ? `${this.formatNumber(value)}명` : '연동 대기';
                layer.bindTooltip(`${name}<br>${label}`, {
                    sticky: true,
                    className: 'school-age-tooltip'
                });

                const center = layer.getBounds().getCenter();
                this.addPopulationBar(center, props, hasValue ? value : null, max);
            }
        }).addTo(this.layerGroup);

        this.renderPanel(data, min, max, values.length);
        MapManager.map.setView([37.19, 126.99], 11);
        this.setButtonState(true, false);
    },

    hide() {
        this.active = false;
        this.layerGroup.clearLayers();
        this.barGroup.clearLayers();
        if (MapManager.map) {
            MapManager.map.removeLayer(this.layerGroup);
            MapManager.map.removeLayer(this.barGroup);
        }
        if (this.panel) this.panel.remove();
        this.panel = null;
        this.setButtonState(false, false);
    },

    showError(message) {
        this.hide();
        const panel = this.ensurePanel();
        panel.innerHTML = `
            <div class="school-age-panel-title">학령인구 지도</div>
            <div class="school-age-panel-note">${MapManager.escapeHtml(message)}</div>
        `;
    },

    ensurePane() {
        if (!MapManager.map.getPane('schoolAgePane')) {
            MapManager.map.createPane('schoolAgePane');
            MapManager.map.getPane('schoolAgePane').style.zIndex = 360;
        }
    },

    ensurePanel() {
        if (this.panel) return this.panel;
        this.panel = document.createElement('div');
        this.panel.className = 'school-age-panel';
        (document.querySelector('.container') || document.body).appendChild(this.panel);
        this.panel.addEventListener('click', (event) => {
            const action = event.target.closest('[data-school-age-action]')?.dataset.schoolAgeAction;
            if (action === 'close') this.hide();
            if (action === 'refresh') this.refresh();
        });
        return this.panel;
    },

    async refresh() {
        if (!this.active || this.loading) return;
        this.loading = true;
        this.setButtonState(true, true);
        try {
            const res = await fetch('/api/school-age-population?refresh=1');
            if (!res.ok) throw new Error('refresh failed');
            this.show(await res.json());
        } catch (err) {
            this.showError('새로고침에 실패했습니다.');
        } finally {
            this.loading = false;
            this.setButtonState(this.active, false);
        }
    },

    renderPanel(data, min, max, syncedCount) {
        const panel = this.ensurePanel();
        const isLive = data?.source === 'kostat-live';
        const status = isLive ? '통계청 동기화' : '통계청 연동 대기';
        const statusClass = isLive ? 'is-live' : 'is-pending';
        const year = MapManager.escapeHtml(data?.year || '최신');
        const note = isLive
            ? `동별 학령인구 ${this.formatNumber(min)}명 - ${this.formatNumber(max)}명`
            : '서버 환경변수에 통계청 API 키를 넣으면 실시간 값으로 채워집니다.';

        panel.innerHTML = `
            <div class="school-age-panel-head">
                <div>
                    <div class="school-age-panel-title">학령인구 3D 지도</div>
                    <div class="school-age-panel-sub">${year}년 · ${MapManager.escapeHtml(status)}</div>
                </div>
                <button type="button" class="school-age-close" data-school-age-action="close">×</button>
            </div>
            <div class="school-age-status ${statusClass}">${MapManager.escapeHtml(note)}</div>
            <div class="school-age-scale">
                <span>낮음</span><div></div><span>높음</span>
            </div>
            <div class="school-age-panel-meta">
                동기화 행정동 ${this.formatNumber(syncedCount)}개
                <button type="button" data-school-age-action="refresh">새로고침</button>
            </div>
        `;
    },

    addPopulationBar(latlng, props, value, max) {
        const ratio = value && max ? Math.max(0.12, value / max) : 0.12;
        const height = Math.round(18 + ratio * 54);
        const name = MapManager.escapeHtml(props.adm_nm || '행정동');
        const label = value ? this.formatNumber(value) : '-';
        const icon = L.divIcon({
            className: 'school-age-bar-icon',
            html: `
                <div class="school-age-bar-wrap" title="${name}">
                    <div class="school-age-bar" style="height:${height}px"></div>
                    <div class="school-age-bar-label">${label}</div>
                </div>
            `,
            iconSize: [46, height + 24],
            iconAnchor: [23, height + 20]
        });
        L.marker(latlng, { icon, interactive: false, zIndexOffset: 3000 }).addTo(this.barGroup);
    },

    getPolygonStyle(feature, min, max) {
        const value = Number(feature.properties?.schoolAgePopulation);
        const hasValue = Number.isFinite(value);
        const ratio = hasValue && max > min ? (value - min) / (max - min) : 0;
        const fillColor = hasValue ? this.getColor(ratio) : '#94a3b8';
        return {
            pane: 'schoolAgePane',
            fillColor,
            fillOpacity: hasValue ? 0.62 : 0.22,
            color: '#ffffff',
            weight: 1.3,
            opacity: 0.95
        };
    },

    getColor(ratio) {
        if (ratio > 0.78) return '#0f766e';
        if (ratio > 0.55) return '#14b8a6';
        if (ratio > 0.32) return '#67e8f9';
        return '#d9f99d';
    },

    setButtonState(active, loading) {
        document.querySelectorAll('[data-action="toggle-school-age"]').forEach(btn => {
            btn.classList.toggle('active', active);
            btn.classList.toggle('loading', loading);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    },

    formatNumber(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return '-';
        return num.toLocaleString('ko-KR');
    }
};
