/* eslint-disable prefer-rest-params */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-namespace */
import jsonStringify from './lib/jsonStringify'
import StackUtils from './lib/StackUtils'
import { TerminalColors } from './lib/terminal'
import { LogLevel } from './logLevel'

// eslint-disable-next-line
declare global {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const __webpack_require__: any | undefined

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	namespace NodeJS {
		// eslint-disable-next-line
		interface Global {
			__webpack_require__: any | undefined
		}
	}
}

// TODO better client detection
const CLIENT = false ///typeof window !== 'undefined' || typeof __webpack_require__ === 'function'

interface ILogOptions {
	/** The log level */
	level?: LogLevel
	/** Whether to log using colors. Default true */
	useColors?: boolean
	/** Whether to log as JSON. Default false */
	asJSON?: boolean
	/** A custom adapter that will be called with log messages. If not set, console.log is used */
	customAdapter?: LogAdapter
	/** Whether to show file path / line numbers for all logs instead of just debug and trace. Enabling this will incur a slight performance penalty.*/
	showLineNumbersForAll?: boolean
	/**
	 * If this is a module, set the namespace so logs can be selectively turned on.
	 *
	 * For example, if the module is named @sprucelabs/foo
	 *
	 * You can turn on debugging by setting the environment variable:
	 * DEBUG=@sprucelabs/foo
	 * or with a wildcard
	 * DEBUG=@sprucelabs/*
	 *
	 * You can also specify the level:
	 * DEBUG=@sprucelabs/foo~trace,@sprucelabs/bar~crit
	 *
	 * By default, when a namespace is set, the level is set to "warn"
	 *
	 * */
	namespace?: string
}

interface ICaller {
	stack?: string
	fullFilePath?: string
	relativeFilePath?: string
}

/** Corresponds to the signature of console.log */
export type LogAdapter = (message?: any, ...optionalParams: any[]) => void

export class Log {
	/** The tab size of an object when stringified */
	private objectSpaceWidth = 4
	private useColors = true
	private asJSON = false
	private showLineNumbersForAll = false
	private level: LogLevel = LogLevel.Info
	private customAdapter?: LogAdapter
	private consoleAdapter!: LogAdapter
	private namespace?: string
	private stackUtils: StackUtils

	private levels = {
		[LogLevel.Trace]: {
			i: 0,
			hex: '#404040',
			bgHex: null,
			terminalColor: TerminalColors.Dim,
		},
		[LogLevel.Debug]: {
			i: 1,
			hex: '#009933',
			bgHex: null,
			terminalColor: TerminalColors.FontGreen,
		},
		[LogLevel.Info]: {
			i: 2,
			hex: '#0033cc',
			bgHex: null,
			terminalColor: TerminalColors.FontCyan,
		},
		[LogLevel.Warn]: {
			i: 3,
			hex: '#ff6600',
			bgHex: null,
			terminalColor: TerminalColors.FontRed,
		},
		[LogLevel.Error]: {
			i: 4,
			hex: '#cc3300',
			bgHex: null,
			terminalColor: TerminalColors.FontRed,
		},
		[LogLevel.Crit]: {
			i: 5,
			hex: '#cc3300',
			bgHex: null,
			terminalColor: TerminalColors.FontRed,
		},
		[LogLevel.Fatal]: {
			i: 6,
			hex: '#cc3300',
			bgHex: null,
			terminalColor: TerminalColors.FontRed,
		},
		[LogLevel.SuperInfo]: {
			i: 7,
			hex: '#0033cc',
			bgHex: null,
			terminalColor: TerminalColors.FontCyan,
		},
	}

	public constructor(options?: ILogOptions) {
		this.stackUtils = new StackUtils({
			cwd: CLIENT ? '' : process.cwd(),
		})
		this.setConsoleAdapter()
		this.setDefaultOptions()
		this.setOptions(options)
	}

