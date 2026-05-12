// js/notice.js

document.addEventListener('DOMContentLoaded', () => {
    const popup = document.getElementById('shared-school-popup');
    if (!popup) return;
  
    const btnClose = document.getElementById('btn-close-popup');
    const chk7Days = document.getElementById('chk-hide-7days');
    const chkForever = document.getElementById('chk-hide-forever');
  
    // 1. 캐시(localStorage) 확인
    const hideForever = localStorage.getItem('hideSharedPopupForever');
    const hideExpiry = localStorage.getItem('hideSharedPopupExpiry');
    const now = new Date().getTime();
  
    // '계속 보지 않기' 설정이 되어 있거나, '7일간 보지 않기' 기한이 안 지났으면 팝업을 띄우지 않음
    if (hideForever === 'true' || (hideExpiry && now < parseInt(hideExpiry))) {
      return; 
    }
  
    // 2. 팝업 부드럽게 표시 (애니메이션 트리거)
    setTimeout(() => {
      popup.classList.add('active');
    }, 300); // 페이지 로드 후 0.3초 뒤에 자연스럽게 등장
  
    // 3. 체크박스 상호 배타적 선택 (둘 중 하나만 선택되도록)
    chk7Days.addEventListener('change', () => {
      if (chk7Days.checked) chkForever.checked = false;
    });
    chkForever.addEventListener('change', () => {
      if (chkForever.checked) chk7Days.checked = false;
    });
  
    // 4. 닫기 버튼 클릭 로직
    btnClose.addEventListener('click', () => {
      if (chkForever.checked) {
        // 계속 보지 않기
        localStorage.setItem('hideSharedPopupForever', 'true');
      } else if (chk7Days.checked) {
        // 7일간 보지 않기 (현재 시간 + 7일의 밀리초)
        const expiryDate = now + (7 * 24 * 60 * 60 * 1000);
        localStorage.setItem('hideSharedPopupExpiry', expiryDate.toString());
      }
  
      // 팝업 부드럽게 닫기
      popup.classList.remove('active');
      setTimeout(() => {
        popup.style.display = 'none';
      }, 300); // CSS transition 시간 대기 후 완전 숨김
    });
  });