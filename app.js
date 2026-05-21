document.addEventListener('DOMContentLoaded', () => {
    let map = L.map('map').setView([37.5665, 126.9780], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    let marker = L.marker([37.5665, 126.9780], {draggable: true}).addTo(map);
    
    const models = [
        { id: 'ecmwf_ifs', name: 'ECMWF' }, { id: 'gfs_seamless', name: 'GFS' },
        { id: 'icon_seamless', name: 'ICON' }, { id: 'jma_seamless', name: 'JMA' },
        { id: 'kma_seamless', name: 'KMA' }, { id: 'metno_seamless', name: 'MET' }
    ];

    async function update(lat, lon, name = "지도 선택 위치") {
        marker.setLatLng([lat, lon]);
        map.setView([lat, lon], 10);
        document.getElementById('location-text').innerText = `위치: ${name}`;
        await Promise.all([fetchForecast(lat, lon), fetchHistory(lat, lon)]);
    }

    map.on('click', (e) => update(e.latlng.lat, e.latlng.lng));
    marker.on('dragend', () => { const p = marker.getLatLng(); update(p.lat, p.lng); });

    async function fetchForecast(lat, lon) {
        const tbody = document.getElementById('forecast-body');
        const thead = document.getElementById('forecast-header');
        
        // 💡 강수량 파라미터가 모델들과 충돌하는지 테스트하기 위해 URL 간소화
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m&daily=sunrise,sunset&models=${models.map(m=>m.id).join(',')}&forecast_days=7&timezone=auto`;
        
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP 상태코드: ${res.status}`);
            const data = await res.json();
            
            thead.innerHTML = '<tr><th class="sticky-col">날짜</th>' + models.map(m=>`<th>${m.name}</th>`).join('') + '</tr>';
            tbody.innerHTML = '';
            
            const groups = {};
            data.hourly.time.forEach((t, i) => { 
                if (parseInt(t.substring(11,13)) % 3 === 0) {
                    const d = t.split('T')[0]; 
                    if(!groups[d]) groups[d]=[]; groups[d].push(i); 
                }
            });
            
            Object.keys(groups).forEach(date => {
                const tr = document.createElement('tr'); tr.className = 'daily-row';
                tr.innerHTML = `<td class="sticky-col">${date.substring(5)}</td>` + models.map(m => {
                    let v = data.hourly['temperature_2m_'+m.id];
                    return `<td>${(v && v[groups[date][0]]!=null) ? Math.round(v[groups[date][0]])+'°' : '-'}</td>`;
                }).join('');
                tbody.appendChild(tr);
            });
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="7" style="color:red;">에러: ${e.message}</td></tr>`;
        }
    }

    async function fetchHistory(lat, lon) { /* 동일 */ }

    // ... 나머지 이벤트 리스너 동일 (위 이전 코드와 같습니다)
    document.getElementById('search-btn').onclick = async () => {
        const q = document.getElementById('search-input').value;
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}`);
        const d = await res.json();
        if(d.length > 0) update(parseFloat(d[0].lat), parseFloat(d[0].lon), d[0].display_name.split(',')[0]);
    };
    
    document.getElementById('history-search-btn').onclick = () => fetchHistory(marker.getLatLng().lat, marker.getLatLng().lng);
    document.querySelectorAll('.main-tab-btn').forEach(b => b.onclick = (e) => {
        document.querySelectorAll('.main-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.add('active');
    });

    document.getElementById('history-date').value = new Date().toISOString().split('T')[0];
    update(37.5665, 126.9780);
    setTimeout(() => map.invalidateSize(), 500);
});
