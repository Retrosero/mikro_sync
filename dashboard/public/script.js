// Connect to Socket.io
const socket = io();

// DOM Elements
const logContainer = document.getElementById('log-container');
const clearLogsBtn = document.getElementById('clear-logs');
const statusText = document.getElementById('status-text');
const systemStatusDot = document.getElementById('system-status-dot');
const systemStatusText = document.getElementById('system-status-text');
const dashboardMenuContainer = document.getElementById('dashboard-menu-container');
const cameraBtn = document.getElementById('camera-btn');
const headerSyncBtn = document.getElementById('header-sync-btn');

// Log filter elements
const logFilterSelect = document.getElementById('log-filter');
const logSearchInput = document.getElementById('log-search');
const logExportBtn = document.getElementById('log-export');
const logStatsElement = document.getElementById('log-stats');

// Error log filter elements
const errorLogSearchInput = document.getElementById('error-log-search');
const errorLogLevelSelect = document.getElementById('error-log-level');
const errorLogContextSelect = document.getElementById('error-log-context');
const errorLogStatsElement = document.getElementById('error-log-stats');

let runningCommands = new Set();
let commands = [];
let allLogs = []; // Store all logs for filtering and searching
let allErrorLogs = []; // Store error logs for filtering/searching
const MAX_LOGS = 500;

// Modal Elements
const viewErrorsBtn = document.getElementById('view-errors');
const errorModal = document.getElementById('error-modal');
const closeModalBtn = document.getElementById('close-modal');
const clearErrorFileBtn = document.getElementById('clear-error-file');
const errorLogContent = document.getElementById('error-log-content');

const viewFailedBtn = document.getElementById('view-failed-items');
const failedModal = document.getElementById('failed-items-modal');
const closeFailedBtn = document.getElementById('close-failed-modal');
const failedTbody = document.getElementById('failed-items-tbody');

// Defined Menu Structure
const menuCategories = [
    {
        title: 'SENKRONİZASYON',
        color: 'bg-indigo-600',
        items: [
            { id: 'continuous-sync', name: 'Sürekli Senkronizasyon', icon: 'refresh-cw', description: 'Sistem arka planda sürekli çalışır ve anlık veri senkronizasyonu sağlar.' },
            { id: 'erp-to-web', name: 'ERP → Web', icon: 'upload-cloud', description: 'Mikro verilerini (Stok, Fiyat, vb.) web sitesine tek yönlü aktarır.' },
            { id: 'web-to-erp', name: 'Web → ERP', icon: 'download-cloud', description: 'Web siparişlerini ve müşteri carilerini Mikro sistemine aktarır.' },
            { id: 'entegra-sync', name: 'Entegra Senkronizasyonu', icon: 'waypoints', description: 'Entegra ile ürün ve stok verilerini eşitler.' }
        ]
    }
];

// Initialize
async function init() {
    setupSocketListeners();
    renderDashboard();
    setupCamera();
    await loadCommands();
}

