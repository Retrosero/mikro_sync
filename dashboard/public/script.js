// Connect to Socket.io
const socket = io();

// DOM Elements
const logContainer = document.getElementById('log-container');
const clearLogsBtn = document.getElementById('clear-logs');
const statusText = document.getElementById('status-text');
const systemStatusDot = document.getElementById('system-status-dot');
const systemStatusText = document.getElementById('system-status-text');
const commandsContainer = document.getElementById('commands-container');

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
    commandsContainer.innerHTML = '';

    commands.forEach(cmd => {
        const card = document.createElement('div');
        card.className = 'group cmd-card';
        card.id = `card-${cmd.id}`;

        let workerDotHtml = '';
        if (cmd.id === 'sync-queue-worker') {
            workerDotHtml = `
                <div class="absolute top-6 right-8">
                    <span class="flex h-2 w-2">
                        <span id="worker-pulse" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75 hidden"></span>
                        <span id="worker-dot" class="relative inline-flex rounded-full h-2 w-2 bg-slate-300"></span>
                    </span>
                </div>
            `;
        }

        card.innerHTML = `
            ${workerDotHtml}
            <div class="icon-box">
                <span class="material-symbols-outlined text-3xl font-light">${cmd.icon}</span>
            </div>
            <h3 class="text-[12px] font-bold text-slate-800 mb-2 truncate w-full px-2">${cmd.name}</h3>
            <p class="text-[10px] text-slate-400 mb-6 leading-[1.4] line-clamp-2 px-3 min-h-[2.5rem]">${cmd.description}</p>
            <button id="btn-${cmd.id}" class="command-btn w-full py-3 px-4 bg-slate-900 text-white rounded-xl font-bold text-[10px] hover:bg-primary transition-all duration-300 flex items-center justify-center gap-2 mt-auto">
                <span class="material-symbols-outlined text-base">play_arrow</span>
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

        commandsContainer.appendChild(card);
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

// Clear
clearLogsBtn.addEventListener('click', () => {
    logContainer.innerHTML = '';
});

init();
