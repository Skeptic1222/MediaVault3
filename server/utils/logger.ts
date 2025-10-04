import fs from 'fs';
import path from 'path';
import { format } from 'util';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: any;
  stack?: string;
}

class Logger {
  private logLevel: LogLevel;
  private logDir: string;
  private logFile: string;
  private writeStream: fs.WriteStream | null = null;

  constructor() {
    this.logLevel = this.parseLogLevel(process.env.LOG_LEVEL || 'info');
    this.logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, `mediavault-${new Date().toISOString().split('T')[0]}.log`);

    this.ensureLogDirectory();
    this.initializeWriteStream();
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  }

  private ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private initializeWriteStream() {
    this.writeStream = fs.createWriteStream(this.logFile, { flags: 'a' });
  }

  private formatMessage(level: string, message: string, context?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...(context && { context })
    };
  }

  private writeToFile(entry: LogEntry) {
    if (this.writeStream) {
      this.writeStream.write(JSON.stringify(entry) + '\n');
    }
  }

  private writeToConsole(level: string, message: string, context?: any) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    switch (level) {
      case 'error':
        console.error(formattedMessage, context || '');
        break;
      case 'warn':
        console.warn(formattedMessage, context || '');
        break;
      default:
        console.log(formattedMessage, context || '');
    }
  }

  error(message: string, error?: Error | any) {
    if (this.logLevel >= LogLevel.ERROR) {
      const entry = this.formatMessage('error', message, {
        error: error?.message || error,
        stack: error?.stack
      });
      this.writeToFile(entry);
      this.writeToConsole('error', message, error);
    }
  }

  warn(message: string, context?: any) {
    if (this.logLevel >= LogLevel.WARN) {
      const entry = this.formatMessage('warn', message, context);
      this.writeToFile(entry);
      this.writeToConsole('warn', message, context);
    }
  }

  info(message: string, context?: any) {
    if (this.logLevel >= LogLevel.INFO) {
      const entry = this.formatMessage('info', message, context);
      this.writeToFile(entry);
      this.writeToConsole('info', message, context);
    }
  }

  debug(message: string, context?: any) {
    if (this.logLevel >= LogLevel.DEBUG) {
      const entry = this.formatMessage('debug', message, context);
      this.writeToFile(entry);
      this.writeToConsole('debug', message, context);
    }
  }

  // Security audit logging
  security(event: string, details: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'SECURITY',
      message: event,
      context: details
    };

    // Always log security events regardless of log level
    this.writeToFile(entry);
    this.writeToConsole('warn', `SECURITY EVENT: ${event}`, details);
  }

  // Access logging
  access(req: any, res: any, responseTime: number) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'ACCESS',
      message: 'HTTP Request',
      context: {
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        userId: req.user?.claims?.sub
      }
    };

    this.writeToFile(entry);
  }

  // Performance logging
  performance(operation: string, duration: number, details?: any) {
    if (this.logLevel >= LogLevel.DEBUG) {
      const entry = {
        timestamp: new Date().toISOString(),
        level: 'PERFORMANCE',
        message: operation,
        context: {
          duration: `${duration}ms`,
          ...details
        }
      };

      this.writeToFile(entry);
      if (duration > 1000) {
        this.writeToConsole('warn', `Slow operation: ${operation}`, { duration: `${duration}ms` });
      }
    }
  }

  // Rotate log files daily
  rotateLogs() {
    const newLogFile = path.join(this.logDir, `mediavault-${new Date().toISOString().split('T')[0]}.log`);

    if (newLogFile !== this.logFile) {
      if (this.writeStream) {
        this.writeStream.end();
      }
      this.logFile = newLogFile;
      this.initializeWriteStream();
    }

    // Clean up old log files (keep last 30 days)
    this.cleanOldLogs();
  }

  private cleanOldLogs() {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    fs.readdir(this.logDir, (err, files) => {
      if (err) {
        this.error('Failed to read log directory', err);
        return;
      }

      files.forEach(file => {
        const filePath = path.join(this.logDir, file);
        fs.stat(filePath, (err, stats) => {
          if (!err && stats.mtime.getTime() < thirtyDaysAgo) {
            fs.unlink(filePath, err => {
              if (err) {
                this.error(`Failed to delete old log file: ${file}`, err);
              }
            });
          }
        });
      });
    });
  }

  close() {
    if (this.writeStream) {
      this.writeStream.end();
    }
  }
}

// Create singleton instance
export const logger = new Logger();

// Rotate logs daily at midnight
setInterval(() => {
  logger.rotateLogs();
}, 24 * 60 * 60 * 1000);

// Handle process termination
process.on('exit', () => {
  logger.close();
});

// Express middleware for access logging
export function accessLogger() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();

    // Log response after it's sent
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      logger.access(req, res, responseTime);
    });

    next();
  };
}