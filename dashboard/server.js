const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { spawn } = require('child_process');
const path = require('path');
const open = require('open');
const fs = require('fs');
const pgService = require('../services/postgresql.service');
const productNormalizer = require('../services/product-name-normalizer.service');

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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Define available commands
const commands = [
  {
    id: 'continuous-sync',
    name: 'Sürekli Senkronizasyon',
    command: 'node',
    args: ['index.js'],
    description: 'Sistem arka planda sürekli çalışır ve anlık veri senkronizasyonu sağlar.',
    icon: 'refresh-cw'
  },
  {
    id: 'erp-to-web',
    name: 'ERP → Web',
    command: 'npm',
    args: ['run', 'sync'],
    description: 'Mikro verilerini (Stok, Fiyat, vb.) web sitesine tek yönlü aktarır.',
    icon: 'upload-cloud'
  },
  {
    id: 'web-to-erp',
    name: 'Web → ERP',
    command: 'node',
    args: ['web-to-erp-sync.js', 'sync'],
    description: 'Web siparişlerini ve müşteri carilerini Mikro sistemine aktarır.',
    icon: 'download-cloud'
  },
  {
    id: 'entegra-sync',
    name: 'Entegra Senkronizasyonu',
    command: 'node',
    args: ['scripts/entegra-sync.js'],
    description: 'Entegra ile ürün ve stok verilerini eşitler.',
    icon: 'waypoints'
  },
  {
    id: 'stock-xml',
    name: 'Stok XML Oluştur',
    command: 'npm',
    args: ['run', 'stock-xml'],
    description: 'Bayiler için güncel stok XML dosyasını oluşturur.',
    icon: 'file-spreadsheet'
  }
];

// Helper to start a command programmatically
function startCommand(commandId, socket = null) {
  const command = commands.find(cmd => cmd.id === commandId);
  if (!command || runningProcesses.has(commandId)) return;

  console.log(`🚀 ${command.name} başlatılıyor...`);

  const process = spawn(command.command, command.args, {
    cwd: path.join(__dirname, '..'),
    shell: true
  });

  runningProcesses.set(commandId, process);

  process.stdout.on('data', (data) => {
    const msg = data.toString();
    if (socket) socket.emit('log', { type: 'stdout', message: msg, commandId });
    if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('hata')) {
      writeToErrorLog(commandId, 'stdout-error', msg);
    }
  });

  process.stderr.on('data', (data) => {
    const msg = data.toString();
    if (socket) socket.emit('log', { type: 'stderr', message: msg, commandId });
    writeToErrorLog(commandId, 'stderr', msg);
  });

  process.on('close', (code) => {
    runningProcesses.delete(commandId);
    const status = code === 0 ? 'SUCCESS' : 'FAILED';
    saveLastRun(commandId, status);
    if (socket) {
      if (code === 0) {
        socket.emit('log', { type: 'success', message: `\n✅ ${command.name} başarıyla tamamlandı!\n` });
      } else {
        socket.emit('log', { type: 'error', message: `\n❌ ${command.name} hata ile sonlandı (kod: ${code})\n` });
      }
      socket.emit('command-finished', { commandId, code });
    }
    console.log(`⏹️ ${command.name} durduruldu (Kod: ${code})`);
  });

  return process;
}

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

// Yeni: JSON formatında log arama ve filtreleme API
app.get('/api/logs', async (req, res) => {
  try {
    const {
      level,
      context,
      search,
      limit = 100,
      offset = 0,
      date
    } = req.query;

    const logsDir = path.join(__dirname, '..', 'logs');
    const logs = [];

    // Belirli bir tarih için log dosyasını oku
    let targetFiles = [];
    if (date) {
      const dateFile = path.join(logsDir, `combined-${date}.log`);
      if (fs.existsSync(dateFile)) {
        targetFiles = [dateFile];
      }
    } else {
      // Son 7 günün dosyalarını oku
      const files = fs.readdirSync(logsDir);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      for (const file of files) {
        if (!file.endsWith('.log')) continue;
        if (file === 'errors.log') continue; // errors.log ayrı

        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime >= sevenDaysAgo) {
          targetFiles.push(filePath);
        }
      }
    }

    // Dosyaları oku ve filtrele
    for (const file of targetFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const log = JSON.parse(line);

            // Filtreleme
            if (level && log.level !== level) continue;
            if (context && log.context !== context) continue;
            if (search && !log.message?.toLowerCase().includes(search.toLowerCase())) continue;

            logs.push(log);
          } catch (e) {
            // JSON parse edilemeyen satırları atla
          }
        }
      } catch (e) {
        // Dosya okuma hatası
      }
    }

    // Zamana göre sırala (en yeni önce)
    logs.sort((a, b) => new Date(b.isoTimestamp || b.timestamp) - new Date(a.isoTimestamp || a.timestamp));

    // Limit ve offset uygula
    const paginatedLogs = logs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      logs: paginatedLogs,
      total: logs.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Log istatistikleri
