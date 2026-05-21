if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./app.js').catch(err => console.log(err));
    });
}

const citySelect = document.getElementById('city-select');
const refreshBtn = document.getElementById('refresh-btn');
const locationEl = document.getElementById('location');
const tabButtons = document.querySelectorAll('.tab-btn');

let savedWeatherData = null;
let currentViewType = 'summary';

const models = [
    { id: 'ecmwf_ifs_025', name: '🇪🇺 ECMWF' },
    { id: 'gfs_seamless', name: '🇺🇸 GFS' },
    { id: 'icon_seamless', name: '🇩🇪 ICON' },
    { id: 'ukmo_ukv', name: '🇬🇧 UKMO' },
    { id: 'kma_kim', name: '🇰🇷 KIM' },
    { id: 'jma_msm', name: '🇯🇵 MSM' }
];

// 1. 드롭다운 선택 시 날씨 가져오기
citySelect.addEventListener('change', (e) => {
    const value = e.target.value;
    if (!value) return; // '선택하기' 기본값을 누르면 무시

    const [lat, lon] = value.split(','); // "위도,경도" 문자열을 쪼갬
    const cityName = e.target.options[e.target.selectedIndex].text;
    
    fetchWeather(parseFloat(lat), parseFloat(lon), cityName);
});

// 2. 현재 위치(GPS) 버튼 클릭 시
refreshBtn.addEventListener('click', () => {
    citySelect.value = ""; // 드롭다운 초기화
    
    if (navigator.geolocation) {
        locationEl.innerText = "📍 현재 GPS 위치 찾는 중...";
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                fetchWeather(position.coords.latitude, position.coords.longitude, "내 현재 위치");
            },
            (error) => {
                // 에러 상세 원인 분석
                let errMsg = "위치 정보를 불러오지 못했습니다.";
                if (error.code === 1) errMsg = "위치 권한이 거부되었습니다. (설정에서 허용해주세요)";
                else if (error.code === 2) errMsg = "현재 GPS 신호를 잡을 수 없습니다.";
                else if (error.code === 3) errMsg = "위치 요청 시간이 초과되었습니다.";
                
                alert(errMsg);
                locationEl.innerText = errMsg;
            },
            { timeout: 10000, enableHighAccuracy: false } // 무한로딩 방지 (10초)
        );
    } else {
        alert("이 브라우저는 위치 정보를 지원하지 않습니다.");
    }
});

// 3. 탭 전환 이벤트
tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        tabButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        currentViewType = e.target.getAttribute('data-type');
        if (savedWeatherData) renderMatrix(savedWeatherData);
    });
});

// 4. API 호출 (공통 함수로 분리)
async function fetchWeather(lat, lon, locationName) {
    locationEl.innerText = `${locationName} (위도 ${lat.toFixed(2)}, 경도 ${lon.toFixed(2)}) 예보 로딩 중...`;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation&models=ecmwf_ifs_025,gfs_seamless,icon_seamless,ukmo_ukv,kma_kim,jma_msm`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        savedWeatherData = data;
        locationEl.innerText = `${locationName} (위도 ${lat.toFixed(2)}, 경도 ${lon.toFixed(2)})`;
        renderMatrix(data);
    } catch (error) {
        console.error(error);
        alert("기상 모델 데이터를 가져오는데 실패했습니다.");
        locationEl.innerText = "데이터 로딩 실패";
    }
}

// 5. 날씨 아이콘 계산
function getWeatherIcon(temp, rain) {
    if (rain > 0.5) return { icon: '🌧️', text: '비' };
    if (rain > 0.1) return { icon: '🌦️', text: '약한비' };
    if (temp > 0) return { icon: '☀️', text: '맑음' };
    return { icon: '❄️', text: '추위' };
}

// 6. 행렬 테이블 렌더링
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

        const rawTime = timeArray[i];
        const day = rawTime.substring(8, 10);
        const hour = rawTime.substring(11, 13);
        
        const th = document.createElement('th');
        th.innerText = `${day}일 ${hour}시`;
        headerRow.appendChild(th);
    }

    models.forEach(model => {
        const tr = document.createElement('tr');
        
        const modelTd = document.createElement('td');
        modelTd.className = 'sticky-col';
        modelTd.innerText = model.name;
        tr.appendChild(modelTd);

        targetIndices.forEach(idx => {
            const td = document.createElement('td');
            
            const temp = data.hourly[`temperature_2m_${model.id}`][idx];
            const rain = data.hourly[`precipitation_${model.id}`][idx];

            if (temp === undefined || temp === null) {
                td.innerText = '-';
                tr.appendChild(td);
                return;
            }

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
