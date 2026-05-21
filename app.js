document.addEventListener('DOMContentLoaded', () => {
    let currentLat = 37.5665, currentLon = 126.9780;
    
    // === 1. 지도 초기화 ===
    let map = L.map('map').setView([currentLat, currentLon], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    
    // 💡 핀(마커) 드래그 이동 가능하게 설정
    let marker = L.marker([currentLat, currentLon], {draggable: true}).addTo(map);

    // 모바일 렌더링 찌그러짐 방지
    setTimeout(() => map.invalidateSize(), 500);

    // === 2. 지도 클릭 & 핀 드래그 이벤트 ===
    map.on('click', (e) => {
        updateLocation(e.latlng.lat, e.latlng.lng, "지도에서 지정한 위치");
    });
    
    marker.on('dragend', () => {
        const pos = marker.getLatLng();
        updateLocation(pos.lat, pos.lng, "지도에서 지정한 위치");
    });

    const models = [
        { id: 'ecmwf_ifs', name: 'ECMWF' }, { id: 'gfs_seamless', name: 'GFS' },
        { id: 'icon_seamless', name: 'ICON' }, { id: 'jma_seamless', name: 'JMA' },
        { id: 'kma_seamless', name: 'KMA' }, { id: 'met_seamless', name: 'MET' }
    ];

    // 과거 기록용 날짜 기본값 세팅 (1년 전 오늘)
    const today = new Date();
    today.setFullYear(today.getFullYear() - 1);
    document.getElementById('history-date').value = today.toISOString().split('T')[0];

    function updateLocation(lat, lon, name) {
        currentLat = lat; currentLon = lon;
        marker.setLatLng([lat, lon]);
        map.setView([lat, lon], 10);
        document.getElementById('location-text').innerText = `위치: ${name}`;
        
        fetchForecastData();
        fetchHistoricalData();
    }

    // === 검색 기능 ===
    document.getElementById('search-btn').onclick = async () => {
        const query = document.getElementById('search-input').value;
        if(!query) return;
        document.getElementById('location-text').innerText = "검색 중...";
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`);
            const data = await res.json();
            if(data.length > 0) updateLocation(parseFloat(data[0].lat), parseFloat(data[0].lon), data[0].display_name.split(',')[0]);
            else document.getElementById('location-text').innerText = "검색 결과 없음";
        } catch(e) { document.getElementById('location-text').innerText = "검색 에러"; }
    };

    // 검색 엔터키 지원
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if(e.key === 'Enter') document.getElementById('search-btn').click();
    });

    // 내 위치 (GPS)
    document.getElementById('gps-btn').onclick = () => {
        if(navigator.geolocation) {
            document.getElementById('location-text').innerText = "위치 찾는 중...";
            navigator.geolocation.getCurrentPosition(pos => updateLocation(pos.coords.latitude, pos.coords.longitude, "내 위치"));
        }
    };

    // === 3. 데이터 로딩 및 렌더링 ===
    async function fetchForecastData() {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${currentLat}&longitude=${currentLon}&hourly=temperature_2m&models=${models.map(m=>m.id).join(',')}&forecast_days=7&timezone=auto`;
            const res = await fetch(url);
            const data = await res.json();
            if(data.error) throw new Error(data.reason);
            renderForecast(data);
        } catch(e) { console.error(e); }
    }

    function renderForecast(data) {
        const tbody = document.getElementById('forecast-body'), thead = document.getElementById('forecast-header');
        thead.innerHTML = '<tr><th class="sticky-col">날짜</th>' + models.map(m=>`<th>${m.name}</th>`).join('') + '</tr>';
        tbody.innerHTML = '';
        
        const times = data.hourly.time;
        const dailyGroups = {};
        for(let i=0; i<times.length; i+=3) { // 3시간 간격 추출
            const d = times[i].split('T')[0];
            if(!dailyGroups[d]) dailyGroups[d] = [];
            dailyGroups[d].push(i);
        }

        Object.keys(dailyGroups).forEach(date => {
            const tr = document.createElement('tr');
            tr.className = 'daily-row';
            
            // 💡 접혀있을 때 각 모델별 '일일 최고 기온'을 구해서 보여주는 로직 (빈칸 방지)
            let dailySummaryHtml = `<td class="sticky-col">${date.substring(5,7)}/${date.substring(8,10)} ▼</td>`;
            models.forEach(m => {
                let maxT = -999;
                let hasData = false;
                dailyGroups[date].forEach(idx => {
                    let temp = data.hourly['temperature_2m_'+m.id];
                    if(temp && temp[idx] != null) {
                        hasData = true;
                        if(temp[idx] > maxT) maxT = temp[idx];
                    }
                });
                dailySummaryHtml += `<td>${hasData ? Math.round(maxT)+'°' : '-'}</td>`;
            });
            tr.innerHTML = dailySummaryHtml;
            tbody.appendChild(tr);

            // 펼쳤을 때 나오는 3시간 단위 데이터
            dailyGroups[date].forEach(idx => {
                const trH = document.createElement('tr');
                trH.className = 'hourly-row group-' + date;
                let hourlyHtml = `<td class="sticky-col">└ ${times[idx].substring(11,13)}시</td>`;
                models.forEach(m => {
                    let temp = data.hourly['temperature_2m_'+m.id];
                    hourlyHtml += `<td>${(temp && temp[idx] != null) ? Math.round(temp[idx])+'°' : '-'}</td>`;
                });
                trH.innerHTML = hourlyHtml;
                tbody.appendChild(trH);
            });
            
            // 행 클릭 시 아코디언 토글
            tr.onclick = () => document.querySelectorAll('.group-'+date).forEach(r => r.classList.toggle('show'));
        });
    }

    async function fetchHistoricalData() {
        const dateVal = document.getElementById('history-date').value;
        if(!dateVal) return;
        
        const d = new Date(dateVal);
        const s = new Date(d); s.setDate(s.getDate()-7);
        const e = new Date(d); e.setDate(e.getDate()+7);
        
        try {
            const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${currentLat}&longitude=${currentLon}&start_date=${s.toISOString().split('T')[0]}&end_date=${e.toISOString().split('T')[0]}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
            const res = await fetch(url);
            const data = await res.json();
            
            const tbody = document.getElementById('history-body'); tbody.innerHTML = '';
            data.daily.time.forEach((dateStr, i) => {
                const tr = document.createElement('tr');
                if(dateStr === dateVal) tr.className = 'target-date-row';
                
                const rain = data.daily.precipitation_sum[i];
                const icon = rain > 5 ? '🌧️' : (rain > 0 ? '🌦️' : '☀️');
                
                tr.innerHTML = `<td class="sticky-col">${dateStr.substring(5,7)}/${dateStr.substring(8,10)}</td>
                                <td style="color:#ff4757; font-weight:bold;">${Math.round(data.daily.temperature_2m_max[i])}°</td>
                                <td style="color:#1e90ff; font-weight:bold;">${Math.round(data.daily.temperature_2m_min[i])}°</td>
                                <td>${icon} ${rain}mm</td>`;
                tbody.appendChild(tr);
            });
        } catch(e) { console.error(e); }
    }

    document.getElementById('history-search-btn').onclick = fetchHistoricalData;
    
    // 탭 전환 이벤트
    document.querySelectorAll('.main-tab-btn').forEach(btn => btn.onclick = (e) => {
        document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.add('active');
    });

    // 시작 시 기본 위치 호출
    updateLocation(37.5665, 126.9780, "서울");
});
