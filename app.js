if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./app.js').catch(err => console.log(err));
    });
}

// === 1. 무료 지도(Leaflet) 설정 ===
let currentLat = 37.5665;
let currentLon = 126.9780;
let map = L.map('map').setView([currentLat, currentLon], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);
let marker = L.marker([currentLat, currentLon]).addTo(map);

map.on('click', function(e) { updateLocation(e.latlng.lat, e.latlng.lng, "지도에서 선택한 위치"); });

document.getElementById('search-btn').addEventListener('click', async () => {
    const query = document.getElementById('search-input').value;
    if(!query) return;
    document.getElementById('location-text').innerText = "검색 중...";
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`);
        const data = await res.json();
        if(data.length > 0) updateLocation(parseFloat(data[0].lat), parseFloat(data[0].lon), data[0].display_name.split(',')[0]);
        else { alert("검색 결과를 찾을 수 없습니다."); document.getElementById('location-text').innerText = "검색 실패"; }
    } catch(err) { alert("검색 오류"); }
});

document.getElementById('gps-btn').addEventListener('click', () => {
    if(navigator.geolocation) {
        document.getElementById('location-text').innerText = "GPS 찾는 중...";
        navigator.geolocation.getCurrentPosition(pos => { updateLocation(pos.coords.latitude, pos.coords.longitude, "내 현재 위치"); });
    }
});

function updateLocation(lat, lon, name) {
    currentLat = lat; currentLon = lon;
    marker.setLatLng([lat, lon]);
    map.flyTo([lat, lon], 10);
    document.getElementById('location-text').innerText = `위치: ${name} (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
    fetchForecastData();
    fetchHistoricalData();
}

// === 2. 메인 탭 전환 로직 ===
document.querySelectorAll('.main-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.add('active');
    });
});

// === 3. 주간 예보 데이터 (아코디언 형태) ===
let forecastData = null;
const models = [
    { id: 'ecmwf_ifs', name: '🇪🇺 ECMWF' },
    { id: 'gfs_seamless', name: '🇺🇸 GFS' },
    { id: 'icon_seamless', name: '🇩🇪 ICON' },
    { id: 'jma_seamless', name: '🇯🇵 JMA' },
    { id: 'gem_seamless', name: '🇨🇦 GEM' },
    { id: 'meteofrance_seamless', name: '🇫🇷 Meteo' }
];

