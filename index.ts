import { Log } from './src/Log'

const log = new Log()

export * from './src/Log'
export * from './src/logLevel'
export { default as StackUtils } from './src/lib/StackUtils'
export default log
