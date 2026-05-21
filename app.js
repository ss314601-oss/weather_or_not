let currentLat = 37.5665, currentLon = 126.9780;
let map = L.map('map').setView([currentLat, currentLon], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
let marker = L.marker([currentLat, currentLon]).addTo(map);

const models = [
    { id: 'ecmwf_ifs', name: 'ECMWF' }, { id: 'gfs_seamless', name: 'GFS' },
    { id: 'icon_seamless', name: 'ICON' }, { id: 'jma_seamless', name: 'JMA' },
    { id: 'kma_seamless', name: 'KMA' }, { id: 'met_seamless', name: 'MET' }
];

function updateLocation(lat, lon, name) {
    currentLat = lat; currentLon = lon;
    marker.setLatLng([lat, lon]);
    map.flyTo([lat, lon], 10);
    document.getElementById('location-text').innerText = `위치: ${name}`;
    fetchForecastData();
}

async function fetchForecastData() {
    const modelParams = models.map(m => m.id).join(',');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${currentLat}&longitude=${currentLon}&hourly=temperature_2m,precipitation&models=${modelParams}&forecast_days=7`;
    const res = await fetch(url);
    const data = await res.json();
    renderForecast(data);
}

function renderForecast(data) {
    const tbody = document.getElementById('forecast-body'), thead = document.getElementById('forecast-header');
    thead.innerHTML = '<tr><th class="sticky-col">날짜</th>' + models.map(m=>`<th>${m.name}</th>`).join('') + '</tr>';
    tbody.innerHTML = '';
    const dailyGroups = {};
    data.hourly.time.forEach((t, i) => {
        const d = t.split('T')[0];
        if(!dailyGroups[d]) dailyGroups[d] = [];
        dailyGroups[d].push(i);
    });
    Object.keys(dailyGroups).forEach(date => {
        const tr = document.createElement('tr');
        tr.className = 'daily-row';
        tr.innerHTML = `<td class="sticky-col">${date.substring(5)}</td>` + models.map(() => `<td>-</td>`).join('');
        tbody.appendChild(tr);
        dailyGroups[date].forEach(idx => {
            const trH = document.createElement('tr');
            trH.className = 'hourly-row group-' + date;
            trH.innerHTML = `<td class="sticky-col">${data.hourly.time[idx].substring(11,13)}시</td>` + models.map(m => `<td>${data.hourly['temperature_2m_'+m.id][idx]}°</td>`).join('');
            tbody.appendChild(trH);
        });
        tr.onclick = () => document.querySelectorAll('.group-'+date).forEach(r => r.classList.toggle('show'));
    });
}

async function fetchHistoricalData() {
    const d = new Date(document.getElementById('history-date').value);
    const s = new Date(d); s.setDate(s.getDate()-7);
    const e = new Date(d); e.setDate(e.getDate()+7);
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${currentLat}&longitude=${currentLon}&start_date=${s.toISOString().split('T')[0]}&end_date=${e.toISOString().split('T')[0]}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();
    const tbody = document.getElementById('history-body'); tbody.innerHTML = '';
    data.daily.time.forEach((date, i) => {
        const tr = document.createElement('tr');
        if(date === document.getElementById('history-date').value) tr.className = 'target-date-row';
        tr.innerHTML = `<td class="sticky-col">${date.substring(5)}</td><td>${data.daily.temperature_2m_max[i]}°</td><td>${data.daily.temperature_2m_min[i]}°</td><td>${data.daily.precipitation_sum[i] > 0 ? '🌧️' : '☀️'} ${data.daily.precipitation_sum[i]}mm</td>`;
        tbody.appendChild(tr);
    });
}

document.getElementById('history-search-btn').onclick = fetchHistoricalData;
document.querySelectorAll('.main-tab-btn').forEach(btn => btn.onclick = (e) => {
    document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    e.target.classList.add('active');
    document.getElementById(e.target.dataset.target).classList.add('active');
});

updateLocation(37.5665, 126.9780, "서울");
