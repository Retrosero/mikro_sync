const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { spawn } = require('child_process');
const path = require('path');
const open = require('open');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3456;

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
    id: 'sync-web-to-erp',
    name: 'Web to Mikro',
    command: 'npm',
    args: ['run', 'sync-web-to-erp'],
    description: 'Web verilerini ERP\'ye aktarır',
    icon: 'terminal'
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
    id: 'sync-invoice-settings',
    name: 'Fatura Ayarları',
    command: 'npm',
    args: ['run', 'sync-invoice-settings'],
    description: 'Fatura ayarlarını senkronize eder',
    icon: 'receipt'
  }
];

// API endpoint to get commands
app.get('/api/commands', (req, res) => {
  res.json(commands);
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

    // Check if already running
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
      socket.emit('log', {
        type: 'stdout',
        message: data.toString()
      });
    });

    process.stderr.on('data', (data) => {
      socket.emit('log', {
        type: 'stderr',
        message: data.toString()
      });
    });

    process.on('close', (code) => {
      runningProcesses.delete(commandId);

      if (code === 0) {
        socket.emit('log', {
          type: 'success',
          message: `\n✅ ${command.name} başarıyla tamamlandı!\n`
        });
      } else {
        socket.emit('log', {
          type: 'error',
          message: `\n❌ ${command.name} hata ile sonlandı (kod: ${code})\n`
        });
      }

      socket.emit('command-finished', { commandId, code });
    });

    process.on('error', (error) => {
      runningProcesses.delete(commandId);
      socket.emit('log', {
        type: 'error',
        message: `\n❌ Hata: ${error.message}\n`
      });
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
server.listen(PORT, async () => {
  console.log(`\n🎉 Dashboard sunucusu başlatıldı!`);
  console.log(`📍 Adres: http://localhost:${PORT}`);
  console.log(`\n🌐 Tarayıcı otomatik açılıyor...\n`);

  // Open browser automatically
  try {
    await open(`http://localhost:${PORT}`);
  } catch (error) {
    console.log('Tarayıcı otomatik açılamadı. Lütfen manuel olarak açın.');
  }
});
