import { assert } from 'chai'
import faker from 'faker'
import log from '../index'
import { LogLevel } from '../src/logLevel'
import Base from './Base'

class LogLevelTests extends Base {
	private namespace!: string

	private customLevels = {
		levels: {
			trace: 7,
			debug: 6,
			info: 5,
			warn: 4,
			error: 3,
			crit: 2,
			fatal: 1,
			superInfo: 0,
		},
		colors: {
			trace: 'gray',
			debug: 'green',
			info: 'cyan',
			warn: 'yellow',
			error: 'red',
			crit: 'red',
			fatal: 'red',
			superInfo: 'cyan',
		},
	}

	public setup() {
		it('Can set a namespace and log debug logs by default', () =>
			this.setNamespace(LogLevel.Debug))
		it('Can set a namespace and log debug', () =>
			this.setNamespace(LogLevel.Debug, LogLevel.Debug))
		it('Can set a namespace and log debug', () =>
			this.setNamespace(LogLevel.Trace))
		it('Logs namespaces properly', () => this.logNamespaces())
	}

	public async before() {
		await super.before()
		this.namespace = faker.name.firstName()
		log.setOptions({
			namespace: this.namespace,
		})
	}

	public async setNamespace(level: LogLevel, logLevel?: LogLevel) {
		const message = faker.lorem.words()

		const currentLogLevel = logLevel ? logLevel : LogLevel.Debug
		log.setOptions({
			level: currentLogLevel,
		})

		const shouldLog =
			this.customLevels.levels[currentLogLevel] >=
			this.customLevels.levels[level]

		let wasLogged = false

		log.setOptions({
			customAdapter: (logMessage) => {
				wasLogged = true
				if (!shouldLog) {
					throw new Error(
						`Level ${level} should not log for log level ${logLevel}`
					)
				}
				const levelRegexp = new RegExp(level, 'i')
				assert.isTrue(levelRegexp.test(logMessage))
				const messageRegexp = new RegExp(message, 'i')
				assert.isTrue(messageRegexp.test(message))
			},
		})
		console.log({
			level,
			logLevel,
			shouldLog,
		})
		log[level](message)
		assert.equal(wasLogged, shouldLog)
	}

	public async logNamespaces() {
		const message = faker.lorem.words()

		let hasNamespacePrefix = false

		log.setOptions({
			customAdapter: (logMessage) => {
				if (logMessage.indexOf(`[${this.namespace}]`) > -1) {
					hasNamespacePrefix = true
				}
			},
		})

		log.fatal(message)
		assert.isTrue(hasNamespacePrefix)
	}
}

describe('LogLevelTests', function Tests() {
	new LogLevelTests()
})