	/** Trace level logs the go beyond just normal debug messages. A silly log level. */
	public trace(...args: any) {
		return this.handleLog({
			level: LogLevel.Trace,
			args,
		})
	}
	/** Debug messages used during development. */
	public debug(...args: any) {
		return this.handleLog({
			level: LogLevel.Debug,
			args,
		})
	}
	/** Informational messages */
	public info(...args: any) {
		return this.handleLog({
			level: LogLevel.Info,
			args,
		})
	}
	/** Something bad might have happened and it should be invesigated, but we can continue. */
	public warn(...args: any) {
		return this.handleLog({
			level: LogLevel.Warn,
			args,
		})
	}
	/** Something bad happened, but we can continue or recover. */
	public error(...args: any) {
		return this.handleLog({
			level: LogLevel.Error,
			args,
		})
	}
	/** Something critical happend that likely had unintended or fatal consequences */
	public crit(...args: any) {
		return this.handleLog({
			level: LogLevel.Crit,
			args,
		})
	}
	/** Something happened and we must immediately stop */
	public fatal(...args: any) {
		return this.handleLog({
			level: LogLevel.Fatal,
			args,
		})
	}
	/** Really important information that is ALWAYS logged */
	public superInfo(...args: any) {
		return this.handleLog({
			level: LogLevel.SuperInfo,
			args,
		})
	}

	/** Start a timer. Pass the response to timerEnd() to get the elapsed time */
	public timerStart() {
		return this.hrtime()
	}

	/** Returns the elapsed time in milliseconds */
	public timerEnd(timeStart: [number, number]) {
		const elapsedHrTime = this.hrtime(timeStart)
		const elapsedTimeInMs = elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6
		return elapsedTimeInMs
	}

	/** Set logger options */
	public setOptions(options?: ILogOptions) {
		if (!options) {
			// Nothing to set
			this.debugLog('setOptions() called without any options')
			return
		}
		this.debugLog('Setting options', { options })

		if (typeof options.asJSON === 'boolean') {
			this.asJSON = options.asJSON
		}

		if (typeof options.useColors === 'boolean') {
			this.useColors = options.useColors
		}

		if (options.level) {
			this.setLevel(options.level)
		}

		if (options.customAdapter) {
			this.customAdapter = options.customAdapter
		}

		if (typeof options.showLineNumbersForAll === 'boolean') {
			this.showLineNumbersForAll = options.showLineNumbersForAll
		}

		if (typeof options.namespace === 'string' && options.namespace.length > 0) {
			this.namespace = options.namespace
			this.setDefaultOptions()
		}
	}

	private getCaller(): ICaller {
		const stack = new Error().stack
		const caller: ICaller = {
			stack,
		}
		if (stack) {
			const lines = stack.split('\n')
			if (lines && lines[4]) {
				const matches = lines[4].match(/\((.*)\)/)
				if (matches && matches[1]) {
					caller.fullFilePath = matches[1]
					if (typeof process !== 'undefined') {
						caller.relativeFilePath = matches[1].replace(process.cwd(), '')
					} else {
						caller.relativeFilePath = matches[1]
					}
				}
			}
		}

		return caller
	}

	/** Set the log level */
	private setLevel(level: LogLevel) {
		switch (level) {
			case LogLevel.Trace:
			case LogLevel.Debug:
			case LogLevel.Info:
			case LogLevel.Warn:
			case LogLevel.Error:
			case LogLevel.Crit:
			case LogLevel.Fatal:
			case LogLevel.SuperInfo:
				this.level = level
				break
			default:
				// An invalid level was passed
				this.debugLog(`Log level not set. Invalid log level: ${level}`)
		}
	}

	private getLevelFromString(level: string): LogLevel {
		switch (level) {
			case LogLevel.Trace:
			case LogLevel.Debug:
			case LogLevel.Info:
			case LogLevel.Warn:
			case LogLevel.Error:
			case LogLevel.Crit:
			case LogLevel.Fatal:
			case LogLevel.SuperInfo:
				return level
			default:
				return LogLevel.Debug
		}
	}

