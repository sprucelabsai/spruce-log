import { assert } from 'chai'
import faker from 'faker'
import log from '../index'
import jsonStringify from '../src/lib/jsonStringify'
import { LogLevel } from '../src/logLevel'
import Base from './Base'

class LoggingTests extends Base {
	public setup() {
		it('Uses colors', () => this.useColors())
		it('Can have colors turned off', () => this.noColors())
		it('Can stringify circular references', () => this.stringifyCircular())
	}

	public async before() {
		await super.before()
		log.setOptions({
			level: LogLevel.Debug,
		})
	}

	public async useColors() {
		let wasLogged = false
		log.setOptions({
			useColors: true,
		})
		log.setOptions({
			customAdapter: (logMessage) => {
				assert.isTrue(/\[32/.test(logMessage))
				wasLogged = true
			},
		})
		const message = faker.lorem.words()

		log.debug(message)
		assert.isTrue(wasLogged)
	}

	public async noColors() {
		log.setOptions({
			useColors: false,
		})

		let wasLogged = false
		log.setOptions({
			customAdapter: (logMessage) => {
				assert.isFalse(/\[32/.test(logMessage))
				wasLogged = true
			},
		})
		const message = faker.lorem.words()

		log.debug(message)
		assert.isTrue(wasLogged)
	}

	public async stringifyCircular() {
		const a: Record<string, any> = {
			b: null,
		}
		const b = { a }
		a.b = b

		let didThrow = false
		try {
			JSON.stringify(a)
		} catch (e) {
			didThrow = true
		}

		assert.isTrue(didThrow)

		jsonStringify(a)
		assert.isTrue(true)
	}
}

describe('LoggingTests', function Tests() {
	new LoggingTests()
})
