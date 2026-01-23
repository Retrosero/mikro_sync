// Connect to Socket.io
const socket = io();

// DOM Elements
const logContainer = document.getElementById('log-container');
const clearLogsBtn = document.getElementById('clear-logs');
const statusText = document.getElementById('status-text');
const systemStatusDot = document.getElementById('system-status-dot');
const systemStatusText = document.getElementById('system-status-text');
const quickCommandsContainer = document.getElementById('quick-commands-container');
const otherCommandsContainer = document.getElementById('other-commands-container');

// Error Log Modal Elements
const viewErrorsBtn = document.getElementById('view-errors');
const errorModal = document.getElementById('error-modal');
const closeModalBtn = document.getElementById('close-modal');
const errorLogContent = document.getElementById('error-log-content');
const clearErrorFileBtn = document.getElementById('clear-error-file');

// Failed Items Modal Elements
const viewFailedBtn = document.getElementById('view-failed-items');
const failedModal = document.getElementById('failed-items-modal');
const closeFailedBtn = document.getElementById('close-failed-modal');
const failedTbody = document.getElementById('failed-items-tbody');

// Running commands tracker
const runningCommands = new Set();

// Initialize
async function init() {
    setupSocketListeners();
    await loadCommands();
}

// Load commands from API
async function loadCommands() {
    try {
        const response = await fetch('/api/commands');
        const commands = await response.json();
        renderCommands(commands);
    } catch (error) {
        addLog('SİSTEM', 'HATA', 'Komutlar yüklenemedi: ' + error.message);
    }
}

// Render commands to UI
function renderCommands(commands) {
    quickCommandsContainer.innerHTML = '';
    otherCommandsContainer.innerHTML = '';

    // Define priority items for Hızlı İşlemler
    const quickCommandIds = ['sync', 'sync-web-to-erp', 'entegra-sync', 'stock-xml'];

    commands.forEach(cmd => {
        const card = document.createElement('div');
        card.className = 'group cmd-card';
        card.id = `card-${cmd.id}`;

        let workerDotHtml = '';
        if (cmd.id === 'sync-queue-worker') {
            workerDotHtml = `
                <div class="absolute top-4 right-4">
                    <span class="flex h-1.5 w-1.5">
                        <span id="worker-pulse" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75 hidden"></span>
                        <span id="worker-dot" class="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-300"></span>
                    </span>
                </div>
            `;
        }

        const lastRunTime = cmd.last_run ? new Date(cmd.last_run).toLocaleString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
        }) : 'Hiç çalışmadı';

        const lastStatusColor = cmd.last_status === 'SUCCESS' ? 'text-status-success' : 'text-status-error';

        card.innerHTML = `
            ${workerDotHtml}
            <div class="icon-box">
                <span class="material-symbols-outlined text-2xl font-light">${cmd.icon}</span>
            </div>
            <h3 class="text-[11px] font-bold text-slate-800 mb-1 truncate w-full px-1">${cmd.name}</h3>
            <p class="text-[8px] text-slate-400 mb-3 leading-tight line-clamp-1 px-1">${cmd.description}</p>
            
            <div class="mb-3 flex flex-col items-center gap-0.5">
                <span class="text-[7px] text-slate-400 font-bold uppercase tracking-tighter">SON SENKRONİZASYON</span>
                <span class="text-[9px] font-mono font-bold ${lastStatusColor}">${lastRunTime}</span>
            </div>

            <button id="btn-${cmd.id}" class="command-btn w-full py-2 px-3 bg-slate-900 text-white rounded-lg font-bold text-[9px] hover:bg-primary transition-all duration-300 flex items-center justify-center gap-2 mt-auto">
                <span class="material-symbols-outlined text-sm">play_arrow</span>
                BAŞLAT
            </button>
        `;

        const btn = card.querySelector('button');
        btn.addEventListener('click', () => {
            if (runningCommands.has(cmd.id)) {
                addLog('SİSTEM', 'UYARI', `${cmd.name} zaten çalışıyor!`);
                return;
            }
            executeCommand(cmd.id);
        });

        if (quickCommandIds.includes(cmd.id)) {
            quickCommandsContainer.appendChild(card);
        } else {
            otherCommandsContainer.appendChild(card);
        }
    });
}

// Execute command
function executeCommand(commandId) {
    runningCommands.add(commandId);
    updateButtonStates();
    socket.emit('execute-command', commandId);

    // special handling for worker dot
    if (commandId === 'sync-queue-worker') {
        const pulse = document.getElementById('worker-pulse');
        const dot = document.getElementById('worker-dot');
        if (pulse) pulse.classList.remove('hidden');
        if (dot) {
            dot.classList.remove('bg-slate-300');
            dot.classList.add('bg-status-success');
        }
    }
}

// Update UI states
function updateButtonStates() {
    runningCommands.forEach(id => {
        const btn = document.getElementById(`btn-${id}`);
        if (btn) {
            btn.classList.add('btn-running');
            btn.disabled = true;
            btn.innerHTML = `<span class="material-symbols-outlined text-base animate-spin">sync</span> ÇALIŞIYOR...`;
        }
    });

    // Reset buttons that are no longer running
    const allButtons = document.querySelectorAll('.command-btn');
    allButtons.forEach(btn => {
        const id = btn.id.replace('btn-', '');
        if (!runningCommands.has(id)) {
            btn.classList.remove('btn-running');
            btn.disabled = false;
            btn.innerHTML = `<span class="material-symbols-outlined text-base">play_arrow</span> BAŞLAT`;
        }
    });
}

// Setup socket listeners
function setupSocketListeners() {
    socket.on('connect', () => {
        setConnectionStatus(true);
        addLog('SİSTEM', 'BİLGİ', 'Sunucuya bağlanıldı.');
    });

    socket.on('disconnect', () => {
        setConnectionStatus(false);
        addLog('SİSTEM', 'HATA', 'Bağlantı kesildi!');
    });

    socket.on('log', (data) => {
        let source = 'PROCESS';
        let type = 'BİLGİ';
        let message = data.message;

        if (data.type === 'error') type = 'HATA';
        if (data.type === 'warning') type = 'UYARI';
        if (data.type === 'success') type = 'BAŞARILI';

        message = message.replace(/\u001b\[[0-9;]*m/g, '');
        if (message.trim()) addLog(source, type, message);
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
        loadCommands();
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

// Initialize
init();