	private handleLog(options: {
		/** The log level to log at */
		level: LogLevel
		/** Anything you want to log */
		args: any[]
		/** Force log ignoring this.level  */
		force?: boolean
		/** Override the current namespace. Setting this will take precedent over this.namespace */
		namespace?: string
	}) {
		const { level, args, force } = options
		const namespace = options.namespace ?? this.namespace

		if (
			force ||
			(this.levels[level] && this.levels[level].i >= this.levels[this.level].i)
		) {
			const now = this.getDatetimeString()
			let caller: ICaller | undefined
			if (
				this.showLineNumbersForAll ||
				this.levels[level].i <= this.levels[LogLevel.Debug].i
			) {
				// Show the caller function
				caller = this.getCaller()
			}

			if (this.asJSON) {
				const jsonThing = `${jsonStringify(
					{
						namespace,
						timestamp: now,
						level,
						message: args,
						caller,
					},
					this.replaceErrors
				)}`

				this.writeLog(this.colorize({ level, str: jsonThing }))
			} else {
				const callerStr = caller?.relativeFilePath
					? ` | ${caller.relativeFilePath}`
					: ''

				const namespaceStr = namespace ? `  [${namespace}] ` : ''
				const rawAboutStr = `${namespaceStr}(${level.toUpperCase()} | ${now}${callerStr}): `

				if (args.length === 1 && typeof args[0] === 'string') {
					const str = CLIENT
						? this.colorize({ str: `${rawAboutStr} ${args[0]}`, level })
						: `${rawAboutStr} ${this.colorize({
								str: args[0],
								level,
						  })}`
					this.writeLog(str)
				} else if (Array.isArray(args)) {
					this.writeLog(rawAboutStr)
					args.forEach((arg: any) => {
						const addIndentation = typeof namespace !== 'undefined'
						const str = this.anyToString(arg, addIndentation)
						this.writeLog(this.colorize({ str, level }))
					})
				}
			}
		}
	}

	private anyToString(thing: any, addIndentation?: boolean): string {
		const thingType = typeof thing

		if (thing instanceof Error) {
			const cleanStack = this.stackUtils.clean(thing.stack)

			return `Error: ${thing.message}\n\n${cleanStack}`
		}

		switch (thingType) {
			case 'undefined':
				return 'undefined'
			case 'string': {
				let thingStr = thing
				if (addIndentation) {
					thingStr = `  ${thingStr}`
				}
				return thingStr
			}
			case 'number':
			case 'bigint':
			case 'boolean':
				return thing.toString()
			case 'symbol':
			case 'object':
			case 'function':
			default: {
				let thingStr = jsonStringify(
					thing,
					this.replaceErrors,
					this.objectSpaceWidth
				)
				if (addIndentation) {
					thingStr = thingStr.replace(/\n/g, '\n  ')
					thingStr = `  ${thingStr}`
				}
				return thingStr
			}
		}
	}

	private colorize(options: { level: LogLevel; str: string }) {
		const { level, str } = options
		if (!this.useColors) {
			return str
		}
		let colorizedStr: string | string[] = str
		if (CLIENT) {
			let style = ''
			if (this.levels[level].bgHex) {
				style += `background: ${this.levels[level].bgHex};`
			}
			if (this.levels[level].hex) {
				style += `color: ${this.levels[level].hex};`
			}

			colorizedStr = [`%c${str}`, style]
		} else {
			colorizedStr = `${this.levels[level].terminalColor}${str}${TerminalColors.Reset}`
		}
		return colorizedStr
	}

	private writeLog(thingsToWrite: any) {
		const adapter = this.getAdapter()
		if (Array.isArray(thingsToWrite)) {
			adapter(...thingsToWrite)
		} else {
			adapter(thingsToWrite)
		}
	}

