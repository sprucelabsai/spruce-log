/**
 * Setting a log level causes all logs of that level and higher to be output. The ones below it are ignored / dropped.
 *
 * The log levels in order from lowest to highest:
 * - Trace
 * - Debug
 * - Log
 * - Info
 * - Warn
 * - Error
 * - Crit
 * - Fatal
 * - SuperInfo
 */
export enum LogLevel {
	/** Trace level logs the go beyond just normal debug messages. A silly log level. */
	Trace = 'trace',
	/** Debug messages used during development. */
	Debug = 'debug',
	/** Informational messages */
	Info = 'info',
	/** Something bad might have happened and it should be invesigated, but we can continue. */
	Warn = 'warn',
	/** Something bad happened, but we can continue or recover. */
	Error = 'error',
	/** Something critical happend that likely had unintended or fatal consequences */
	Crit = 'crit',
	/** Something happened and we must immediately stop */
	Fatal = 'fatal',
	/** Really important information that is ALWAYS logged */
	SuperInfo = 'superInfo',
}

// TODO: Use SpruceError here?
/** Converts a string to a LogLevel. Throws 'INVALID_LOG_LEVEL' if there is no match */
export function stringToLogLevel(level: string): LogLevel {
	switch (level) {
		case LogLevel.Trace:
			return LogLevel.Trace
		case LogLevel.Debug:
			return LogLevel.Debug
		case LogLevel.Info:
			return LogLevel.Info
		case LogLevel.Warn:
			return LogLevel.Warn
		case LogLevel.Error:
			return LogLevel.Error
		case LogLevel.Crit:
			return LogLevel.Crit
		case LogLevel.Fatal:
			return LogLevel.Fatal
		case LogLevel.SuperInfo:
			return LogLevel.SuperInfo
		default:
			throw new Error('INVALID_LOG_LEVEL')
	}
}
