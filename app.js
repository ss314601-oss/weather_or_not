document.addEventListener('DOMContentLoaded', () => {
    let currentLat = 37.5665, currentLon = 126.9780;
    
    // === 1. 지도 초기화 ===
    let map = L.map('map').setView([currentLat, currentLon], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    let marker = L.marker([currentLat, currentLon], {draggable: true}).addTo(map);
    setTimeout(() => map.invalidateSize(), 500);

    // === 2. 위치 업데이트 시 데이터 새로고침 ===
    async function updateLocation(lat, lon, name) {
        currentLat = lat; currentLon = lon;
        marker.setLatLng([lat, lon]);
        map.setView([lat, lon], 10);
        document.getElementById('location-text').innerText = `위치: ${name}`;
        
        // 두 데이터를 순차적으로 로드
        await fetchForecastData();
        await fetchHistoricalData();
    }

    // 지도 클릭/드래그 이벤트
    map.on('click', (e) => updateLocation(e.latlng.lat, e.latlng.lng, "지도 선택 위치"));
    marker.on('dragend', () => {
        const pos = marker.getLatLng();
        updateLocation(pos.lat, pos.lng, "지도 선택 위치");
    });

    // === 3. 주간 예보 데이터 로딩 (안정화) ===
    const models = [
        { id: 'ecmwf_ifs', name: 'ECMWF' }, { id: 'gfs_seamless', name: 'GFS' },
        { id: 'icon_seamless', name: 'ICON' }, { id: 'jma_seamless', name: 'JMA' },
        { id: 'kma_seamless', name: 'KMA' }, { id: 'met_seamless', name: 'MET' }
    ];

    async function fetchForecastData() {
        const tbody = document.getElementById('forecast-body');
        tbody.innerHTML = '<tr><td colspan="7">데이터 불러오는 중...</td></tr>'; // 로딩 표시
        
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${currentLat}&longitude=${currentLon}&hourly=temperature_2m&models=${models.map(m=>m.id).join(',')}&forecast_days=7&timezone=auto`;
            const res = await fetch(url);
            const data = await res.json();
            
            if(data.hourly) {
                renderForecast(data);
            } else {
                tbody.innerHTML = '<tr><td colspan="7">데이터 없음</td></tr>';
            }
        } catch(e) {
            tbody.innerHTML = '<tr><td colspan="7">에러 발생</td></tr>';
        }
    }

    function renderForecast(data) {
        const tbody = document.getElementById('forecast-body'), thead = document.getElementById('forecast-header');
        thead.innerHTML = '<tr><th class="sticky-col">날짜</th>' + models.map(m=>`<th>${m.name}</th>`).join('') + '</tr>';
        tbody.innerHTML = '';
        
        const times = data.hourly.time;
        const dailyGroups = {};
        times.forEach((t, i) => {
            const d = t.split('T')[0];
            if(!dailyGroups[d]) dailyGroups[d] = [];
            dailyGroups[d].push(i);
        });

        Object.keys(dailyGroups).forEach(date => {
            const tr = document.createElement('tr');
            tr.className = 'daily-row';
            let summaryHtml = `<td class="sticky-col">${date.substring(5)} ▼</td>`;
            models.forEach(m => {
                let temps = dailyGroups[date].map(idx => data.hourly['temperature_2m_'+m.id][idx]).filter(v => v != null);
                let maxT = temps.length > 0 ? Math.round(Math.max(...temps)) : '-';
                summaryHtml += `<td>${maxT}${maxT !== '-' ? '°' : ''}</td>`;
            });
            tr.innerHTML = summaryHtml;
            tbody.appendChild(tr);

            dailyGroups[date].forEach(idx => {
                const trH = document.createElement('tr');
                trH.className = 'hourly-row group-' + date;
                let hourlyHtml = `<td class="sticky-col">└ ${times[idx].substring(11,13)}시</td>`;
                models.forEach(m => {
                    let val = data.hourly['temperature_2m_'+m.id][idx];
                    hourlyHtml += `<td>${val != null ? Math.round(val)+'°' : '-'}</td>`;
                });
                trH.innerHTML = hourlyHtml;
                tbody.appendChild(trH);
            });
            tr.onclick = () => document.querySelectorAll('.group-'+date).forEach(r => r.classList.toggle('show'));
        });
    }

    // === 4. 과거 날씨 로딩 (안정화) ===
    async function fetchHistoricalData() {
        const tbody = document.getElementById('history-body');
        const dateVal = document.getElementById('history-date').value;
        if(!dateVal) return;
        
        tbody.innerHTML = '<tr><td colspan="4">조회 중...</td></tr>';
        const d = new Date(dateVal);
        const s = new Date(d); s.setDate(s.getDate()-7);
        const e = new Date(d); e.setDate(d.getDate()+7);
        
        try {
            const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${currentLat}&longitude=${currentLon}&start_date=${s.toISOString().split('T')[0]}&end_date=${e.toISOString().split('T')[0]}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
            const res = await fetch(url);
            const data = await res.json();
            tbody.innerHTML = '';
            data.daily.time.forEach((date, i) => {
                const tr = document.createElement('tr');
                if(date === dateVal) tr.className = 'target-date-row';
                tr.innerHTML = `<td class="sticky-col">${date.substring(5)}</td>
                                <td>${Math.round(data.daily.temperature_2m_max[i])}°</td>
                                <td>${Math.round(data.daily.temperature_2m_min[i])}°</td>
                                <td>${data.daily.precipitation_sum[i] > 0 ? '🌧️' : '☀️'} ${data.daily.precipitation_sum[i]}mm</td>`;
                tbody.appendChild(tr);
            });
        } catch(e) { tbody.innerHTML = '<tr><td colspan="4">불러오기 실패</td></tr>'; }
    }

    document.getElementById('history-search-btn').onclick = fetchHistoricalData;
    // ... (이하 탭 전환 및 초기화 로직 동일)
    document.querySelectorAll('.main-tab-btn').forEach(btn => btn.onclick = (e) => {
        document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.add('active');
    });

    // 1년 전 오늘 날짜 자동 입력
    const d = new Date(); d.setFullYear(d.getFullYear() - 1);
    document.getElementById('history-date').value = d.toISOString().split('T')[0];

    updateLocation(37.5665, 126.9780, "서울");
});
