const SearchManager = {
    init() {
        const input = document.getElementById('schoolSearch');
        const resultBox = document.getElementById('searchResults');
        
        if (!input || !resultBox) return;

        // 검색창 입력 이벤트
        input.addEventListener('keyup', (e) => {
            const val = e.target.value.trim();
<<<<<<< HEAD
            
            // 엔터키 입력 시 바로 상세 결과창(대시보드) 띄우기
            if (e.key === 'Enter' && val.length >= 1) {
                const matches = this.getMatches(val);
                if (matches.length > 0) {
                    this.close();
                    this.showResultsPage(matches, val);
                }
                return;
            }

            // 입력값이 없으면 결과창 숨김
            if (val.length < 1) { 
                resultBox.style.display = 'none'; 
                return; 
            }
            
            const matches = this.getMatches(val);
            this.renderResults(matches, resultBox, val);
=======
            if (val.length < 1) { resultBox.style.display = 'none'; return; }
            const matches = MapManager.markers.filter(m => m.properties.name.includes(val));
            this.renderResults(matches, resultBox);
>>>>>>> parent of 5b107bf (범례 간격/교육청필터및통계제거/길찾기 1차 업데이트)
        });
        
        // 검색창 외부 클릭 시 드롭다운 닫기
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-wrapper')) {
                resultBox.style.display = 'none';
            }
        });
    },

    // 🔍 검색 필터링 로직 (빈칸 오류 방지 및 공유학교/교육청 제외)
    getMatches(val) {
        return MapManager.markers.filter(m => {
            const p = m.properties;
            const sType = String(p.type || '');
            const sName = String(p.name || '');
            
            // 교육지원청과 공유학교는 일반 검색에서 제외
            if (sType.includes('교육') || sName.includes('교육지원청') || sType === '공유학교') return false; 
            
            return sName.includes(val);
        });
    },

    // 📋 드롭다운 결과 렌더링 (최대 8개)
    renderResults(matches, container, val) {
        container.innerHTML = '';
        if (matches.length === 0) { 
            container.style.display = 'none'; 
            return; 
        }
        
        matches.slice(0, 8).forEach(m => {
            const div = document.createElement('div');
            div.className = 'search-item';
            let typeColor = '#333';
            
            const sName = String(m.properties.name || '');
            const sType = String(m.properties.type || '');
            
            // 학교급별 마커 색상 매칭
            if (sType.includes('초등') || sName.includes('초등학교')) typeColor = '#2ECC71';
            else if (sType.includes('중학') || sName.includes('중학교')) typeColor = '#3498DB';
            else if (sType.includes('고등') || sName.includes('고등학교')) typeColor = '#E74C3C';
            else if (sType.includes('유치') || sName.includes('유치원')) typeColor = '#F1C40F';
            else if (sType.includes('특수') || sName.includes('특수')) typeColor = '#9B59B6';
            
            div.innerHTML = `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${typeColor}; margin-right:8px;"></span>${sName}`;
            div.onclick = () => { 
                this.close(); 
                this.focusSchool(m); 
            };
            container.appendChild(div);
        });
        
        container.style.display = 'block';

<<<<<<< HEAD
        // 검색 결과가 8개를 초과할 경우 '더보기' 버튼 추가
        if (matches.length > 8) {
            const moreBtn = document.createElement('div');
            moreBtn.className = 'search-item';
            moreBtn.style.textAlign = 'center';
            moreBtn.style.fontWeight = 'bold';
            moreBtn.style.color = '#4A90E2';
            moreBtn.style.borderTop = '1px solid #eee';
            moreBtn.style.marginTop = '4px';
            moreBtn.style.paddingTop = '8px';
            moreBtn.innerText = `+ ${matches.length - 8}개 결과 더보기`;
            moreBtn.onclick = () => { 
                this.close(); 
                this.showResultsPage(matches, val); 
            };
            container.appendChild(moreBtn);
=======
        const filtered = MapManager.markers.filter(m => {
            const p = m.properties;
            const matchName = !nameQuery || p.name.includes(nameQuery);
            const matchType = this.selectedTypes.size === 0 || this.selectedTypes.has(p.type);
            const estVal = (p.establish || '').trim();
            const matchEst = this.selectedEst.size === 0 || Array.from(this.selectedEst).some(e => estVal === e);
            let matchDist = this.selectedDistricts.size === 0 || Array.from(this.selectedDistricts).some(distKey => {
                if (distKey === "오산시") return p.adrs.includes("오산시");
                return MapConfig.DISTRICTS[distKey]?.keywords?.some(k => p.adrs.includes(k));
            });

            const sVal = parseFloat(p.stdnt_cnt) || 0;
            const cVal = parseFloat(p.class_cnt) || 0;
            const tVal = parseFloat(p.tchr_cnt) || 0;
            const scVal = parseFloat(p.stdnt_per_cl) || 0;
            const stVal = parseFloat(p.stdnt_per_tchr) || 0;

            return matchName && matchType && matchDist && matchEst &&
                   (sVal >= ranges.s[0] && sVal <= ranges.s[1]) &&
                   (cVal >= ranges.c[0] && cVal <= ranges.c[1]) &&
                   (tVal >= ranges.t[0] && tVal <= ranges.t[1]) &&
                   (scVal >= ranges.sc[0] && scVal <= ranges.sc[1]) &&
                   (stVal >= ranges.st[0] && stVal <= ranges.st[1]);
        });

        this.close();
        if (filtered.length === 0) {
            alert("조건에 맞는 학교가 없습니다.");
        } else {
            if (filtered.length === 1) {
                const target = filtered[0];
                MapManager.map.flyTo(target.getLatLng(), 16, { duration: 1.5 });
                setTimeout(() => target.openPopup(), 1600);
            } else {
                ResultPageManager.open(filtered); 
            }
>>>>>>> parent of 5b107bf (범례 간격/교육청필터및통계제거/길찾기 1차 업데이트)
        }
    },

    // 🎯 특정 학교로 지도 이동 및 팝업 열기 (클러스터링 연동)
    focusSchool(m) {
        MapManager.map.setView(m.getLatLng(), 16);
        if (MapManager.cluster.hasLayer(m)) {
            MapManager.cluster.zoomToShowLayer(m, () => m.openPopup());
        } else {
            m.openPopup();
        }
    },

    // 🗂️ 상세 결과창 (더보기 팝업 대시보드) 렌더링
    showResultsPage(results, val) {
        const container = document.getElementById('search-results-list');
        const page = document.getElementById('search-results-page');
        const headerTitle = document.querySelector('.results-header-title');
        
        if (!container || !page) return;

        // 상단 타이틀 업데이트 (선택 사항 - HTML에 해당 클래스가 있을 경우 작동)
        if (headerTitle) {
            headerTitle.innerHTML = `🔍 '${val}' 검색 결과 (${results.length}건)`;
        }

        container.innerHTML = '';
        
        // 가나다 순 정렬 후 카드 렌더링
        [...results].sort((a, b) => String(a.properties.name || '').localeCompare(String(b.properties.name || ''), 'ko')).forEach(m => {
            const p = m.properties;
            const sType = String(p.type || '');
            const sName = String(p.name || '');
            const sAdrs = String(p.adrs || p.location || '');
            
            let typeClass = '';
            if (sType.includes('유치원') || sName.includes('유치원')) typeClass = 'type-kinder';
            else if (sType.includes('초등학교') || sName.includes('초등학교')) typeClass = 'type-elem';
            else if (sType.includes('중학교') || sName.includes('중학교')) typeClass = 'type-mid';
            else if (sType.includes('고등학교') || sName.includes('고등학교')) typeClass = 'type-high';
            else if (sType.includes('특수') || sName.includes('특수')) typeClass = 'type-spec';
            
            const card = document.createElement('div');
            card.className = 'result-card';
            card.innerHTML = `
                <div class="res-type ${typeClass}">${sType} ${p.establish ? `· ${p.establish}` : ''}</div>
                <div class="res-name" title="${sName}">${sName}</div>
                <div class="res-addr" title="${sAdrs}">${sAdrs}</div>
            `;
            // 카드 클릭 시 대시보드 닫고 해당 위치로 이동
            card.onclick = () => { 
                page.style.display = 'none'; 
                this.focusSchool(m); 
            };
            container.appendChild(card);
        });
        
        page.style.display = 'flex';
    },

    // 드롭다운 숨기기
    close() { 
        const resultBox = document.getElementById('searchResults');
        if (resultBox) resultBox.style.display = 'none'; 
    }
};