function renderDashboard() {
    dashboardMenuContainer.innerHTML = '';
    menuCategories.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'flex flex-col gap-4';
        const headerHtml = `<div class="flex items-center gap-3 border-b border-slate-200 pb-2"><div class="w-1.5 h-6 ${category.color} rounded-r-full"></div><h2 class="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">${category.title}</h2></div>`;
        const gridHtml = document.createElement('div');
        gridHtml.className = 'grid grid-cols-2 lg:grid-cols-2 gap-4';
        category.items.forEach(item => {
            const serverCmd = commands.find(c => c.id === item.id) || {};
            const cmd = { name: item.name || serverCmd.name || 'Bilinmeyen', description: item.description || serverCmd.description || '', icon: item.icon || serverCmd.icon || 'circle-alert', last_run: serverCmd.last_run || null };
            const btn = document.createElement('button');
            btn.className = 'group relative flex flex-col items-start justify-between p-6 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 h-40 text-left';
            btn.setAttribute('data-cmd-id', item.id);
            let lastRunHtml = '<span class="text-[9px] text-slate-300 font-medium">Hiç çalışmadı</span>';
            if (cmd.last_run) {
                const date = new Date(cmd.last_run);
                const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                lastRunHtml = `<span class="text-[9px] text-slate-400 font-mono">Son: ${timeStr}</span>`;
            }
            btn.innerHTML = `<div class="flex items-start justify-between w-full"><div class="icon-wrapper p-3 bg-slate-50 text-slate-600 rounded-2xl group-hover:bg-primary group-hover:text-white transition-colors duration-300"><i data-lucide="${cmd.icon || 'activity'}" class="w-6 h-6"></i></div>${lastRunHtml}</div><div class="mt-4 w-full"><h3 class="text-[13px] font-bold text-slate-800 group-hover:text-primary transition-colors mb-1">${cmd.name}</h3><p class="text-[10px] text-slate-400 font-medium leading-relaxed line-clamp-2">${cmd.description}</p></div>`;
            btn.addEventListener('click', () => {
                const cmdName = cmd.name || item.name;
                if (runningCommands.has(item.id)) {
                    if (confirm(`${cmdName} işlemini durdurmak istediğinize emin misiniz?`)) {
                        socket.emit('stop-command', item.id);
                    }
                } else {
                    socket.emit('execute-command', item.id);
                }
            });
            gridHtml.appendChild(btn);
        });
        categoryDiv.innerHTML = headerHtml;
        categoryDiv.appendChild(gridHtml);
        dashboardMenuContainer.appendChild(categoryDiv);
    });
    if (window.lucide) lucide.createIcons();
}

function handleMenuClick(name) {
    if (name === 'Manuel Senkronizasyon') { triggerManualSync(); return; }
    if (name === 'Ürünler') { addLog('SİSTEM', 'BİLGİ', 'Ürünler sayfasına yönlendiriliyor... (Demo)'); }
    else { addLog('SİSTEM', 'UYARI', `${name} modülü henüz aktif değil.`); }
}

function setupCamera() {
    if (cameraBtn) {
        cameraBtn.addEventListener('click', () => { addLog('SİSTEM', 'BİLGİ', 'Kamera uygulaması başlatılıyor...'); });
    }
}

if (headerSyncBtn) { headerSyncBtn.addEventListener('click', () => { triggerManualSync(); }); }

function updateButtonStates() {
    document.querySelectorAll('button[data-cmd-id]').forEach(btn => {
        const cmdId = btn.getAttribute('data-cmd-id');
        const iconWrapper = btn.querySelector('.icon-wrapper');
        if (runningCommands.has(cmdId)) {
            btn.classList.add('border-primary', 'bg-blue-50/30');
            if (iconWrapper) iconWrapper.classList.add('animate-pulse', 'bg-primary', 'text-white');
        } else {
            btn.classList.remove('border-primary', 'bg-blue-50/30');
            if (iconWrapper) iconWrapper.classList.remove('animate-pulse', 'bg-primary', 'text-white');
        }
    });
}