app.get('/api/logs/stats', async (req, res) => {
  try {
    const logsDir = path.join(__dirname, '..', 'logs');
    const stats = {
      total: 0,
      errors: 0,
      warnings: 0,
      info: 0,
      byContext: {},
      byHour: new Array(24).fill(0),
      last24Hours: {
        total: 0,
        errors: 0,
        warnings: 0,
        info: 0
      }
    };

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const files = fs.readdirSync(logsDir);

    for (const file of files) {
      if (!file.endsWith('.log')) continue;

      const filePath = path.join(logsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const log = JSON.parse(line);
          stats.total++;

          if (log.level === 'error') stats.errors++;
          if (log.level === 'warn') stats.warnings++;
          if (log.level === 'info') stats.info++;

          if (log.context) {
            stats.byContext[log.context] = (stats.byContext[log.context] || 0) + 1;
          }

          if (log.timestamp) {
            const hour = new Date(log.timestamp).getHours();
            stats.byHour[hour]++;

            // Son 24 saat
            const logTime = new Date(log.timestamp);
            if (logTime >= twentyFourHoursAgo) {
              stats.last24Hours.total++;
              if (log.level === 'error') stats.last24Hours.errors++;
              if (log.level === 'warn') stats.last24Hours.warnings++;
              if (log.level === 'info') stats.last24Hours.info++;
            }
          }
        } catch (e) {
          // JSON parse hatası
        }
      }
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logları JSON formatında indir
app.get('/api/logs/export', async (req, res) => {
  try {
    const { format = 'json', date } = req.query;
    const logsDir = path.join(__dirname, '..', 'logs');

    let targetFiles = [];
    if (date) {
      const dateFile = path.join(logsDir, `combined-${date}.log`);
      if (fs.existsSync(dateFile)) {
        targetFiles = [dateFile];
      }
    } else {
      // Bugünün dosyasını al
      const today = new Date().toISOString().split('T')[0];
      const todayFile = path.join(logsDir, `combined-${today}.log`);
      if (fs.existsSync(todayFile)) {
        targetFiles = [todayFile];
      }
    }

    const logs = [];
    for (const file of targetFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const log = JSON.parse(line);
            logs.push(log);
          } catch (e) {
            // JSON parse edilemeyen satırları atla
          }
        }
      } catch (e) {
        // Dosya okuma hatası
      }
    }

    // Zamana göre sırala
    logs.sort((a, b) => new Date(b.isoTimestamp || b.timestamp) - new Date(a.isoTimestamp || a.timestamp));

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="logs-${date || new Date().toISOString().split('T')[0]}.json"`);
      res.json(logs);
    } else if (format === 'csv') {
      const headers = ['logId', 'timestamp', 'level', 'service', 'context', 'message'];
      const csvRows = [headers.join(',')];

      for (const log of logs) {
        const row = headers.map(h => {
          const value = log[h] !== undefined ? log[h] : '';
          const strValue = String(value).replace(/"/g, '""');
          return `"${strValue}"`;
        });
        csvRows.push(row.join(','));
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="logs-${date || new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvRows.join('\n'));
    } else {
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="logs-${date || new Date().toISOString().split('T')[0]}.txt"`);
      res.send(logs.map(log =>
        `[${log.timestamp}] [${log.level}] [${log.service}] [${log.context || 'N/A'}]: ${log.message}`
      ).join('\n'));
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Hata loglarını JSON formatında al
app.get('/api/errors/json', async (req, res) => {
  try {
    const logsDir = path.join(__dirname, '..', 'logs');
    const errorsFile = path.join(logsDir, 'errors.log');

    if (!fs.existsSync(errorsFile)) {
      return res.json([]);
    }

    const content = fs.readFileSync(errorsFile, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    const errors = [];

    for (const line of lines) {
      try {
        const log = JSON.parse(line);
        errors.push(log);
      } catch (e) {
        // JSON parse edilemeyen satırları atla
      }
    }

    // Zamana göre sırala (en yeni önce)
    errors.sort((a, b) => new Date(b.isoTimestamp || b.timestamp) - new Date(a.isoTimestamp || a.timestamp));

    res.json(errors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

// Product Name Normalizer Endpoints
app.get('/api/products/review', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10000;
    const offset = parseInt(req.query.offset) || 0;
    const search = req.query.search || '';

    let products;
    if (search) {
      products = await productNormalizer.searchProducts(search, limit, offset);
    } else {
      products = await productNormalizer.getAllProductsForReview(limit, offset);
    }

    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/stats', async (req, res) => {
  try {
    const stats = await productNormalizer.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products/update', async (req, res) => {
  try {
    const updates = req.body.updates;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({ error: 'Geçersiz güncelleme verisi' });
    }

    const results = await productNormalizer.updateProductNames(updates);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Store running processes
const runningProcesses = new Map();

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected');

  // Send currently running commands to the new client
  socket.emit('initial-state', Array.from(runningProcesses.keys()));

  socket.on('execute-command', (commandId) => {
    startCommand(commandId, socket);
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
      // Client'a durdurulduğunu bildir ki buton durumu güncellensin
      socket.emit('command-stopped', { commandId });
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

    // Auto-start continuous sync
    try {
      startCommand('continuous-sync');
    } catch (err) {
      console.error('⚠️ Otomatik başlatma hatası:', err.message);
    }

    // Open browser
    try {
      await open(`http://localhost:${PORT}`);
    } catch (error) {
      console.log('⚠️ Tarayıcı otomatik açılamadı. Lütfen manuel olarak açın.');
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
