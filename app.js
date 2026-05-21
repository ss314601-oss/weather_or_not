if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./app.js').catch(err => console.log(err));
    });
}

const refreshBtn = document.getElementById('refresh-btn');
const locationEl = document.getElementById('location');
const tabButtons = document.querySelectorAll('.tab-btn');

let savedWeatherData = null;
let currentViewType = 'summary'; // 기본 뷰: 종합

// 6대 기상 모델 정보 정의
const models = [
    { id: 'ecmwf_ifs_025', name: '🇪🇺 ECMWF' },
    { id: 'gfs_seamless', name: '🇺🇸 GFS' },
    { id: 'icon_seamless', name: '🇩🇪 ICON' },
    { id: 'ukmo_ukv', name: '🇬🇧 UKMO' },
    { id: 'kma_kim', name: '🇰🇷 KIM' },
    { id: 'jma_msm', name: '🇯🇵 MSM' }
];

// 1. 위치 불러오기 버튼
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

// 2. 탭 전환 이벤트
tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        tabButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        currentViewType = e.target.getAttribute('data-type');
        if (savedWeatherData) renderMatrix(savedWeatherData);
    });
});

// 3. API 호출 (온도 및 강수량 동시 요청)
async function fetchWeather(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    locationEl.innerText = `위치: 위도 ${lat.toFixed(2)}, 경도 ${lon.toFixed(2)}`;

    // hourly 파라미터에 temperature_2m와 precipitation 둘 다 추가
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation&models=ecmwf_ifs_025,gfs_seamless,icon_seamless,ukmo_ukv,kma_kim,jma_msm`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        savedWeatherData = data;
        renderMatrix(data);
    } catch (error) {
        console.error(error);
        alert("기상 모델 데이터를 가져오는데 실패했습니다.");
    }
}

// 4. 온도와 강수량을 조합하여 종합 이모지 판단하는 함수
function getWeatherIcon(temp, rain) {
    if (rain > 0.5) return { icon: '🌧️', text: '비' };
    if (rain > 0.1) return { icon: '🌦️', text: '약한비' };
    if (temp > 0) {
        return { icon: '☀️', text: '맑음' };
    } else {
        return { icon: '❄️', text: '추위' };
    }
}

// 5. 행=모델, 열=시간 매트릭스 렌더링
function renderMatrix(data) {
    const headerRow = document.getElementById('table-header');
    const tableBody = document.getElementById('table-body');
    
    headerRow.innerHTML = '<th class="sticky-col">모델 / 시간</th>';
    tableBody.innerHTML = '';

    const timeArray = data.hourly.time;
    const targetIndices = [];

    // 향후 24시간 범위에서 3시간 단위의 인덱스 수집
    for (let i = 0; i < 24; i += 3) {
        if (!timeArray[i]) break;
        targetIndices.push(i);

        // 헤더 열에 시간 추가 (가로 축)
        const rawTime = timeArray[i];
        const day = rawTime.substring(8, 10);
        const hour = rawTime.substring(11, 13);
        
        const th = document.createElement('th');
        th.innerText = `${day}일 ${hour}시`;
        headerRow.appendChild(th);
    }

    // 각 기상 모델을 '행(Row)'으로 생성
    models.forEach(model => {
        const tr = document.createElement('tr');
        
        // 행의 첫 번째 칸: 모델 이름 고정 열
        const modelTd = document.createElement('td');
        modelTd.className = 'sticky-col';
        modelTd.innerText = model.name;
        tr.appendChild(modelTd);

        // 가로 시간 축을 돌면서 데이터 채우기
        targetIndices.forEach(idx => {
            const td = document.createElement('td');
            
            const temp = data.hourly[`temperature_2m_${model.id}`][idx];
            const rain = data.hourly[`precipitation_${model.id}`][idx];

            if (temp === undefined || temp === null) {
                td.innerText = '-';
                tr.appendChild(td);
                return;
            }

            // 활성화된 탭 종류에 따라 다르게 렌더링
            if (currentViewType === 'summary') {
                const weather = getWeatherIcon(temp, rain);
                td.innerHTML = `
                    <div class="summary-cell">
                        <span class="icon-emoji">${weather.icon}</span>
                        <span class="sub-temp">${temp}°C</span>
                    </div>
                `;
            } else if (currentViewType === 'temp') {
                td.innerHTML = `<span class="text-temp">${temp}</span>°C`;
            } else if (currentViewType === 'rain') {
                td.innerHTML = `<span class="text-rain">${rain ?? 0}</span>mm`;
            }

            tr.appendChild(td);
        });

        tableBody.appendChild(tr);
    });
}