function setupSocketListeners() {
    socket.on('connect', () => { setConnectionStatus(true); addLog('SİSTEM', 'BİLGİ', 'Sunucuya bağlanıldı.'); });
    socket.on('initial-state', (runningIds) => {
        runningCommands = new Set(runningIds);
        updateButtonStates();
        if (runningIds.length > 0) {
            let msg = `Sistem durumu senkronize edildi.`;
            if (runningIds.includes('continuous-sync')) msg += ' (Sürekli Senkronizasyon AKTİF)';
            addLog('SİSTEM', 'BİLGİ', msg);
        }
    });
    socket.on('disconnect', () => { setConnectionStatus(false); addLog('SİSTEM', 'HATA', 'Bağlantı kesildi!'); });
    socket.on('log', (data) => {
        let source = 'PROCESS', type = 'BİLGİ', message = data.message;
        if (data.type === 'error' || data.type === 'stderr') type = 'HATA';
        if (data.type === 'warning') type = 'UYARI';
        if (data.type === 'success') type = 'BAŞARILI';
        if (data.commandId) {
            const cmdNameMap = { 'continuous-sync': 'SÜREKLİ SENK.', 'erp-to-web': 'ERP → WEB', 'web-to-erp': 'WEB → ERP', 'entegra-sync': 'ENTEGRA SENK.', 'stock-xml': 'STOK XML' };
            source = cmdNameMap[data.commandId] || data.commandId.toUpperCase();
        }
        if (data.type === 'info') source = 'SİSTEM';
        message = message.replace(/\u001b\[[0-9;]*m/g, '');
        if (message.trim()) addLog(source, type, message);
        if (data.commandId && !runningCommands.has(data.commandId) && data.type !== 'success' && data.type !== 'error') {
            runningCommands.add(data.commandId);
            updateButtonStates();
        }
    });
    socket.on('command-finished', (data) => {
        runningCommands.delete(data.commandId);
        updateButtonStates();
        if (data.commandId === 'sync-queue-worker') {
            const pulse = document.getElementById('worker-pulse');
            const dot = document.getElementById('worker-dot');
            if (pulse) pulse.classList.add('hidden');
            if (dot) { dot.classList.add('bg-slate-300'); dot.classList.remove('bg-status-success'); }
        }
        const status = data.code === 0 ? 'BAŞARILI' : 'HATA';
        addLog('SİSTEM', status, `İşlem tamamlandı: ${data.commandId}`);
        loadCommands().then(() => { renderDashboard(); });
    });
    socket.on('command-stopped', (data) => {
        runningCommands.delete(data.commandId);
        updateButtonStates();
        addLog('SİSTEM', 'UYARI', `${data.commandId} kullanıcı tarafından durduruldu.`);
        loadCommands().then(() => { renderDashboard(); });
    });
}

function addLog(source, type, message, rawMessage = null) {
    const timestamp = new Date();
    const time = timestamp.toLocaleTimeString('tr-TR', { hour12: false });
    const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const logEntry = { id, timestamp: timestamp.toISOString(), time, source, type, message, rawMessage: rawMessage || message };
    allLogs.unshift(logEntry);
    if (allLogs.length > MAX_LOGS) allLogs = allLogs.slice(0, MAX_LOGS);
    renderLogs();
    updateLogStats();
}

function renderLogs() {
    const filter = logFilterSelect?.value || 'all';
    const searchTerm = logSearchInput?.value?.toLowerCase() || '';
    let filteredLogs = allLogs;
    if (filter !== 'all') {
        const typeMap = { 'errors': 'HATA', 'warnings': 'UYARI', 'success': 'BAŞARILI', 'info': 'BİLGİ' };
        if (typeMap[filter]) filteredLogs = filteredLogs.filter(log => log.type === typeMap[filter]);
    }
    if (searchTerm) filteredLogs = filteredLogs.filter(log => log.message.toLowerCase().includes(searchTerm) || log.source.toLowerCase().includes(searchTerm));
    logContainer.innerHTML = '';
    if (filteredLogs.length === 0) {
        logContainer.innerHTML = `<div class="flex flex-col items-center justify-center h-64 text-slate-300"><span class="material-symbols-outlined text-5xl mb-4">inbox</span><p class="text-[11px] font-bold uppercase tracking-widest">Log bulunamadı</p></div>`;
        return;
    }
    filteredLogs.forEach(log => { logContainer.appendChild(createLogRow(log)); });
}

function createLogRow(log) {
    const row = document.createElement('div');
    row.className = 'grid grid-cols-[90px_110px_80px_1fr] px-8 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors animate-in fade-in slide-in-from-left-2 duration-300 items-center group cursor-pointer';
    row.setAttribute('data-log-id', log.id);
    let typeClass = 'bg-slate-100 text-slate-400', textClass = 'text-slate-600', typeIcon = 'info';
    if (log.type === 'BAŞARILI') { typeClass = 'bg-status-success/10 text-status-success'; typeIcon = 'check_circle'; }
    if (log.type === 'HATA') { typeClass = 'bg-status-error/10 text-status-error'; textClass = 'text-status-error font-medium'; typeIcon = 'error'; }
    if (log.type === 'UYARI') { typeClass = 'bg-status-warning/10 text-status-warning'; typeIcon = 'warning'; }
    if (log.type === 'BİLGİ') { typeIcon = 'info'; }
    row.innerHTML = `<div class="text-slate-400 font-mono text-[10px] tracking-tight">${log.time}</div><div class="text-primary font-bold text-[10px] truncate pr-4 tracking-wide uppercase">${log.source}</div><div><span class="text-[9px] font-black px-2 py-0.5 rounded shadow-sm ${typeClass} tracking-wider inline-flex items-center gap-1"><span class="material-symbols-outlined text-[10px]">${typeIcon}</span>${log.type}</span></div><div class="${textClass} text-[11px] break-words font-medium leading-relaxed truncate group-hover:whitespace-normal" title="${escapeHtml(log.message)}">${escapeHtml(log.message)}</div>`;
    row.addEventListener('click', () => { showLogDetail(log); });
    return row;
}

function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

function showLogDetail(log) {
    const modal = document.getElementById('log-detail-modal');
    const modalContent = document.getElementById('log-detail-content');
    const modalTime = document.getElementById('log-detail-time');
    const modalSource = document.getElementById('log-detail-source');
    const modalType = document.getElementById('log-detail-type');
    if (!modal) return;
    modalTime.textContent = new Date(log.timestamp).toLocaleString('tr-TR');
    modalSource.textContent = log.source;
    modalType.textContent = log.type;
    modalContent.textContent = log.rawMessage;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function updateLogStats() {
    if (!logStatsElement) return;
    const stats = { total: allLogs.length, errors: allLogs.filter(l => l.type === 'HATA').length, warnings: allLogs.filter(l => l.type === 'UYARI').length, success: allLogs.filter(l => l.type === 'BAŞARILI').length, info: allLogs.filter(l => l.type === 'BİLGİ').length };
    logStatsElement.innerHTML = `<span class="text-[9px] text-slate-400 font-medium">Toplam: <span class="font-bold text-slate-600">${stats.total}</span> | <span class="text-status-error">${stats.errors} Hata</span> | <span class="text-status-warning">${stats.warnings} Uyarı</span> | <span class="text-status-success">${stats.success} Başarılı</span></span>`;
}

function exportLogs(format = 'json') {
    let content, filename, mimeType;
    if (format === 'json') { content = JSON.stringify(allLogs, null, 2); filename = `logs-${new Date().toISOString().split('T')[0]}.json`; mimeType = 'application/json'; }
    else if (format === 'csv') {
        const headers = ['Zaman', 'Kaynak', 'Tip', 'Mesaj'];
        const rows = allLogs.map(log => [log.timestamp, log.source, log.type, `"${log.message.replace(/"/g, '""')}"`]);
        content = [headers, ...rows].map(row => row.join(',')).join('\n');
        filename = `logs-${new Date().toISOString().split('T')[0]}.csv`; mimeType = 'text/csv';
    } else if (format === 'txt') {
        content = allLogs.map(log => `[${log.time}] [${log.source}] [${log.type}] ${log.message}`).join('\n');
        filename = `logs-${new Date().toISOString().split('T')[0]}.txt`; mimeType = 'text/plain';
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    addLog('SİSTEM', 'BİLGİ', `Loglar ${format.toUpperCase()} formatında indirildi.`);
}

function setConnectionStatus(connected) {
    if (connected) {
        systemStatusDot.className = 'size-2 bg-status-success rounded-full ring-4 ring-status-success/20';
        systemStatusText.textContent = 'TÜM SİSTEMLER ÇALIŞIYOR';
        statusText.className = 'px-3 py-1 bg-status-success/10 text-status-success text-[10px] font-bold tracking-widest uppercase rounded-full';
    } else {
        systemStatusDot.className = 'size-2 bg-status-error rounded-full animate-pulse';
        systemStatusText.textContent = 'BAĞLANTI KESİLDİ';
        statusText.className = 'px-3 py-1 bg-status-error/10 text-status-error text-[10px] font-bold tracking-widest uppercase rounded-full';
    }
}

// --- Event Listeners ---
clearLogsBtn.addEventListener('click', () => { logContainer.innerHTML = ''; addLog('SİSTEM', 'UYARI', 'Canlı günlük akışı temizlendi.'); });
viewErrorsBtn.addEventListener('click', async () => { errorModal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; await fetchErrorLogs(); });
closeModalBtn.addEventListener('click', () => { errorModal.classList.add('hidden'); document.body.style.overflow = 'auto'; });
clearErrorFileBtn.addEventListener('click', async () => {
    if (confirm('Tüm hata kayıt geçmişini kalıcı olarak silmek istediğinize emin misiniz?')) {
        await fetch('/api/errors/clear');
        errorLogContent.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-slate-300"><span class="material-symbols-outlined text-4xl mb-2">check_circle</span><p class="text-[10px] font-bold uppercase tracking-widest">Hata kayıtları temizlendi.</p></div>';
    }
});
errorModal.addEventListener('click', (e) => { if (e.target === errorModal) { errorModal.classList.add('hidden'); document.body.style.overflow = 'auto'; } });

viewFailedBtn.addEventListener('click', async () => { failedModal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; await fetchFailedItems(); });
closeFailedBtn.addEventListener('click', () => { failedModal.classList.add('hidden'); document.body.style.overflow = 'auto'; });
failedModal.addEventListener('click', (e) => { if (e.target === failedModal) { failedModal.classList.add('hidden'); document.body.style.overflow = 'auto'; } });

async function fetchFailedItems() {
    try {
        failedTbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-400">Yükleniyor...</td></tr>';
        const response = await fetch('/api/failed-items');
        const items = await response.json();
        if (items.length === 0) { failedTbody.innerHTML = '<tr><td colspan="5" class="p-12 text-center text-slate-300 italic">Şu an için hatalı kayıt bulunmuyor.</td></tr>'; return; }
        failedTbody.innerHTML = items.map(item => `<tr><td class="px-6 py-4"><div class="font-black text-slate-900">${item.entity_type}</div><div class="text-[9px] text-slate-400">ID: ${item.entity_id}</div></td><td class="px-6 py-4 text-center"><span class="px-2 py-0.5 bg-slate-100 rounded-md text-[9px] font-black">${item.operation}</span></td><td class="px-6 py-4"><div class="max-w-md text-red-500 line-clamp-2" title="${item.error_message}">${item.error_message}</div><div class="text-[9px] text-slate-400 mt-1">Deneme: ${item.retry_count}</div></td><td class="px-6 py-4 text-slate-400 font-mono text-[10px]">${new Date(item.processed_at || item.created_at).toLocaleString('tr-TR')}</td><td class="px-6 py-4 text-right"><div class="flex items-center justify-end gap-2 text-red-500 font-bold"><button onclick="retryItem('${item.id}')" class="p-2 hover:bg-orange-50 text-orange-500 rounded-lg transition-all" title="Tekrar Dene"><span class="material-symbols-outlined text-sm">replay</span></button><button onclick="deleteItem('${item.id}')" class="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-all" title="Sil"><span class="material-symbols-outlined text-sm">delete</span></button></div></td></tr>`).join('');
    } catch (error) { failedTbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500">Hata: ${error.message}</td></tr>`; }
}

async function retryItem(id) {
    if (!confirm('Bu kaydı tekrar senkronizasyon kuyruğuna almak istediğinize emin misiniz?')) return;
    try { const response = await fetch(`/api/retry-item/${id}`, { method: 'POST' }); if (response.ok) { addLog('SİSTEM', 'BAŞARILI', `Kayıt (#${id}) tekrar kuyruğa alındı.`); await fetchFailedItems(); } }
    catch (error) { alert('İşlem başarısız: ' + error.message); }
}

async function deleteItem(id) {
    if (!confirm('Bu kaydı kalıcı olarak silmek istediğinize emin misiniz?')) return;
    try { const response = await fetch(`/api/delete-item/${id}`, { method: 'POST' }); if (response.ok) { addLog('SİSTEM', 'UYARI', `Kayıt (#${id}) kuyruktan silindi.`); await fetchFailedItems(); } }
    catch (error) { alert('İşlem başarısız: ' + error.message); }
}

window.retryItem = retryItem;
window.deleteItem = deleteItem;

// Format date for error log display
function formatDate(timestamp) {
    if (!timestamp) return 'Bilinmiyor';
    try {
        const date = new Date(timestamp);
        return date.toLocaleString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) { return timestamp; }
}

// Update error log stats
function updateErrorLogStats(filteredLogs, allLogs) {
    if (!errorLogStatsElement) return;
    const stats = { total: allLogs.length, errors: allLogs.filter(l => l.level === 'error').length, warnings: allLogs.filter(l => l.level === 'warn').length, info: allLogs.filter(l => l.level === 'info').length, filtered: filteredLogs.length };
    const showFiltered = stats.filtered !== stats.total;
    errorLogStatsElement.innerHTML = `<span class="text-[9px] text-slate-500 font-medium">${showFiltered ? `Filtrelenen: <span class="font-bold text-primary">${stats.filtered}</span> / ` : ''}Toplam: <span class="font-bold text-slate-700">${stats.total}</span> | <span class="text-red-500">${stats.errors} Hata</span> | <span class="text-orange-500">${stats.warnings} Uyarı</span></span>`;
}

// Fetch and render error logs with filtering
async function fetchErrorLogs() {
    try {
        errorLogContent.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-slate-300"><span class="material-symbols-outlined text-5xl mb-4 animate-spin">refresh</span><p class="font-bold tracking-widest uppercase text-xs">Veriler Yükleniyor...</p></div>';
        const response = await fetch('/api/errors/json');
        allErrorLogs = await response.json();
        renderErrorLogs();
    } catch (error) {
        errorLogContent.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-red-400"><span class="material-symbols-outlined text-6xl mb-4">report_problem</span><p class="font-bold tracking-widest uppercase text-xs">Hata kayıtları yüklenemedi.</p></div>';
    }
}

// Render error logs based on filters
function renderErrorLogs() {
    const searchTerm = errorLogSearchInput?.value?.toLowerCase() || '';
    const levelFilter = errorLogLevelSelect?.value || '';
    const contextFilter = errorLogContextSelect?.value || '';
    let filteredLogs = allErrorLogs;
    if (levelFilter) filteredLogs = filteredLogs.filter(log => log.level === levelFilter);
    if (contextFilter) filteredLogs = filteredLogs.filter(log => log.context === contextFilter);
    if (searchTerm) filteredLogs = filteredLogs.filter(log => log.message?.toLowerCase().includes(searchTerm) || log.service?.toLowerCase().includes(searchTerm) || log.context?.toLowerCase().includes(searchTerm));
    updateErrorLogStats(filteredLogs, allErrorLogs);
    if (filteredLogs.length === 0) {
        errorLogContent.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-slate-300"><span class="material-symbols-outlined text-6xl mb-4">inbox</span><p class="font-bold tracking-widest uppercase text-xs">Filtrelere uygun log bulunamadı</p></div>`;
        return;
    }
    let html = '<div class="p-4 space-y-3">';
    filteredLogs.forEach((error, index) => {
        const timestamp = error.timestamp || error.isoTimestamp || 'Bilinmiyor';
        const level = error.level || 'ERROR';
        const service = error.service || 'N/A';
        const context = error.context || 'N/A';
        const message = error.message || 'Mesaj yok';
        const stack = error.errorStack || error.stack;
        const errorCode = error.errorCode;
        let levelClass = 'bg-slate-100 text-slate-600', levelIcon = 'info';
        if (level === 'error') { levelClass = 'bg-red-100 text-red-600'; levelIcon = 'error'; }
        else if (level === 'warn') { levelClass = 'bg-orange-100 text-orange-600'; levelIcon = 'warning'; }
        html += `<div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"><div class="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between"><div class="flex items-center gap-2"><span class="material-symbols-outlined ${level === 'error' ? 'text-red-500' : 'text-orange-500'} text-sm">${levelIcon}</span><span class="text-[10px] font-bold ${levelClass} uppercase tracking-wider px-2 py-0.5 rounded">${level}</span><span class="text-[9px] text-slate-400 font-mono">${formatDate(timestamp)}</span></div><div class="flex items-center gap-2"><span class="text-[9px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">${escapeHtml(service)}</span><span class="text-[9px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">${escapeHtml(context)}</span></div></div><div class="p-4"><div class="text-[11px] font-medium text-slate-800 mb-3 leading-relaxed">${escapeHtml(message)}</div>${errorCode ? `<div class="text-[9px] font-mono text-red-500 bg-red-50 px-2 py-1 rounded inline-block mb-2">Kod: ${errorCode}</div>` : ''}${stack ? `<details class="mt-2"><summary class="text-[9px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600 flex items-center gap-1"><span class="material-symbols-outlined text-[12px]">code</span>Stack Trace</summary><pre class="mt-2 p-3 bg-slate-900 text-green-400 rounded-lg text-[9px] font-mono overflow-x-auto whitespace-pre-wrap max-h-64">${escapeHtml(stack)}</pre></details>` : ''}</div></div>`;
    });
    html += '</div>';
    errorLogContent.innerHTML = html;
}

async function loadCommands() {
    try { const response = await fetch('/api/commands'); commands = await response.json(); updateButtonStates(); }
    catch (error) { console.error('Komutlar yüklenemedi:', error); }
}

async function triggerManualSync() {
    addLog('SİSTEM', 'BİLGİ', 'Manuel senkronizasyon isteği gönderiliyor...');
    try {
        const response = await fetch('http://localhost:3001/api/trigger-sync', { method: 'POST' });
        const data = await response.json();
        addLog('SİSTEM', data.success ? 'BAŞARILI' : 'UYARI', data.message);
    } catch (error) { addLog('SİSTEM', 'HATA', 'Senkronizasyon tetiklenemedi. Servis çalışıyor mu? (Port 3001)'); console.error(error); }
}

// Event Listeners for Log Controls
document.addEventListener('DOMContentLoaded', () => {
    if (logFilterSelect) logFilterSelect.addEventListener('change', renderLogs);
    if (logSearchInput) logSearchInput.addEventListener('input', renderLogs);

    // Export dropdown toggle
    const exportDropdown = document.getElementById('export-dropdown');
    if (logExportBtn && exportDropdown) {
        logExportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = !exportDropdown.classList.contains('opacity-0');
            exportDropdown.classList.toggle('opacity-0', !isVisible);
            exportDropdown.classList.toggle('pointer-events-none', !isVisible);
        });

        // Export format buttons
        exportDropdown.querySelectorAll('button[data-format]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const format = btn.getAttribute('data-format');
                exportLogs(format);
                exportDropdown.classList.add('opacity-0', 'pointer-events-none');
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            exportDropdown.classList.add('opacity-0', 'pointer-events-none');
        });
    }

    const logDetailModal = document.getElementById('log-detail-modal');
    const logDetailClose = document.getElementById('log-detail-close');
    if (logDetailClose && logDetailModal) {
        logDetailClose.addEventListener('click', () => { logDetailModal.classList.add('hidden'); document.body.style.overflow = 'auto'; });
        logDetailModal.addEventListener('click', (e) => { if (e.target === logDetailModal) { logDetailModal.classList.add('hidden'); document.body.style.overflow = 'auto'; } });
    }
    // Error log filter listeners
    if (errorLogSearchInput) errorLogSearchInput.addEventListener('input', renderErrorLogs);
    if (errorLogLevelSelect) errorLogLevelSelect.addEventListener('change', renderErrorLogs);
    if (errorLogContextSelect) errorLogContextSelect.addEventListener('change', renderErrorLogs);
});

init();