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

let runningCommands = new Set();
let commands = [];

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
            {
                id: 'continuous-sync',
                name: 'Sürekli Senkronizasyon',
                icon: 'refresh-cw',
                description: 'Sistem arka planda sürekli çalışır ve anlık veri senkronizasyonu sağlar.'
            },
            {
                id: 'erp-to-web',
                name: 'ERP → Web',
                icon: 'upload-cloud',
                description: 'Mikro verilerini (Stok, Fiyat, vb.) web sitesine tek yönlü aktarır.'
            },
            {
                id: 'web-to-erp',
                name: 'Web → ERP',
                icon: 'download-cloud',
                description: 'Web siparişlerini ve müşteri carilerini Mikro sistemine aktarır.'
            },
            {
                id: 'entegra-sync',
                name: 'Entegra Senkronizasyonu',
                icon: 'waypoints',
                description: 'Entegra ile ürün ve stok verilerini eşitler.'
            }
        ]
    }
];

// Initialize
async function init() {
    setupSocketListeners();
    renderDashboard();
    setupCamera();

    // Load system commands
    await loadCommands();
}

function renderDashboard() {
    dashboardMenuContainer.innerHTML = '';

    menuCategories.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'flex flex-col gap-4';

        const headerHtml = `
            <div class="flex items-center gap-3 border-b border-slate-200 pb-2">
                <div class="w-1.5 h-6 ${category.color} rounded-r-full"></div>
                <h2 class="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">${category.title}</h2>
            </div>
        `;

        const gridHtml = document.createElement('div');
        gridHtml.className = 'grid grid-cols-2 lg:grid-cols-2 gap-4';

        category.items.forEach(item => {
            // Find command details from server but default to static item details
            const serverCmd = commands.find(c => c.id === item.id) || {};

            // Merge static item details with server details (server details take precedence for status/last_run)
            const cmd = {
                name: item.name || serverCmd.name || 'Bilinmeyen',
                description: item.description || serverCmd.description || '',
                icon: item.icon || serverCmd.icon || 'circle-alert',
                last_run: serverCmd.last_run || null
            };

            const btn = document.createElement('button');
            btn.className = 'group relative flex flex-col items-start justify-between p-6 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 h-40 text-left';
            btn.setAttribute('data-cmd-id', item.id);

            // Last run time formatting
            let lastRunHtml = '<span class="text-[9px] text-slate-300 font-medium">Hiç çalışmadı</span>';
            if (cmd.last_run) {
                const date = new Date(cmd.last_run);
                const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                lastRunHtml = `<span class="text-[9px] text-slate-400 font-mono">Son: ${timeStr}</span>`;
            }

            btn.innerHTML = `
                <div class="flex items-start justify-between w-full">
                    <div class="icon-wrapper p-3 bg-slate-50 text-slate-600 rounded-2xl group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                        <i data-lucide="${cmd.icon || 'activity'}" class="w-6 h-6"></i>
                    </div>
                    ${lastRunHtml}
                </div>
                
                <div class="mt-4 w-full">
                    <h3 class="text-[13px] font-bold text-slate-800 group-hover:text-primary transition-colors mb-1">${cmd.name}</h3>
                    <p class="text-[10px] text-slate-400 font-medium leading-relaxed line-clamp-2">${cmd.description}</p>
                </div>
            `;

            btn.addEventListener('click', () => {
                const cmdName = cmd.name || item.name;

                if (runningCommands.has(item.id)) {
                    // Confirmation before stopping
                    if (confirm(`${cmdName} işlemini durdurmak istediğinize emin misiniz?`)) {
                        socket.emit('stop-command', item.id);
                    }
                } else {
                    // Start command
                    socket.emit('execute-command', item.id);
                }
            });

            gridHtml.appendChild(btn);
        });

        categoryDiv.innerHTML = headerHtml;
        categoryDiv.appendChild(gridHtml);
        dashboardMenuContainer.appendChild(categoryDiv);
    });

    // Initialize Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }
}

function handleMenuClick(name) {
    if (name === 'Manuel Senkronizasyon') {
        triggerManualSync();
        return;
    }
    if (name === 'Ürünler') {
        // Example: link to products page if existed
        // window.location.href = '/products';
        addLog('SİSTEM', 'BİLGİ', 'Ürünler sayfasına yönlendiriliyor... (Demo)');
    } else {
        addLog('SİSTEM', 'UYARI', `${name} modülü henüz aktif değil.`);
    }
}

function setupCamera() {
    if (cameraBtn) {
        cameraBtn.addEventListener('click', () => {
            addLog('SİSTEM', 'BİLGİ', 'Kamera uygulaması başlatılıyor...');
        });
    }
}

if (headerSyncBtn) {
    headerSyncBtn.addEventListener('click', () => {
        triggerManualSync();
    });
}

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

