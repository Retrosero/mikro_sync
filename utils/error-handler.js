const logger = require('./logger');

class SyncError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
    this.details = details;
  }
}

function handleError(error, context = {}) {
  logger.error('Sync error occurred', {
    error: error.message,
    stack: error.stack,
    code: error.code,
    context
  });
  
  return {
    success: false,
    error: error.message,
    code: error.code,
    details: error.details
  };
}

function isRetryable(error) {
  const retryableCodes = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'DEADLOCK',
    'LOCK_TIMEOUT'
  ];
  
  return retryableCodes.some(code => 
    error.code === code || error.message.includes(code)
  );
}

module.exports = {
  SyncError,
  handleError,
  isRetryable
};
