const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Logs klasörünü oluştur
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Özel format: Detaylı hata bilgisi
const detailedFormat = winston.format.printf(({ timestamp, level, message, service, context, stack, ...meta }) => {
  let log = `${timestamp} [${level.toUpperCase()}] [${service}]`;
  
  if (context) {
    log += ` [${context}]`;
  }
  
  log += `: ${message}`;
  
  // Meta bilgileri ekle
  if (Object.keys(meta).length > 0) {
    log += `\n  Meta: ${JSON.stringify(meta, null, 2)}`;
  }
  
  // Stack trace ekle
  if (stack) {
    log += `\n  Stack: ${stack}`;
  }
  
  return log;
});

// Konsol için renkli format
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
    let log = `${timestamp} [${level}]`;
    
    if (context) {
      log += ` [${context}]`;
    }
    
    log += `: ${message}`;
    
    // Önemli meta bilgileri göster
    const importantKeys = ['recordId', 'table', 'operation', 'duration', 'error'];
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

// Ana logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'erp-web-sync' },
  transports: [
    // Hata logları - Detaylı
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        detailedFormat
      )
    }),
    
    // Tüm loglar
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        detailedFormat
      )
    }),
    
    // Senkronizasyon logları - Ayrı dosya
    new winston.transports.File({
      filename: path.join(logsDir, 'sync.log'),
      level: 'info',
      maxsize: 10485760,
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format((info) => {
          // Sadece sync ile ilgili logları al
          return info.context && info.context.includes('sync') ? info : false;
        })(),
        detailedFormat
      )
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

logger.syncSuccess = (table, recordId, operation, duration) => {
  logger.info('Senkronizasyon başarılı', {
    context: 'sync-success',
    table,
    recordId,
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString()
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

module.exports = logger;
