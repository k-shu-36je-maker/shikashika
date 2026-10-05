import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const ADMIN_PASSWORD = "球磨工";
let isLoggedIn = true;

const firebaseConfig = {
    apiKey: "AIzaSyDu4TDPxTGRVqKchMEW61a1itzsmCDz3Fc",
    authDomain: "hitoyoshi-map-no1.firebaseapp.com",
    databaseURL: "https://hitoyoshi-map-no1-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "hitoyoshi-map-no1",
    storageBucket: "hitoyoshi-map-no1.firebasestorage.app",
    messagingSenderId: "706781264395",
    appId: "1:706781264395:web:ddb598c62c6a85f880a50e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const dbRef = ref(db, 'damages');

const markers = {};
let animalChart = null;
let trapTypeChart = null;
let currentData = {};

const loginBtn = document.getElementById('loginToggleBtn');
const authLabel = document.getElementById('authLabel');
const inputForm = document.getElementById('inputForm');

const map = L.map('map', {
    center: [32.211, 130.752],
    zoom: 12,
    minZoom: 8,
    layers: [L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    })]
});

function resizeMap() {
    setTimeout(() => { 
        map.invalidateSize(); 
    }, 300);
}
window.addEventListener('resize', resizeMap);
window.addEventListener('load', resizeMap);
document.addEventListener('DOMContentLoaded', resizeMap);

function updateAuthUI() {
    if (isLoggedIn) {
        authLabel.innerText = '🔓 入力・編集モード';
        authLabel.style.color = '#2ecc71';
        loginBtn.innerText = 'ログアウト';
        inputForm.style.display = 'flex';
    } else {
        authLabel.innerText = '🔒 閲覧モード';
        authLabel.style.color = '#bdc3c7';
        loginBtn.innerText = '関係者ログイン';
        inputForm.style.display = 'none';
        resetForm();
    }
    renderList();
    resizeMap();
}

loginBtn.addEventListener('click', () => {
    if (!isLoggedIn) {
        const inputPwd = prompt('関係者用の合言葉（暗証番号）を入力してください:');
        if (inputPwd === ADMIN_PASSWORD) {
            isLoggedIn = true;
            updateAuthUI();
        } else if (inputPwd !== null) {
            alert('合言葉が違います。');
        }
    } else {
        isLoggedIn = false;
        updateAuthUI();
    }
});

document.getElementById('formDate').value = new Date().toISOString().split('T')[0];
const formTypeSelect = document.getElementById('formType');
formTypeSelect.addEventListener('change', toggleTrapTypeSelect);

function toggleTrapTypeSelect() {
    const type = formTypeSelect.value;
    const trapTypeSelect = document.getElementById('formTrapType');
    if (type === 'trap') {
        trapTypeSelect.disabled = false;
        trapTypeSelect.required = true;
        trapTypeSelect.value = 'box'; 
    } else {
        trapTypeSelect.disabled = true;
        trapTypeSelect.required = false;
        trapTypeSelect.value = '';
    }
}

const clickPopup = L.popup();
map.on('click', function(e) {
    if (!isLoggedIn) return;
    const lat = e.latlng.lat.toFixed(6);
    const lng = e.latlng.lng.toFixed(6);
    const div = document.createElement('div');
    div.style.textAlign = "center";
    div.innerHTML = `<strong>選択座標: ${lat}, ${lng}</strong><br><button id="popupCopyBtn" style="margin-top:6px; padding:3px 8px; font-size:11px; cursor:pointer;">フォームに適用</button>`;
    
    div.querySelector('#popupCopyBtn').addEventListener('click', () => {
        document.getElementById('formLocation').value = `${lat}, ${lng}`;
        map.closePopup(clickPopup);
    });
    clickPopup.setLatLng(e.latlng).setContent(div).openOn(map);
});