// Setup socket listeners
function setupSocketListeners() {
    socket.on('connect', () => {
        setConnectionStatus(true);
        addLog('SİSTEM', 'BİLGİ', 'Sunucuya bağlanıldı.');
    });

    socket.on('initial-state', (runningIds) => {
        runningCommands = new Set(runningIds);
        updateButtonStates();
        // Also log if there are existing processes
        if (runningIds.length > 0) {
            let msg = `Sistem durumu senkronize edildi.`;
            if (runningIds.includes('continuous-sync')) {
                msg += ' (Sürekli Senkronizasyon AKTiF)';
            }
            addLog('SİSTEM', 'BİLGİ', msg);
        }
    });

    socket.on('disconnect', () => {
        setConnectionStatus(false);
        addLog('SİSTEM', 'HATA', 'Bağlantı kesildi!');
    });

    socket.on('log', (data) => {
        let source = 'PROCESS';
        let type = 'BİLGİ';
        let message = data.message;

        if (data.type === 'error' || data.type === 'stderr') type = 'HATA';
        if (data.type === 'warning') type = 'UYARI';
        if (data.type === 'success') type = 'BAŞARILI';

        if (data.commandId) {
            // Translate Source Names
            const cmdNameMap = {
                'continuous-sync': 'SÜREKLİ SENK.',
                'erp-to-web': 'ERP → WEB',
                'web-to-erp': 'WEB → ERP',
                'entegra-sync': 'ENTEGRA SENK.',
                'stock-xml': 'STOK XML'
            };
            source = cmdNameMap[data.commandId] || data.commandId.toUpperCase();
        }

        if (data.type === 'info') source = 'SİSTEM';

        message = message.replace(/\u001b\[[0-9;]*m/g, '');
        if (message.trim()) addLog(source, type, message);

        // Also update running commands set if not already there
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
            if (dot) {
                dot.classList.add('bg-slate-300');
                dot.classList.remove('bg-status-success');
            }
        }

        const status = data.code === 0 ? 'BAŞARILI' : 'HATA';
        const cmdName = data.commandId; // Could map this to a friendly name if needed
        addLog('SİSTEM', status, `İşlem tamamlandı: ${cmdName}`);

        // Refresh commands to show new last run time
        loadCommands().then(() => {
            renderDashboard();
        });
    });
}

// Add log entry
function addLog(source, type, message) {
    const time = new Date().toLocaleTimeString('tr-TR', { hour12: false });
    const row = document.createElement('div');
    row.className = 'grid grid-cols-[90px_110px_80px_1fr] px-8 py-3 border-b border-slate-50 hover:bg-white transition-colors animate-in fade-in slide-in-from-left-2 duration-300 items-center';

    let typeClass = 'bg-slate-100 text-slate-400';
    let textClass = 'text-slate-600';

    if (type === 'BAŞARILI') typeClass = 'bg-status-success/10 text-status-success';
    if (type === 'HATA') {
        typeClass = 'bg-status-error/10 text-status-error';
        textClass = 'text-status-error font-medium';
    }
    if (type === 'UYARI') typeClass = 'bg-status-warning/10 text-status-warning';

    row.innerHTML = `
        <div class="text-slate-400 font-mono text-[10px] tracking-tight">${time}</div>
        <div class="text-primary font-bold text-[10px] truncate pr-4 tracking-wide uppercase">${source}</div>
        <div>
            <span class="text-[9px] font-black px-2 py-0.5 rounded shadow-sm ${typeClass} tracking-wider">${type}</span>
        </div>
        <div class="${textClass} text-[11px] break-words font-medium leading-relaxed">${message}</div>
    `;

    logContainer.prepend(row);
    if (logContainer.children.length > 200) logContainer.removeChild(logContainer.lastChild);
}

// Update UI Connection Status
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

// Clear logs
clearLogsBtn.addEventListener('click', () => {
    logContainer.innerHTML = '';
    addLog('SİSTEM', 'UYARI', 'Canlı günlük akışı temizlendi.');
});

// View Error Logs Modal
viewErrorsBtn.addEventListener('click', async () => {
    errorModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent scroll
    await fetchErrorLogs();
});

// Close Modal
closeModalBtn.addEventListener('click', () => {
    errorModal.classList.add('hidden');
    document.body.style.overflow = 'auto';
});

// Clear Error File
clearErrorFileBtn.addEventListener('click', async () => {
    if (confirm('Tüm hata kayıt geçmişini kalıcı olarak silmek istediğinize emin misiniz?')) {
        await fetch('/api/errors/clear');
        errorLogContent.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-slate-300"><span class="material-symbols-outlined text-4xl mb-2">check_circle</span><p class="text-[10px] font-bold uppercase tracking-widest">Hata kayıtları temizlendi.</p></div>';
    }
});

