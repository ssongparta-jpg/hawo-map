// js/utils.js
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
        
        const helpBtn = document.getElementById('helpBtn');
        if(helpBtn) helpBtn.addEventListener('click', () => this.showModal());
    },
    
    showModal() {
        if (!this.data) return;
        const modal = document.getElementById('helpModal');
        const contentBox = document.getElementById('helpContentInject');
        
        // [리팩토링] 하드코딩된 스타일을 모두 제거하고 클래스로 교체
        contentBox.innerHTML = `
            <div class="popup-category">${this.data.subtitle}</div>
            <div class="help-title">${this.data.title}</div>
            <div class="help-desc">${this.data.content.replace(/\n/g, '<br>')}</div>
            <hr class="popup-hr">
            <ul class="popup-info-list">
                <li><span class="label">최근 업데이트</span> <span class="value">${this.data.updateDate}</span></li>
                <li><span class="label">문의</span> <span class="value">${this.data.contact}</span></li>
            </ul>
        `;
        modal.style.display = 'flex';
    }
};