	private getDatetimeString() {
		const now = new Date()
		const year = now.getFullYear()
		const month = now.getMonth() + 1
		const day = now.getDate()
		const hour = now.getHours()
		const minute = now.getMinutes()
		const second = now.getSeconds()
		let dayStr = day.toString()
		let hourStr = hour.toString()
		let minuteStr = minute.toString()
		let secondStr = second.toString()
		let monthStr = month.toString()

		if (month < 10) {
			monthStr = '0' + month
		}
		if (day < 10) {
			dayStr = '0' + day
		}
		if (hour < 10) {
			hourStr = '0' + hour
		}
		if (minute < 10) {
			minuteStr = '0' + minute
		}
		if (second < 10) {
			secondStr = '0' + second
		}
		const millisecond = now.getMilliseconds()
		const nowStr = `${year}-${monthStr}-${dayStr} ${hourStr}:${minuteStr}:${secondStr}:${millisecond}`

		return nowStr
	}

	private getAdapter(): LogAdapter {
		if (this.customAdapter) {
			return this.customAdapter
		}

		return this.consoleAdapter
	}

	private setConsoleAdapter() {
		let adapter = () => {}
		if (typeof console !== 'undefined') {
			if (CLIENT) {
				// adapter = console.log.bind(window.console)
			} else {
				adapter = console.log
			}
		}

		this.consoleAdapter = adapter
	}

	private replaceErrors(key: string, value: any) {
		if (value instanceof Error) {
			const error: Record<string, any> = {}

			Object.getOwnPropertyNames(value).forEach((key) => {
				if (key === 'stack') {
					error[key] = value.stack && value.stack.split('\n')
				} else {
					// @ts-ignore
					error[key] = value[key]
				}
			})

			return error
		}

		return value
	}

	/** Logs a debug message about @sprucelabs/log itself */
	private debugLog(...args: any) {
		const namespace = '@sprucelabs/log'
		const debugStr = this.getDebugString()
		const level = this.getDefaultLevelForNamespace(namespace, debugStr)

		if (level && this.levels[level].i <= this.levels[LogLevel.Debug].i) {
			this.handleLog({
				level: LogLevel.Debug,
				force: true,
				namespace,
				args,
			})
		}
	}

	private setDefaultOptions() {
		const debugStr = this.getDebugString()
		if (this.namespace) {
			const level = this.getDefaultLevelForNamespace(this.namespace, debugStr)
			if (level) {
				this.setLevel(level)
			} else {
				// Default log level when namespace is set
				this.setLevel(LogLevel.Warn)
			}
		}
	}

	private getDebugString() {
		let debugStr = ''
		// if (CLIENT && typeof localStorage !== 'undefined') {
		// 	// eslint-disable-next-line no-undef
		// 	const lsDebug = localStorage.getItem('debug')
		// 	if (lsDebug) {
		// 		debugStr = lsDebug
		// 	}
		// } else
		if (typeof process !== 'undefined' && process.env.DEBUG) {
			debugStr = process.env.DEBUG
		}

		return debugStr
	}

	private getDefaultLevelForNamespace(namespace: string, debugStr: string) {
		if (namespace) {
			// Set the namespace based on the package.json
			const debugNamespaces = debugStr.split(',')
			for (let i = 0; i < debugNamespaces.length; i += 1) {
				const ns = debugNamespaces[i]
				const { namespace: parsedNamespace, level } = this.parseNamespace(ns)
				const namespaceToCheck = parsedNamespace.replace(/\*/g, '')

				if (
					parsedNamespace.length > 0 &&
					(parsedNamespace === '*' || namespace.indexOf(namespaceToCheck) > -1)
				) {
					return level
				}
			}
		}

		return
	}

	private parseNamespace(ns: string) {
		const [namespace, level] = ns.split('~')

		return {
			namespace,
			level: this.getLevelFromString(level),
		}
	}

	private hrtime(time?: [number, number]): [number, number] {
		if (typeof process !== 'undefined') {
			return process.hrtime(time)
		}

		const calcTime = time || [0, 0]

		const now = Date.now() * 1e-3
		const sec = Math.floor(now) - calcTime[0]
		const nsec = Math.floor((now % 1) * 1e9) - calcTime[1]
		const shift = nsec < 0 ? 0 : 1

		return [sec - shift, nsec + shift * 1e9]
	}
}

export default Log
