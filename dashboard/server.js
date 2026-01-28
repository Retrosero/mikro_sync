const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { spawn } = require('child_process');
const path = require('path');
const open = require('open');
const fs = require('fs');
const pgService = require('../services/postgresql.service');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3456;
const LOGS_DIR = path.join(__dirname, 'logs');
const ERROR_LOG_FILE = path.join(LOGS_DIR, 'errors.log');
const LAST_RUNS_FILE = path.join(LOGS_DIR, 'last_runs.json');

// Create logs directory if it doesn't exist
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR);
}

function writeToErrorLog(commandId, type, message) {
  const timestamp = new Date().toISOString();
  const cleanMessage = message.replace(/\u001b\[[0-9;]*m/g, ''); // Remove ANSI colors
  const logEntry = `[${timestamp}] [${commandId}] [${type}] ${cleanMessage}\n`;
  try {
    fs.appendFileSync(ERROR_LOG_FILE, logEntry);
  } catch (err) {
    console.error('Hata loguna yazılamadı:', err);
  }
}

function getLastRuns() {
  if (fs.existsSync(LAST_RUNS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(LAST_RUNS_FILE, 'utf8'));
    } catch (err) {
      console.error('Son çalışma zamanları okunamadı:', err);
      return {};
    }
  }
  return {};
}