// Close modal when clicking outside
errorModal.addEventListener('click', (e) => {
    if (e.target === errorModal) {
        errorModal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
});

// --- Failed Items Functions ---

viewFailedBtn.addEventListener('click', async () => {
    failedModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    await fetchFailedItems();
});

closeFailedBtn.addEventListener('click', () => {
    failedModal.classList.add('hidden');
    document.body.style.overflow = 'auto';
});

failedModal.addEventListener('click', (e) => {
    if (e.target === failedModal) {
        failedModal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
});

async function fetchFailedItems() {
    try {
        failedTbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-400">Yükleniyor...</td></tr>';
        const response = await fetch('/api/failed-items');
        const items = await response.json();

        if (items.length === 0) {
            failedTbody.innerHTML = '<tr><td colspan="5" class="p-12 text-center text-slate-300 italic">Şu an için hatalı kayıt bulunmuyor.</td></tr>';
            return;
        }

        failedTbody.innerHTML = items.map(item => `
            <tr>
                <td class="px-6 py-4">
                    <div class="font-black text-slate-900">${item.entity_type}</div>
                    <div class="text-[9px] text-slate-400">ID: ${item.entity_id}</div>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="px-2 py-0.5 bg-slate-100 rounded-md text-[9px] font-black">${item.operation}</span>
                </td>
                <td class="px-6 py-4">
                    <div class="max-w-md text-red-500 line-clamp-2" title="${item.error_message}">${item.error_message}</div>
                    <div class="text-[9px] text-slate-400 mt-1">Deneme: ${item.retry_count}</div>
                </td>
                <td class="px-6 py-4 text-slate-400 font-mono text-[10px]">
                    ${new Date(item.processed_at || item.created_at).toLocaleString('tr-TR')}
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-2 text-red-500 font-bold">
                        <button onclick="retryItem('${item.id}')" class="p-2 hover:bg-orange-50 text-orange-500 rounded-lg transition-all" title="Tekrar Dene">
                            <span class="material-symbols-outlined text-sm">replay</span>
                        </button>
                        <button onclick="deleteItem('${item.id}')" class="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-all" title="Sil">
                            <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        failedTbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500">Hata: ${error.message}</td></tr>`;
    }
}

async function retryItem(id) {
    if (!confirm('Bu kaydı tekrar senkronizasyon kuyruğuna almak istediğinize emin misiniz?')) return;
    try {
        const response = await fetch(`/api/retry-item/${id}`, { method: 'POST' });
        if (response.ok) {
            addLog('SİSTEM', 'BAŞARILI', `Kayıt (#${id}) tekrar kuyruğa alındı.`);
            await fetchFailedItems();
        }
    } catch (error) {
        alert('İşlem başarısız: ' + error.message);
    }
}

async function deleteItem(id) {
    if (!confirm('Bu kaydı kalıcı olarak silmek istediğinize emin misiniz?')) return;
    try {
        const response = await fetch(`/api/delete-item/${id}`, { method: 'POST' });
        if (response.ok) {
            addLog('SİSTEM', 'UYARI', `Kayıt (#${id}) kuyruktan silindi.`);
            await fetchFailedItems();
        }
    } catch (error) {
        alert('İşlem başarısız: ' + error.message);
    }
}

// Make them available globally for the onclick handlers
window.retryItem = retryItem;
window.deleteItem = deleteItem;

async function fetchErrorLogs() {
    try {
        errorLogContent.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-slate-300"><span class="material-symbols-outlined text-5xl mb-4 animate-spin">refresh</span><p class="font-bold tracking-widest uppercase text-xs">Veriler Yükleniyor...</p></div>';

        const response = await fetch('/api/errors');
        const text = await response.text();

        if (text.trim() && text !== 'Henüz hata kaydı yok.') {
            // Highlighting and formatting
            const highlighted = text
                .replace(/\[(.*?HATA.*?)\]/g, '<span class="text-red-600 font-bold">[$1]</span>')
                .replace(/\[stderr\]/g, '<span class="text-orange-500 font-bold">[stderr]</span>')
                .replace(/\[EXIT-ERROR\]/g, '<span class="bg-red-500 text-white px-1 rounded font-black">[KRİTİK HATA]</span>')
                .replace(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*?)\]/g, '<span class="text-slate-400">[$1]</span>');

            errorLogContent.innerHTML = highlighted;
            // Scroll to bottom
            errorLogContent.scrollTop = errorLogContent.scrollHeight;
        } else {
            errorLogContent.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-slate-300"><span class="material-symbols-outlined text-6xl mb-4">task_alt</span><p class="font-bold tracking-widest uppercase text-xs">Her Şey Yolunda. Hiç Hata Kaydı Yok.</p></div>';
        }
    } catch (error) {
        errorLogContent.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-red-400"><span class="material-symbols-outlined text-6xl mb-4">report_problem</span><p class="font-bold tracking-widest uppercase text-xs">Hata kayıtları yüklenemedi.</p></div>';
    }
}

async function loadCommands() {
    try {
        const response = await fetch('/api/commands');
        commands = await response.json();
        updateButtonStates();
    } catch (error) {
        console.error('Komutlar yüklenemedi:', error);
    }
}

async function triggerManualSync() {
    addLog('SİSTEM', 'BİLGİ', 'Manuel senkronizasyon isteği gönderiliyor...');
    try {
        const response = await fetch('http://localhost:3001/api/trigger-sync', { method: 'POST' });
        const data = await response.json();
        addLog('SİSTEM', data.success ? 'BAŞARILI' : 'UYARI', data.message);
    } catch (error) {
        addLog('SİSTEM', 'HATA', 'Senkronizasyon tetiklenemedi. Servis çalışıyor mu? (Port 3001)');
        console.error(error);
    }
}

// Initialize
init();
