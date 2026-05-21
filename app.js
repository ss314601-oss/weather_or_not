document.addEventListener('DOMContentLoaded', () => {
    let map = L.map('map').setView([37.5665, 126.9780], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    let marker = L.marker([37.5665, 126.9780], {draggable: true}).addTo(map);
    
    // 💡 노르웨이 모델 키값 수정 (metno_seamless)
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
        const tbody = document.getElementById('forecast-body'), thead = document.getElementById('forecast-header');
        tbody.innerHTML = '<tr><td colspan="7">데이터 로딩 중...</td></tr>';
        
        try {
            // 💡 강수량(precipitation) 추가 및 오류 처리
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation&models=${models.map(m=>m.id).join(',')}&forecast_days=7&timezone=auto`);
            const data = await res.json();
            
            if (data.error) {
                tbody.innerHTML = `<tr><td colspan="7">API 에러: ${data.reason}</td></tr>`;
                return;
            }

            thead.innerHTML = '<tr><th class="sticky-col">날짜</th>' + models.map(m=>`<th>${m.name}</th>`).join('') + '</tr>';
            tbody.innerHTML = '';
            
            const groups = {};
            data.hourly.time.forEach((t, i) => { const d = t.split('T')[0]; if(!groups[d]) groups[d]=[]; groups[d].push(i); });
            
            Object.keys(groups).forEach(date => {
                const tr = document.createElement('tr'); tr.className = 'daily-row';
                tr.innerHTML = `<td class="sticky-col">${date.substring(5)} ▼</td>` + models.map(m => {
                    let tempsArr = data.hourly['temperature_2m_'+m.id];
                    if(!tempsArr) return '<td>-</td>';
                    let maxT = Math.max(...groups[date].map(i => tempsArr[i]).filter(v => v!=null));
                    return `<td>${maxT !== -Infinity ? Math.round(maxT)+'°' : '-'}</td>`;
                }).join('');
                tbody.appendChild(tr);
                
                groups[date].forEach(idx => {
                    const trH = document.createElement('tr'); trH.className = 'hourly-row group-' + date;
                    let html = `<td class="sticky-col">${data.hourly.time[idx].substring(11,13)}시</td>`;
                    
                    models.forEach(m => {
                        let tempArr = data.hourly['temperature_2m_'+m.id];
                        let rainArr = data.hourly['precipitation_'+m.id];
                        let temp = tempArr ? tempArr[idx] : null;
                        let rain = rainArr ? rainArr[idx] : null;
                        
                        let cellText = temp != null ? Math.round(temp)+'°' : '-';
                        if(rain > 0) cellText += `<br><span style="color:#1e90ff; font-size:0.7rem;">${rain}mm</span>`;
                        html += `<td>${cellText}</td>`;
                    });
                    
                    trH.innerHTML = html;
                    tbody.appendChild(trH);
                });
                tr.onclick = () => document.querySelectorAll('.group-'+date).forEach(r => r.classList.toggle('show'));
            });
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="7">예보 데이터를 가져올 수 없습니다.</td></tr>';
        }
    }

    async function fetchHistory(lat, lon) {
        const d = document.getElementById('history-date').value || new Date().toISOString().split('T')[0];
        const start = new Date(d); start.setDate(start.getDate()-7);
        const end = new Date(d); end.setDate(end.getDate()+7);
        
        try {
            const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${start.toISOString().split('T')[0]}&end_date=${end.toISOString().split('T')[0]}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`);
            const data = await res.json();
            const tbody = document.getElementById('history-body'); tbody.innerHTML = '';
            
            data.daily.time.forEach((date, i) => {
                const tr = document.createElement('tr'); if(date === d) tr.className = 'target-date-row';
                let rain = data.daily.precipitation_sum[i];
                tr.innerHTML = `<td class="sticky-col">${date.substring(5)}</td>
                                <td style="color:#d32f2f;">${Math.round(data.daily.temperature_2m_max[i])}°</td>
                                <td style="color:#1976d2;">${Math.round(data.daily.temperature_2m_min[i])}°</td>
                                <td>${rain > 5 ? '🌧️' : (rain > 0 ? '🌦️' : '☀️')} ${rain > 0 ? rain+'mm' : ''}</td>`;
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error(e);
        }
    }

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