function saveLastRun(id, status) {
  const lastRuns = getLastRuns();
  lastRuns[id] = {
    last_run: new Date().toISOString(),
    status: status
  };
  try {
    fs.writeFileSync(LAST_RUNS_FILE, JSON.stringify(lastRuns, null, 2));
  } catch (err) {
    console.error('Son çalışma zamanı kaydedilemedi:', err);
  }
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Define available commands
const commands = [
  {
    id: 'sync',
    name: 'Mikro to Web',
    command: 'npm',
    args: ['run', 'sync'],
    description: 'ERP verilerini Web\'e aktarır',
    icon: 'trending_flat'
  },
  {
    id: 'sync-web-to-erp',
    name: 'Web to Mikro',
    command: 'npm',
    args: ['run', 'sync-web-to-erp'],
    description: 'Web verilerini ERP\'ye aktarır',
    icon: 'terminal'
  },
  {
    id: 'entegra-sync',
    name: 'Entegra to Web',
    command: 'node',
    args: ['scripts/entegra-sync.js'],
    description: 'Entegra entegrasyonu',
    icon: 'link'
  },
  {
    id: 'stock-xml',
    name: 'Stok XML Oluştur',
    command: 'npm',
    args: ['run', 'stock-xml'],
    description: 'Stok XML dosyası oluşturur',
    icon: 'description'
  },
  {
    id: 'sync-bidirectional',
    name: 'Mikro ↔ Web',
    command: 'npm',
    args: ['run', 'sync-bidirectional'],
    description: 'ERP ↔ Web çift yönlü senkronizasyon',
    icon: 'sync'
  },
  {
    id: 'sync-queue-worker',
    name: 'Web to Mikro Sürekli Çalış',
    command: 'npm',
    args: ['run', 'sync-queue-worker'],
    description: 'Web\'den ERP\'ye sürekli senkronizasyon',
    icon: 'engineering'
  },
  {
    id: 'setup-web-to-erp-triggers',
    name: 'Trigger\'ları Kur/Güncelle',
    command: 'npm',
    args: ['run', 'setup-web-to-erp-triggers'],
    description: 'Web to ERP trigger\'larını günceller',
    icon: 'bolt'
  },
  {
    id: 'sync-invoice-settings',
    name: 'Fatura Ayarları',
    command: 'npm',
    args: ['run', 'sync-invoice-settings'],
    description: 'Fatura ayarlarını senkronize eder',
    icon: 'receipt'
  }
];

// API endpoints
app.get('/api/commands', async (req, res) => {
  try {
    const lastRuns = getLastRuns();
    const enrichedCommands = commands.map(cmd => {
      const lastRun = lastRuns[cmd.id];
      return {
        ...cmd,
        last_run: lastRun ? lastRun.last_run : null,
        last_status: lastRun ? lastRun.status : null
      };
    });
    res.json(enrichedCommands);
  } catch (error) {
    res.json(commands);
  }
});

app.get('/api/errors', (req, res) => {
  if (fs.existsSync(ERROR_LOG_FILE)) {
    const data = fs.readFileSync(ERROR_LOG_FILE, 'utf8');
    res.send(data);
  } else {
    res.send('Henüz hata kaydı yok.');
  }
});

app.get('/api/errors/clear', (req, res) => {
  if (fs.existsSync(ERROR_LOG_FILE)) {
    fs.writeFileSync(ERROR_LOG_FILE, '');
  }
  res.json({ success: true });
});

// Sync Queue Failed Items Endpoints
app.get('/api/failed-items', async (req, res) => {
  try {
    const failedItems = await pgService.query(`
      SELECT id, entity_type, entity_id, operation, retry_count, error_message, created_at, processed_at
      FROM sync_queue
      WHERE status = 'failed'
      ORDER BY processed_at DESC
      LIMIT 100
    `);
    res.json(failedItems);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/retry-item/:id', async (req, res) => {
  try {
    await pgService.query(
      `UPDATE sync_queue SET status = 'pending', retry_count = 0 WHERE id = $1`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/delete-item/:id', async (req, res) => {
  try {
    await pgService.query(
      `DELETE FROM sync_queue WHERE id = $1`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Store running processes
const runningProcesses = new Map();

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('execute-command', (commandId) => {
    const command = commands.find(cmd => cmd.id === commandId);

    if (!command) {
      socket.emit('error', { message: 'Komut bulunamadı' });
      return;
    }

    if (runningProcesses.has(commandId)) {
      socket.emit('log', {
        type: 'warning',
        message: `⚠️ ${command.name} zaten çalışıyor!\n`
      });
      return;
    }

    socket.emit('log', {
      type: 'info',
      message: `\n🚀 ${command.name} başlatılıyor...\n`
    });

    const process = spawn(command.command, command.args, {
      cwd: path.join(__dirname, '..'),
      shell: true
    });

    runningProcesses.set(commandId, process);

    process.stdout.on('data', (data) => {
      const msg = data.toString();
      socket.emit('log', { type: 'stdout', message: msg });
      if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('hata')) {
        writeToErrorLog(commandId, 'stdout-error', msg);
      }
    });

    process.stderr.on('data', (data) => {
      const msg = data.toString();
      socket.emit('log', { type: 'stderr', message: msg });
      writeToErrorLog(commandId, 'stderr', msg);
    });

    process.on('close', async (code) => {
      runningProcesses.delete(commandId);

      const status = code === 0 ? 'SUCCESS' : 'FAILED';
      saveLastRun(commandId, status);

      if (code === 0) {
        socket.emit('log', {
          type: 'success',
          message: `\n✅ ${command.name} başarıyla tamamlandı!\n`
        });
      } else {
        const errMsg = `\n❌ ${command.name} hata ile sonlandı (kod: ${code})\n`;
        socket.emit('log', { type: 'error', message: errMsg });
        writeToErrorLog(commandId, 'EXIT-ERROR', errMsg);
      }
      socket.emit('command-finished', { commandId, code });
    });

    process.on('error', (error) => {
      runningProcesses.delete(commandId);
      const errMsg = `\n❌ Hata: ${error.message}\n`;
      socket.emit('log', { type: 'error', message: errMsg });
      writeToErrorLog(commandId, 'PROCESS-ERROR', errMsg);
      socket.emit('command-finished', { commandId, code: -1 });
    });
  });

  socket.on('stop-command', (commandId) => {
    const process = runningProcesses.get(commandId);
    if (process) {
      process.kill();
      runningProcesses.delete(commandId);
      socket.emit('log', {
        type: 'warning',
        message: `\n⏹️ ${commandId} durduruldu\n`
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Start server
if (require.main === module) {
  server.listen(PORT, async () => {
    console.log(`\n🎉 Dashboard sunucusu başlatıldı!`);
    console.log(`📍 Adres: http://localhost:${PORT}`);
    console.log(`\n🌐 Tarayıcı otomatik açılıyor...\n`);

    try {
      await open(`http://localhost:${PORT}`);
    } catch (error) {
      console.log('Tarayıcı otomatik açılamadı. Lütfen manuel olarak açın.');
    }
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n⚠️  Port ${PORT} zaten kullanımda! Dashboard başlatılamadı.`);
      console.error('Büyük ihtimalle başka bir mikro_sync servisi zaten çalışıyor. Dashboard erişimi için mevcut servisi kullanın.\n');
    } else {
      console.error('\n❌ Sunucu başlatma hatası:', err);
    }
  });
}

module.exports = app;
