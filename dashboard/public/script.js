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

// Defined Menu Structure
const menuCategories = [
    {
        title: 'SİSTEM KONTROL',
        color: 'bg-indigo-600',
        items: [
            { name: 'Manuel Senkronizasyon', icon: 'sync_lock', badge: 'YENİ' }
        ]
    },
    {
        title: 'SATIŞ & İŞLEMLER',
        color: 'bg-blue-500',
        items: [
            { name: 'Satış', icon: 'point_of_sale' },
            { name: 'Hızlı Satış', icon: 'shopping_cart_checkout' },
            { name: 'Alış', icon: 'input' },
            { name: 'Faturalar', icon: 'receipt_long' },
            { name: 'Katalog', icon: 'menu_book' },
            { name: 'PDF Kataloglar', icon: 'picture_as_pdf' },
            { name: 'Teklif', icon: 'request_quote' }
        ]
    },
    {
        title: 'E-TİCARET',
        color: 'bg-purple-500',
        items: [
            { name: 'E-Ticaret', icon: 'shopping_bag' },
            { name: 'Sipariş Toplama', icon: 'playlist_add_check', badge: '1' },
            { name: 'Sipariş Onay', icon: 'thumb_up' },
            { name: 'Toplama Listesi', icon: 'checklist', badge: '1' },
            { name: 'Kargo Çıktısı', icon: 'local_shipping' },
            { name: 'Ürünler', icon: 'inventory_2', badge: '24' },
            { name: 'Müşteri Mesajları', icon: 'forum', badge: '1' },
            { name: 'Depo Mesajları', icon: 'warehouse' }
        ]
    },
    {
        title: 'STOK & DEPO',
        color: 'bg-orange-500',
        items: [
            { name: 'Stok', icon: 'inventory' },
            { name: 'Stok Takip', icon: 'analytics' },
            { name: 'Sayım', icon: '123' },
            { name: 'İade', icon: 'assignment_return', badge: '99+' },
            { name: 'Ürün Güncelle', icon: 'unarchive' },
            { name: 'Barkod', icon: 'qr_code_scanner' },
            { name: 'Renk Ayarları', icon: 'palette' },
            { name: 'Siparişler', icon: 'list_alt' },
            { name: 'Katalog Yönetimi', icon: 'library_books' }
        ]
    },
    {
        title: 'FİNANS',
        color: 'bg-teal-500',
        items: [
            { name: 'Cari', icon: 'account_balance_wallet' },
            { name: 'Tahsilat', icon: 'payments' },
            { name: 'Gün Sonu', icon: 'summarize' },
            { name: 'Kasa', icon: 'money' },
            { name: 'Giderler', icon: 'trending_down' },
            { name: 'Evrak Takip', icon: 'description' },
            { name: 'Sipariş Analiz', icon: 'monitoring' }
        ]
    }
];

// Initialize
async function init() {
    setupSocketListeners();
    renderDashboard();
    setupCamera();

    // Load system commands silently (maybe for background or hidden usage)
    // await loadCommands(); 
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
        gridHtml.className = 'grid grid-cols-2 lg:grid-cols-3 gap-3';

        category.items.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'group relative flex flex-col items-center justify-center p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 h-24';

            // Badge
            let badgeHtml = '';
            if (item.badge) {
                badgeHtml = `<span class="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm ring-2 ring-white z-10 animate-in zoom-in">${item.badge}</span>`;
            }

            btn.innerHTML = `
                ${badgeHtml}
                <div class="mb-2 p-2 bg-slate-50 text-slate-600 rounded-xl group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                    <span class="material-symbols-outlined text-xl">${item.icon}</span>
                </div>
                <span class="text-[10px] font-bold text-slate-700 text-center leading-tight group-hover:text-primary transition-colors line-clamp-2">${item.name}</span>
            `;

            btn.addEventListener('click', () => {
                handleMenuClick(item.name);
            });

            gridHtml.appendChild(btn);
        });

        categoryDiv.innerHTML = headerHtml;
        categoryDiv.appendChild(gridHtml);
        dashboardMenuContainer.appendChild(categoryDiv);
    });
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

// Keep updateButtonStates as no-op or modify if we re-introduce system commands
function updateButtonStates() {
    // No-op for now unless we add system command buttons back
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
