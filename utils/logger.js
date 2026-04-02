const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Logs klasörünü oluştur
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Günlük log dosyası için tarih formatı
const getDailyFilename = (type) => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(logsDir, `${type}-${dateStr}.log`);
};

// Benzersiz log ID oluştur
const generateLogId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// JSON formatı - Detaylı ve yapılandırılmış
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format((info) => {
    // Her log için benzersiz ID ekle
    info.logId = generateLogId();

    // Process bilgisi ekle
    info.pid = process.pid;

    // ISO timestamp ekle (programatik erişim için)
    info.isoTimestamp = new Date().toISOString();

    return info;
  })(),
  winston.format.json()
);

// Konsol için renkli ve okunabilir format
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, service, context, ...meta }) => {
    let log = `${timestamp} [${level}]`;

    if (service) {
      log += ` [${service}]`;
    }

    if (context) {
      log += ` [${context}]`;
    }

    log += `: ${message}`;

    // Önemli meta bilgileri göster
    const importantKeys = ['recordId', 'table', 'operation', 'duration', 'error', 'entity_id', 'entity_type'];
    const importantMeta = {};
    importantKeys.forEach(key => {
      if (meta[key]) importantMeta[key] = meta[key];
    });

    if (Object.keys(importantMeta).length > 0) {
      log += ` ${JSON.stringify(importantMeta)}`;
    }

    return log;
  })
);

// Günlük dosya rotation için custom transport
class DailyRotateTransport extends winston.transports.File {
  constructor(options = {}) {
    const dailyOptions = {
      ...options,
      filename: getDailyFilename(options.logType || 'app'),
      maxsize: 10485760, // 10MB
      maxFiles: 30, // 30 gün sakla
    };
    super(dailyOptions);

    // Her gün yeni dosya oluşturmak için interval
    this.rotationInterval = setInterval(() => {
      this.close();
      this.filename = getDailyFilename(options.logType || 'app');
      this.open();
    }, 24 * 60 * 60 * 1000); // 24 saat

    this.rotationInterval.unref(); // Process exit'te engelleme
  }
}

// Ana logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'erp-web-sync' },
  transports: [
    // Hata logları - Günlük dosya + Tüm hatalar ayrı dosya
    new DailyRotateTransport({
      logType: 'error',
      level: 'error',
      format: jsonFormat
    }),

    // Tüm hatalar için tek dosya (son 10MB)
    new winston.transports.File({
      filename: path.join(logsDir, 'errors.log'),
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5,
      format: jsonFormat
    }),

    // Senkronizasyon logları - Günlük dosya
    new DailyRotateTransport({
      logType: 'sync',
      level: 'info',
      format: winston.format.combine(
        winston.format((info) => {
          return (info.context && info.context.includes('sync')) ? info : false;
        })(),
        jsonFormat
      )
    }),

    // Performans logları - Günlük dosya
    new DailyRotateTransport({
      logType: 'performance',
      level: 'info',
      format: winston.format.combine(
        winston.format((info) => {
          return info.context === 'performance' ? info : false;
        })(),
        jsonFormat
      )
    }),

    // Tüm loglar - Günlük dosya (kombinasyon)
    new DailyRotateTransport({
      logType: 'combined',
      format: jsonFormat
    }),

    // Konsol çıktısı
    new winston.transports.Console({
      format: consoleFormat
    })
  ]
});

// Gelişmiş log fonksiyonları
logger.syncStart = (table, recordId, operation) => {
  logger.info('Senkronizasyon başladı', {
    context: 'sync-start',
    table,
    recordId,
    operation,
    timestamp: new Date().toISOString()
  });
};

logger.syncSuccess = (table, recordId, operation, duration, additionalInfo = {}) => {
  logger.info('Senkronizasyon başarılı', {
    context: 'sync-success',
    table,
    recordId,
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...additionalInfo
  });
};

logger.syncError = (table, recordId, operation, error, additionalInfo = {}) => {
  logger.error('Senkronizasyon hatası', {
    context: 'sync-error',
    table,
    recordId,
    operation,
    error: error.message,
    errorCode: error.code,
    errorStack: error.stack,
    ...additionalInfo,
    timestamp: new Date().toISOString()
  });
};

logger.dbConnection = (dbType, status, error = null) => {
  if (status === 'success') {
    logger.info(`${dbType} bağlantısı başarılı`, {
      context: 'db-connection',
      dbType,
      status
    });
  } else {
    logger.error(`${dbType} bağlantı hatası`, {
      context: 'db-connection',
      dbType,
      status,
      error: error?.message,
      errorStack: error?.stack
    });
  }
};

logger.mappingError = (mappingType, id, additionalInfo = {}) => {
  logger.error('Mapping bulunamadı', {
    context: 'mapping-error',
    mappingType,
    id,
    ...additionalInfo,
    suggestion: `Lütfen int_kodmap_${mappingType} tablosunu kontrol edin`
  });
};

logger.queueStatus = (pending, processing, completed, failed) => {
  logger.info('Queue durumu', {
    context: 'queue-status',
    pending,
    processing,
    completed,
    failed,
    total: pending + processing + completed + failed
  });
};

logger.performance = (operation, duration, details = {}) => {
  const level = duration > 5000 ? 'warn' : 'info';
  logger[level]('Performans metriği', {
    context: 'performance',
    operation,
    duration: `${duration}ms`,
    ...details
  });
};

// Startup banner
logger.startup = () => {
  console.log('\n' + '='.repeat(70));
  console.log('  ERP-Web Senkronizasyon Sistemi');
  console.log('  Versiyon: 1.0.0');
  console.log('  Node: ' + process.version);
  console.log('  Platform: ' + process.platform);
  console.log('='.repeat(70) + '\n');
};

// Log arama ve filtreleme için API fonksiyonu
logger.searchLogs = async (options = {}) => {
  const {
    level,
    context,
    startDate,
    endDate,
    search,
    limit = 100,
    offset = 0
  } = options;

  const logs = [];
  const logFiles = [];

  // Tarih aralığına göre dosyaları bul
  const files = fs.readdirSync(logsDir);
  for (const file of files) {
    if (!file.endsWith('.log')) continue;

    const filePath = path.join(logsDir, file);
    const stats = fs.statSync(filePath);

    // Sadece son 7 günün dosyalarını oku
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    if (stats.mtime < sevenDaysAgo) continue;

    logFiles.push(filePath);
  }

  // Dosyaları oku ve filtrele
  for (const file of logFiles) {
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

          if (startDate && log.isoTimestamp < startDate) continue;
          if (endDate && log.isoTimestamp > endDate) continue;

          logs.push(log);
        } catch (e) {
          // JSON parse edilemeyen satırları atla
        }
      }
    } catch (e) {
      // Dosya okuma hatası
    }
  }

  // Sırala ve limit uygula
  logs.sort((a, b) => new Date(b.isoTimestamp) - new Date(a.isoTimestamp));

  return {
    logs: logs.slice(offset, offset + limit),
    total: logs.length,
    limit,
    offset
  };
};

// Log istatistikleri
logger.getStats = () => {
  const stats = {
    total: 0,
    errors: 0,
    warnings: 0,
    info: 0,
    byContext: {},
    byHour: new Array(24).fill(0)
  };

  try {
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
          }
        } catch (e) {
          // JSON parse hatası
        }
      }
    }
  } catch (e) {
    // Dosya okuma hatası
  }

  return stats;
};

module.exports = logger;