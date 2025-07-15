/**
 * Logger simple para la aplicación
 */
class Logger {
  static formatMessage(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...data,
    };

    return JSON.stringify(logEntry);
  }

  static info(message, data = {}) {
    console.log(this.formatMessage('info', message, data));
  }

  static error(message, data = {}) {
    console.error(this.formatMessage('error', message, data));
  }

  static warn(message, data = {}) {
    console.warn(this.formatMessage('warn', message, data));
  }

  static debug(message, data = {}) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatMessage('debug', message, data));
    }
  }
}

module.exports = Logger; 