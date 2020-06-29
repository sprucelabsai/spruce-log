import log from '../index'
import { LogLevel } from '../src/logLevel'
import Base from './Base'

class LogLevelTests extends Base {
	public setup() {
		it('Can log errors', () => this.logErrors())
	}

	public async logErrors() {
		log.setOptions({
			level: LogLevel.Trace
		})

		log.debug(new Error('MISSING_PARAMETERS'))
	}
}

describe('LogLevelTests', function Tests() {
	new LogLevelTests()
})
