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

// 🌍 순수 오리지널 6대 글로벌 모델 (가짜 보정 없음)
const models = [
    { id: 'ecmwf_ifs', name: '🇪🇺 ECMWF' },
    { id: 'gfs_seamless', name: '🇺🇸 GFS' },
    { id: 'icon_seamless', name: '🇩🇪 ICON' },
    { id: 'jma_seamless', name: '🇯🇵 JMA' },
    { id: 'gem_seamless', name: '🇨🇦 GEM' },
    { id: 'meteofrance_seamless', name: '🇫🇷 Meteo' }
];

// 1. 드롭다운 선택 이벤트
citySelect.addEventListener('change', (e) => {
    const value = e.target.value;
    if (!value) return; 

    const [lat, lon] = value.split(','); 
    const cityName = e.target.options[e.target.selectedIndex].text;
    
    fetchWeather(parseFloat(lat), parseFloat(lon), cityName);
});

// 2. 현재 위치(GPS) 버튼 이벤트
refreshBtn.addEventListener('click', () => {
    citySelect.value = ""; 
    
    if (navigator.geolocation) {
        locationEl.innerText = "📍 현재 GPS 위치 찾는 중...";
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                fetchWeather(position.coords.latitude, position.coords.longitude, "내 현재 위치");
            },
            (error) => {
                let errMsg = "위치 정보를 불러오지 못했습니다.";
                if (error.code === 1) errMsg = "위치 권한이 거부되었습니다.";
                else if (error.code === 2) errMsg = "현재 GPS 신호를 잡을 수 없습니다.";
                
                alert(errMsg);
                locationEl.innerText = errMsg;
            },
            { timeout: 10000, enableHighAccuracy: false }
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

// 4. API 호출
async function fetchWeather(lat, lon, locationName) {
    locationEl.innerText = `${locationName} 예보 로딩 중...`;

    // 💡 과거 탐색 없이, 현재부터 미래 24시간 분량만 깔끔하게 요청합니다.
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation&models=ecmwf_ifs,gfs_seamless,icon_seamless,jma_seamless,gem_seamless,meteofrance_seamless`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            alert(`API 에러: ${data.reason}`);
            return;
        }

        savedWeatherData = data;
        locationEl.innerText = `${locationName} (위도 ${lat.toFixed(2)}, 경도 ${lon.toFixed(2)})`;
        renderMatrix(data);
    } catch (error) {
        console.error(error);
        alert("기상 데이터를 통신하는 중 문제가 발생했습니다.");
        locationEl.innerText = "데이터 로딩 실패";
    }
}

// 5. 날씨 이모지 계산기
function getWeatherIcon(temp, rain) {
    if (rain > 0.5) return { icon: '🌧️', text: '비' };
    if (rain > 0.1) return { icon: '🌦️', text: '약한비' };
    if (temp > 0) return { icon: '☀️', text: '맑음' };
    return { icon: '❄️', text: '추위' };
}

// 6. 행렬 테이블 렌더링 (순수 데이터 표출)
function renderMatrix(data) {
    const headerRow = document.getElementById('table-header');
    const tableBody = document.getElementById('table-body');
    
    headerRow.innerHTML = '<th class="sticky-col">모델 / 시간</th>';
    tableBody.innerHTML = '';

    const timeArray = data.hourly.time;
    const targetIndices = [];

    // 현재 시간(0번 인덱스)부터 24시간 범위(8개) 추출
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
            
            const temp = data.hourly[`temperature_2m_${model.id}`] ? data.hourly[`temperature_2m_${model.id}`][idx] : null;
            const rain = data.hourly[`precipitation_${model.id}`] ? data.hourly[`precipitation_${model.id}`][idx] : null;

            // 데이터가 아예 서버에서 오지 않았거나 null이면 과감히 '-' 표출
            if (temp === null || temp === undefined) {
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