async function fetchForecastData() {
    // forecast_days=7 추가하여 일주일치 데이터 요청
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${currentLat}&longitude=${currentLon}&hourly=temperature_2m,precipitation&models=ecmwf_ifs,gfs_seamless,icon_seamless,jma_seamless,gem_seamless,meteofrance_seamless&timezone=auto&forecast_days=7`;
    try {
        const res = await fetch(url);
        forecastData = await res.json();
        renderForecast();
    } catch(err) { console.error("예보 로딩 실패", err); }
}

function getWeatherIcon(temp, rain) {
    if (rain > 0.5) return '🌧️';
    if (rain > 0.1) return '🌦️';
    if (temp > 0) return '☀️';
    return '❄️';
}

function renderForecast() {
    if(!forecastData || forecastData.error) return;
    
    const thead = document.getElementById('forecast-header');
    const tbody = document.getElementById('forecast-body');
    
    // 테이블 헤더 (세로: 날짜/시간, 가로: 모델)
    thead.innerHTML = '<tr><th class="sticky-col">날짜 / 시간</th>' + 
                      models.map(m => `<th>${m.name}</th>`).join('') + '</tr>';
    tbody.innerHTML = '';

    const times = forecastData.hourly.time;
    
    // 데이터를 '일별'로 그룹화
    const dailyGroups = {};
    for (let i = 0; i < times.length; i += 3) { // 3시간 간격만 추출
        if(!times[i]) break;
        const dateStr = times[i].split('T')[0];
        if(!dailyGroups[dateStr]) dailyGroups[dateStr] = [];
        dailyGroups[dateStr].push(i);
    }

    // 일별 렌더링
    Object.keys(dailyGroups).forEach(date => {
        const indices = dailyGroups[date];
        const dayLabel = date.substring(5, 7) + '/' + date.substring(8, 10); // MM/DD
        const rowGroupId = 'group-' + date;

        // 1. 일별 요약 행 (클릭 시 아코디언)
        const trDaily = document.createElement('tr');
        trDaily.className = 'daily-row';
        trDaily.innerHTML = `<td class="sticky-col">${dayLabel} <span class="toggle-icon">▼</span></td>`;
        
        models.forEach(model => {
            // 해당 일자의 최고 기온과 총 강수량 계산
            let maxTemp = -999;
            let totalRain = 0;
            let hasData = false;

            indices.forEach(idx => {
                const temp = forecastData.hourly[`temperature_2m_${model.id}`] ? forecastData.hourly[`temperature_2m_${model.id}`][idx] : null;
                const rain = forecastData.hourly[`precipitation_${model.id}`] ? forecastData.hourly[`precipitation_${model.id}`][idx] : null;
                if(temp !== null) {
                    hasData = true;
                    if(temp > maxTemp) maxTemp = temp;
                    totalRain += (rain || 0);
                }
            });

            if(!hasData) {
                trDaily.innerHTML += `<td>-</td>`;
            } else {
                const icon = getWeatherIcon(maxTemp, totalRain);
                trDaily.innerHTML += `
                    <td>
                        <div class="cell-data">
                            <span>${icon} <span class="temp-text">${Math.round(maxTemp)}°C</span></span>
                            ${totalRain > 0 ? `<span class="rain-text">${totalRain.toFixed(1)}mm</span>` : ''}
                        </div>
                    </td>`;
            }
        });
        tbody.appendChild(trDaily);

        // 2. 3시간 단위 상세 행 (기본 숨김)
        const hourlyRows = [];
        indices.forEach(idx => {
            const timeLabel = times[idx].substring(11, 13) + '시';
            const trHourly = document.createElement('tr');
            trHourly.className = `hourly-row ${rowGroupId}`;
            
            trHourly.innerHTML = `<td class="sticky-col">└ ${timeLabel}</td>`;
            
            models.forEach(model => {
                const temp = forecastData.hourly[`temperature_2m_${model.id}`] ? forecastData.hourly[`temperature_2m_${model.id}`][idx] : null;
                const rain = forecastData.hourly[`precipitation_${model.id}`] ? forecastData.hourly[`precipitation_${model.id}`][idx] : null;
                
                if(temp === null) {
                    trHourly.innerHTML += `<td>-</td>`;
                } else {
                    trHourly.innerHTML += `
                        <td>
                            <span class="temp-text">${Math.round(temp)}°</span>
                            ${rain > 0 ? `<br><span class="rain-text">${rain.toFixed(1)}mm</span>` : ''}
                        </td>`;
                }
            });
            tbody.appendChild(trHourly);
            hourlyRows.push(trHourly);
        });

        // 클릭 이벤트: 숨겨진 행들 토글
        trDaily.addEventListener('click', () => {
            const icon = trDaily.querySelector('.toggle-icon');
            const isShowing = hourlyRows[0].classList.contains('show');
            
            hourlyRows.forEach(row => {
                if(isShowing) row.classList.remove('show');
                else row.classList.add('show');
            });
            
            icon.innerText = isShowing ? '▼' : '▲';
        });
    });
}

// === 4. 과거 실제 날씨 데이터 (선택일 기준 전후 한달) ===
// 날짜 입력창 기본값을 정확히 1년 전 오늘로 세팅
const todayDate = new Date();
todayDate.setFullYear(todayDate.getFullYear() - 1);
document.getElementById('history-date').value = todayDate.toISOString().split('T')[0];

document.getElementById('history-search-btn').addEventListener('click', fetchHistoricalData);

async function fetchHistoricalData() {
    const targetDateStr = document.getElementById('history-date').value;
    if(!targetDateStr) return;

    const targetDate = new Date(targetDateStr);
    
    // 시작일(15일 전), 종료일(15일 후) 세팅
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 15);
    
    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + 15);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // 과거 데이터 API 호출 (일별 데이터: 최고, 최저, 강수량)
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${currentLat}&longitude=${currentLon}&start_date=${startStr}&end_date=${endStr}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        renderHistory(data, targetDateStr);
    } catch(err) { console.error("과거 데이터 로딩 실패", err); }
}

function renderHistory(data, targetDateStr) {
    if(!data || data.error) return;
    
    const tbody = document.getElementById('history-body');
    tbody.innerHTML = '';

    const times = data.daily.time;
    for (let i = 0; i < times.length; i++) {
        const dateStr = times[i];
        const maxT = data.daily.temperature_2m_max[i];
        const minT = data.daily.temperature_2m_min[i];
        const rain = data.daily.precipitation_sum[i];

        const tr = document.createElement('tr');
        // 사용자가 선택한 타겟 날짜에 하이라이트 클래스 추가
        if(dateStr === targetDateStr) tr.className = 'target-date-row';

        const dayLabel = dateStr.substring(5, 7) + '/' + dateStr.substring(8, 10);
        
        tr.innerHTML = `
            <td class="sticky-col">${dayLabel}</td>
            <td><span class="temp-text" style="color:#ff4757;">${maxT}°C</span></td>
            <td><span class="temp-text" style="color:#1e90ff;">${minT}°C</span></td>
            <td>${rain > 0 ? `<span class="rain-text">${rain}mm</span>` : '-'}</td>
        `;
        tbody.appendChild(tr);
    }
}

// 최초 실행 시 기본 위치 데이터 로드
fetchForecastData();
fetchHistoricalData();
