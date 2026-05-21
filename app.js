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

// 지도 클릭 시 위치 변경
map.on('click', function(e) {
    updateLocation(e.latlng.lat, e.latlng.lng, "지도에서 선택한 위치");
});

// 검색 버튼 클릭 시 (Geocoding)
document.getElementById('search-btn').addEventListener('click', async () => {
    const query = document.getElementById('search-input').value;
    if(!query) return;
    
    document.getElementById('location-text').innerText = "검색 중...";
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`);
        const data = await res.json();
        if(data.length > 0) {
            updateLocation(parseFloat(data[0].lat), parseFloat(data[0].lon), data[0].display_name.split(',')[0]);
        } else {
            alert("검색 결과를 찾을 수 없습니다.");
            document.getElementById('location-text').innerText = "검색 실패";
        }
    } catch(err) { alert("검색 오류"); }
});

// 내 위치(GPS) 버튼
document.getElementById('gps-btn').addEventListener('click', () => {
    if(navigator.geolocation) {
        document.getElementById('location-text').innerText = "GPS 찾는 중...";
        navigator.geolocation.getCurrentPosition(pos => {
            updateLocation(pos.coords.latitude, pos.coords.longitude, "내 현재 위치");
        });
    }
});

// 위치 업데이트 통합 함수
function updateLocation(lat, lon, name) {
    currentLat = lat; currentLon = lon;
    marker.setLatLng([lat, lon]);
    map.flyTo([lat, lon], 10);
    document.getElementById('location-text').innerText = `위치: ${name} (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
    
    // 데이터 새로고침
    fetchForecastData();
    fetchHistoricalData();
}

// === 2. 탭 전환 로직 ===
document.querySelectorAll('.main-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.add('active');
    });
});

let currentViewType = 'summary';
document.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentViewType = e.target.dataset.type;
        if(forecastData) renderForecast();
    });
});


// === 3. 기상 모델 예보 데이터 (기존 로직) ===
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
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${currentLat}&longitude=${currentLon}&hourly=temperature_2m,precipitation&models=ecmwf_ifs,gfs_seamless,icon_seamless,jma_seamless,gem_seamless,meteofrance_seamless`;
    try {
        const res = await fetch(url);
        forecastData = await res.json();
        renderForecast();
    } catch(err) { console.error("예보 로딩 실패", err); }
}

function renderForecast() {
    if(!forecastData) return;
    const thead = document.getElementById('forecast-header');
    const tbody = document.getElementById('forecast-body');
    thead.innerHTML = '<th class="sticky-col">모델 / 시간</th>';
    tbody.innerHTML = '';

    const times = forecastData.hourly.time;
    let indices = [];
    for(let i=0; i<24; i+=3) {
        if(!times[i]) break;
        indices.push(i);
        let th = document.createElement('th');
        th.innerText = `${times[i].substring(8,10)}일 ${times[i].substring(11,13)}시`;
        thead.appendChild(th);
    }

    models.forEach(model => {
        let tr = document.createElement('tr');
        tr.innerHTML = `<td class="sticky-col">${model.name}</td>`;
        indices.forEach(idx => {
            let temp = forecastData.hourly[`temperature_2m_${model.id}`] ? forecastData.hourly[`temperature_2m_${model.id}`][idx] : null;
            let rain = forecastData.hourly[`precipitation_${model.id}`] ? forecastData.hourly[`precipitation_${model.id}`][idx] : null;
            
            let td = document.createElement('td');
            if(temp === null) td.innerText = '-';
            else if(currentViewType === 'summary') {
                let icon = rain > 0.5 ? '🌧️' : rain > 0.1 ? '🌦️' : temp > 0 ? '☀️' : '❄️';
                td.innerHTML = `<div class="summary-cell"><span class="icon-emoji">${icon}</span><span class="sub-temp">${temp}°C</span></div>`;
            } else if(currentViewType === 'temp') td.innerHTML = `<span class="text-temp">${temp}</span>°C`;
            else td.innerHTML = `<span class="text-rain">${rain??0}</span>mm`;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

// === 4. 과거 실제 날씨 데이터 (신규 기능) ===
async function fetchHistoricalData() {
    // 오늘 날짜 구하기
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    
    // 1년 전, 2년 전 날짜 세팅
    const date1Yr = `${today.getFullYear() - 1}-${mm}-${dd}`;
    const date2Yr = `${today.getFullYear() - 2}-${mm}-${dd}`;

    // 과거 데이터 API 호출 (Archive API 사용)
    const url1Yr = `https://archive-api.open-meteo.com/v1/archive?latitude=${currentLat}&longitude=${currentLon}&start_date=${date1Yr}&end_date=${date1Yr}&hourly=temperature_2m,precipitation`;
    const url2Yr = `https://archive-api.open-meteo.com/v1/archive?latitude=${currentLat}&longitude=${currentLon}&start_date=${date2Yr}&end_date=${date2Yr}&hourly=temperature_2m,precipitation`;

    try {
        const [res1, res2] = await Promise.all([fetch(url1Yr), fetch(url2Yr)]);
        const data1 = await res1.json();
        const data2 = await res2.json();
        renderHistory(data1, data2, date1Yr, date2Yr);
    } catch(err) { console.error("과거 데이터 로딩 실패", err); }
}

function renderHistory(data1, data2, date1Yr, date2Yr) {
    const thead = document.getElementById('history-header');
    const tbody = document.getElementById('history-body');
    thead.innerHTML = '<th class="sticky-col">연도 / 시간</th>';
    tbody.innerHTML = '';

    // 00시부터 21시까지 3시간 간격 추출
    let indices = [0, 3, 6, 9, 12, 15, 18, 21];
    indices.forEach(idx => {
        let th = document.createElement('th');
        th.innerText = `${idx.toString().padStart(2, '0')}시`;
        thead.appendChild(th);
    });

    // 1년 전 행
    let tr1 = document.createElement('tr');
    tr1.innerHTML = `<td class="sticky-col" style="font-size:0.75rem;">🔙 1년전<br>(${date1Yr})</td>`;
    indices.forEach(idx => {
        let temp = data1.hourly.temperature_2m[idx];
        let rain = data1.hourly.precipitation[idx];
        tr1.innerHTML += `<td><div class="summary-cell"><span class="text-temp">${temp}°C</span><span class="sub-temp">${rain}mm</span></div></td>`;
    });
    tbody.appendChild(tr1);

    // 2년 전 행
    let tr2 = document.createElement('tr');
    tr2.innerHTML = `<td class="sticky-col" style="font-size:0.75rem;">🔙 2년전<br>(${date2Yr})</td>`;
    indices.forEach(idx => {
        let temp = data2.hourly.temperature_2m[idx];
        let rain = data2.hourly.precipitation[idx];
        tr2.innerHTML += `<td><div class="summary-cell"><span class="text-temp">${temp}°C</span><span class="sub-temp">${rain}mm</span></div></td>`;
    });
    tbody.appendChild(tr2);
}

// 최초 실행 시 기본 위치(서울) 데이터 로드
fetchForecastData();
fetchHistoricalData();
