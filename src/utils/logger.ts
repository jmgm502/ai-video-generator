type LogLevel = 'info' | 'warn' | 'error' | 'debug'

class Logger {
  private prefix: string

  constructor(prefix: string = '') {
    this.prefix = prefix
  }

  private formatMessage(level: LogLevel, ...args: unknown[]): unknown[] {
    const timestamp = new Date().toISOString()
    const prefix = this.prefix ? `[${this.prefix}]` : ''
    return [`[${timestamp}] [${level.toUpperCase()}]${prefix}`, ...args]
  }

  private logToElectron(level: LogLevel, ...args: unknown[]): void {
    const electronAPI = window.electronAPI as any
    if (electronAPI?.log?.[level]) {
      electronAPI.log[level](...args)
    }
  }

  info(...args: unknown[]): void {
    const formatted = this.formatMessage('info', ...args)
    console.info(...formatted)
    this.logToElectron('info', ...args)
  }

  warn(...args: unknown[]): void {
    const formatted = this.formatMessage('warn', ...args)
    console.warn(...formatted)
    this.logToElectron('warn', ...args)
  }

  error(...args: unknown[]): void {
    const formatted = this.formatMessage('error', ...args)
    console.error(...formatted)
    this.logToElectron('error', ...args)
  }

  debug(...args: unknown[]): void {
    const formatted = this.formatMessage('debug', ...args)
    console.debug(...formatted)
    this.logToElectron('debug', ...args)
  }

  child(prefix: string): Logger {
    const fullPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix
    return new Logger(fullPrefix)
  }
}

export const logger = new Logger()

export default logger
