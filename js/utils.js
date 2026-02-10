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
