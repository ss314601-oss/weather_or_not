// PWA 기능을 작동시키는 서비스 워커 등록 코드
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./app.js') // 임시로 자기 자신을 지정 (작동 에러 방지용)
            .then(() => console.log('PWA 서비스 워커 등록 완료!'))
            .catch(err => console.log('등록 실패:', err));
    });
}

// 날씨 업데이트 버튼 이벤트
document.getElementById('refresh-btn').addEventListener('click', () => {
    // 임시 작동 확인용 알림
    alert('실시간 날씨를 불러오는 중입니다...');
    
    // TODO: 나중에 여기에 진짜 날씨 API를 연동할 예정입니다.
    document.getElementById('temperature').innerText = "26°C";
    document.getElementById('description').innerText = "구름 조금";
});