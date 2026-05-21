// PWA 서비스 워커 등록
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./app.js').catch(err => console.log(err));
    });
}

const refreshBtn = document.getElementById('refresh-btn');
const locationEl = document.getElementById('location');
let savedWeatherData = null; 

// 1. 현재 위치 가져오기 버튼 이벤트
refreshBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
        locationEl.innerText = "📍 현재 GPS 위치 찾는 중...";
        navigator.geolocation.getCurrentPosition(fetchWeather, () => {
            alert("위치 권한을 허용해 주세요.");
            locationEl.innerText = "위치 정보를 불러오지 못했습니다.";
        });
    } else {
        alert("이 브라우저는 위치 정보를 지원하지 않습니다.");
    }
});

// 2. 체크박스 변경 시 테이블만 다시 그리기 (한국, 일본 모델 ID 추가)
const checkboxes = ['model-ecmwf', 'model-gfs', 'model-icon', 'model-ukmo', 'model-kim', 'model-msm'];
checkboxes.forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
        if (savedWeatherData) renderTable(savedWeatherData);
    });
});

// 3. Open-Meteo API에서 6대 모델 예보 데이터 가져오기
async function fetchWeather(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    locationEl.innerText = `위치: 위도 ${lat.toFixed(2)}, 경도 ${lon.toFixed(2)}`;

    // 💡 한국 kma_kim, 일본 jma_msm 모델을 주소에 추가했습니다.
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m&models=ecmwf_ifs_025,gfs_seamless,icon_seamless,ukmo_ukv,kma_kim,jma_msm`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        savedWeatherData = data; 
        renderTable(data);
    } catch (error) {
        console.error(error);
        alert("기상 모델 데이터를 가져오는데 실패했습니다.");
    }
}

// 4. 데이터를 3시간 단위로 쪼개고 선택된 모델만 표로 그리기
function renderTable(data) {
    const headerRow = document.getElementById('table-header');
    const tableBody = document.getElementById('table-body');
    
    headerRow.innerHTML = '<th>시간</th>';
    tableBody.innerHTML = '';

    // 활성화된 모델 배열 매핑 (한국, 일본 추가)
    const activeModels = [];
    if (document.getElementById('model-ecmwf').checked) activeModels.push({ id: 'ecmwf_ifs_025', name: '🇪🇺 ECMWF' });
    if (document.getElementById('model-gfs').checked) activeModels.push({ id: 'gfs_seamless', name: '🇺🇸 GFS' });
    if (document.getElementById('model-icon').checked) activeModels.push({ id: 'icon_seamless', name: '🇩🇪 ICON' });
    if (document.getElementById('model-ukmo').checked) activeModels.push({ id: 'ukmo_ukv', name: '🇬🇧 UKMO' });
    if (document.getElementById('model-kim').checked) activeModels.push({ id: 'kma_kim', name: '🇰🇷 KIM' });
    if (document.getElementById('model-msm').checked) activeModels.push({ id: 'jma_msm', name: '🇯🇵 MSM' });

    if (activeModels.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="empty-msg">선택된 기상 모델이 없습니다.</td></tr>';
        return;
    }

    // 헤더 채우기
    activeModels.forEach(model => {
        const th = document.createElement('th');
        th.innerText = model.name;
        headerRow.appendChild(th);
    });

    const timeArray = data.hourly.time; 

    // 향후 24시간 동안 3시간 간격으로 표시
    for (let i = 0; i < 24; i += 3) {
        if (!timeArray[i]) break;

        const rawTime = timeArray[i];
        const day = rawTime.substring(8, 10);
        const hour = rawTime.substring(11, 13);
        const timeText = `${day}일 ${hour}시`;

        const tr = document.createElement('tr');
        
        const timeTd = document.createElement('td');
        timeTd.innerText = timeText;
        timeTd.style.fontWeight = 'bold';
        tr.appendChild(timeTd);

        // 선택된 각 모델별 데이터 매핑
        activeModels.forEach(model => {
            const td = document.createElement('td');
            const tempValue = data.hourly[`temperature_2m_${model.id}`][i];
            
            if (tempValue !== undefined && tempValue !== null) {
                td.innerHTML = `<span class="temp-text">${tempValue}</span>°C`;
            } else {
                // 특정 모델에 해당 시간대 데이터가 아직 생성되지 않았을 때 예외 처리
                td.innerText = '-'; 
            }
            tr.appendChild(td);
        });

        tableBody.appendChild(tr);
    }
}
