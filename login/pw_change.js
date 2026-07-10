const PwChangeApp = {
    init() {
        document.getElementById('btn-change-pw')?.addEventListener('click', () => this.submit());
        document.getElementById('new-pw')?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') document.getElementById('new-pw-confirm')?.focus();
        });
        document.getElementById('new-pw-confirm')?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') this.submit();
        });
    },

    async submit() {
        const newPw = document.getElementById('new-pw').value.trim();
        const confirmPw = document.getElementById('new-pw-confirm').value.trim();

        if (!newPw) return Swal.fire({ icon: 'warning', text: '새 비밀번호를 입력해주세요.', confirmButtonColor: '#3498db' });
        if (newPw !== confirmPw) return Swal.fire({ icon: 'error', text: '비밀번호가 서로 일치하지 않습니다.', confirmButtonColor: '#e74c3c' });
        if (newPw.length < 4) return Swal.fire({ icon: 'warning', text: '비밀번호는 보안을 위해 최소 4자 이상이어야 합니다.', confirmButtonColor: '#3498db' });

        Swal.fire({ title: '처리 중...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

        try {
            const res = await fetch('/api/change-pw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPw })
            });
            const data = await res.json();

            if (data.success) {
                Swal.fire({ icon: 'success', title: '변경 완료!', text: '비밀번호가 안전하게 변경되었습니다.', confirmButtonColor: '#2ecc71' })
                    .then(() => { location.href = '/'; });
            } else {
                Swal.fire({ icon: 'error', title: '변경 실패', text: data.message || '시간이 초과되어 로그인이 풀렸습니다. 다시 로그인해주세요.', confirmButtonColor: '#e74c3c' });
            }
        } catch (e) {
            Swal.fire({ icon: 'error', title: '서버 오류', text: '서버 통신에 실패했습니다.', confirmButtonColor: '#e74c3c' });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => PwChangeApp.init());