function initCharts() {
    const ctxAnimal = document.getElementById('animalChart').getContext('2d');
    const ctxTrap = document.getElementById('trapTypeChart').getContext('2d');

    if (animalChart) animalChart.destroy();
    if (trapTypeChart) trapTypeChart.destroy();

    animalChart = new Chart(ctxAnimal, {
        type: 'doughnut',
        data: { labels: ['イノシシ', 'ニホンジカ', 'サル', 'ノウサギ'], datasets: [{ data: [0, 0, 0, 0], backgroundColor: ['#8B5A2B', '#9b59b6', '#f1c40f', '#3498db'], borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } }
    });

    trapTypeChart = new Chart(ctxTrap, {
        type: 'doughnut',
        data: { labels: ['箱罠', 'くくり罠', '囲い罠'], datasets: [{ data: [0, 0, 0], backgroundColor: ['#e74c3c', '#2980b9', '#27ae60'], borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } }
    });
}

initCharts();

onValue(dbRef, (snapshot) => {
    currentData = snapshot.val() || {};
    renderList();
});

function renderList() {
    const listContainer = document.getElementById('infoList');
    const fragment = document.createDocumentFragment();
    listContainer.innerHTML = '';

    Object.keys(markers).forEach(id => {
        map.removeLayer(markers[id]);
        delete markers[id];
    });

    const counts = { boar: 0, deer: 0, monkey: 0, rabbit: 0, box: 0, foot: 0, enclosure: 0 };
    const itemsArray = Object.keys(currentData).map(key => ({ id: key, ...currentData[key] }));
    itemsArray.sort((a, b) => new Date(b.date) - new Date(a.date));

    itemsArray.forEach(d => {
        if (counts[d.type] !== undefined) counts[d.type]++;
        if (d.type === 'trap' && counts[d.trapType] !== undefined) counts[d.trapType]++;
    });

    if (animalChart && trapTypeChart) {
        animalChart.data.datasets[0].data = [counts.boar, counts.deer, counts.monkey, counts.rabbit];
        animalChart.update('none');
        trapTypeChart.data.datasets[0].data = [counts.box, counts.foot, counts.enclosure];
        trapTypeChart.update('none');
    }

    itemsArray.forEach(item => {
        let pinClass = 'pin-boar'; let emoji = '🐗'; let badgeClass = 'badge-boar'; let displayTypeName = item.typeName;
        if (item.type === 'deer') { pinClass = 'pin-deer'; emoji = '🦌'; badgeClass = 'badge-deer'; }
        else if (item.type === 'monkey') { pinClass = 'pin-monkey'; emoji = '🐒'; badgeClass = 'badge-monkey'; }
        else if (item.type === 'rabbit') { pinClass = 'pin-rabbit'; emoji = '🐇'; badgeClass = 'badge-rabbit'; }
        else if (item.type === 'trap') { 
            emoji = '🪤'; let trapLabel = '不明な罠';
            if (item.trapType === 'box') { pinClass = 'pin-trap-box'; badgeClass = 'badge-trap-box'; trapLabel = '箱罠'; }
            else if (item.trapType === 'foot') { pinClass = 'pin-trap-foot'; badgeClass = 'badge-trap-foot'; trapLabel = 'くくり罠'; }
            else if (item.trapType === 'enclosure') { pinClass = 'pin-trap-enclosure'; badgeClass = 'badge-trap-enclosure'; trapLabel = '囲い罠'; }
            displayTypeName = `罠 (${trapLabel})`;
        }

        if (item.lat && item.lng) {
            const customIcon = L.divIcon({ className: `custom-pin ${pinClass}`, html: `<span>${emoji}</span>`, iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -34] });
            const marker = L.marker([item.lat, item.lng], { icon: customIcon }).addTo(map);
            marker.bindPopup(`<strong>【${displayTypeName}】${item.title}</strong><br><small>場所: ${item.location}</small><br><small>日付: ${item.date}</small><br><br>${item.desc}`);
            markers[item.id] = marker;
        }

        const listItem = document.createElement('li');
        listItem.className = 'data-item';
        
        const actionBtnsHtml = isLoggedIn 
            ? `<div class="item-action-btns"><button class="action-btn btn-edit">編集</button><button class="action-btn btn-delete">削除</button></div>` 
            : '';

        listItem.innerHTML = `<span class="badge ${badgeClass}">${displayTypeName}</span><div class="item-title">${item.title}</div><div class="item-location">📍 ${item.location}</div><div class="item-date">${item.date}</div>${actionBtnsHtml}`;

        listItem.addEventListener('click', (e) => { 
            if (e.target.tagName !== 'BUTTON' && item.lat && item.lng) { 
                if (window.innerWidth <= 768) {
                    document.getElementById('map').scrollIntoView({ behavior: 'smooth' });
                }
                map.flyTo([item.lat, item.lng], 14); 
                if (markers[item.id]) markers[item.id].openPopup(); 
            } 
        });

        if (isLoggedIn) {
            listItem.querySelector('.btn-edit').addEventListener('click', (e) => { e.stopPropagation(); startEdit(item.id); });
            listItem.querySelector('.btn-delete').addEventListener('click', (e) => { e.stopPropagation(); deleteData(item.id); });
        }
        
        fragment.appendChild(listItem);
    });

    listContainer.appendChild(fragment);
    resizeMap();
}

window.deleteData = function(id) {
    if (!isLoggedIn) return;
    if (confirm('このデータを削除してもよろしいですか？')) {
        remove(ref(db, `damages/${id}`));
        if (document.getElementById('editId').value === id) resetForm();
    }
}

window.startEdit = function(id) {
    if (!isLoggedIn) return;
    const item = currentData[id];
    if (!item) return;
    document.getElementById('editId').value = id;
    document.getElementById('formType').value = item.type;
    toggleTrapTypeSelect();
    if (item.type === 'trap') document.getElementById('formTrapType').value = item.trapType;
    document.getElementById('formTitle').value = item.title;
    document.getElementById('formDate').value = item.date;
    document.getElementById('formLocation').value = item.location;
    document.getElementById('formDesc').value = item.desc;
    document.getElementById('submitBtn').innerText = '💾 変更を保存';
    document.getElementById('submitBtn').style.backgroundColor = '#3498db';
    document.getElementById('cancelBtn').style.display = 'inline-block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('cancelBtn').addEventListener('click', resetForm);
function resetForm() {
    document.getElementById('editId').value = ''; 
    document.getElementById('formType').value = 'boar'; 
    toggleTrapTypeSelect();
    document.getElementById('formTitle').value = ''; 
    document.getElementById('formLocation').value = ''; 
    document.getElementById('formDesc').value = '';
    document.getElementById('formDate').value = new Date().toISOString().split('T')[0];
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerText = '＋ データを追加'; 
    submitBtn.style.backgroundColor = '#2ecc71';
    submitBtn.disabled = false;
    document.getElementById('cancelBtn').style.display = 'none';
}

async function fetchCoordinates(locationStr) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        const queryStr = locationStr.includes('熊本県') ? locationStr : '熊本県 ' + locationStr;
        const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr)}&limit=1`;
        
        const response = await fetch(searchUrl, { 
            headers: { 
                'Accept-Language': 'ja'
            },
            signal: controller.signal 
        });
        clearTimeout(timeoutId);

        if (!response.ok) return null;
        const results = await response.json();
        if (results && results.length > 0) {
            return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
        }
        return null;
    } catch (err) {
        clearTimeout(timeoutId);
        return null;
    }
}

document.getElementById('inputForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isLoggedIn) return;

    const submitBtn = document.getElementById('submitBtn');
    const locationInput = document.getElementById('formLocation').value.trim();
    const editId = document.getElementById('editId').value;

    const originalBtnText = submitBtn.innerText;
    submitBtn.disabled = true;
    submitBtn.innerText = '🔍 位置を取得中...';

    let lat = null;
    let lng = null;
    const latLngPattern = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?)\s*,\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;

    if (latLngPattern.test(locationInput)) {
        const parts = locationInput.split(',');
        lat = parseFloat(parts[0]); 
        lng = parseFloat(parts[1]);
    } else {
        const coords = await fetchCoordinates(locationInput);
        if (coords) {
            lat = coords.lat;
            lng = coords.lng;
        } else {
            alert('熊本県内で該当する場所が見つかりませんでした。\n「人吉市○○町」と入力するか、地図をクリックして座標を割り当ててください。');
            submitBtn.disabled = false;
            submitBtn.innerText = originalBtnText;
            return;
        }
    }

    const type = document.getElementById('formType').value;
    const trapType = document.getElementById('formTrapType').value;
    let typeName = 'イノシシ';
    if (type === 'deer') typeName = 'ニホンジカ';
    if (type === 'monkey') typeName = 'サル';
    if (type === 'rabbit') typeName = 'ノウサギ';
    if (type === 'trap') typeName = '罠設置';

    const newData = {
        type, typeName, trapType,
        title: document.getElementById('formTitle').value,
        date: document.getElementById('formDate').value,
        location: locationInput, lat, lng,
        desc: document.getElementById('formDesc').value || '詳細なし'
    };

    submitBtn.innerText = '💾 保存中...';

    try {
        if (editId) {
            await update(ref(db, `damages/${editId}`), newData);
        } else {
            await set(push(dbRef), newData);
        }
        resetForm();
    } catch (err) {
        console.error(err);
        alert('データの保存に失敗しました。');
        submitBtn.disabled = false;
        submitBtn.innerText = originalBtnText;
    }
});

setTimeout(() => {
    resizeMap();
}, 500);
