/* eslint-disable @typescript-eslint/camelcase */

// TODO better client detection
const CLIENT = false

const matchOperatorsRegex = /[|\\{}()[\]^$+*?.-]/g

function escapeStringRegexp(str: string) {
	if (typeof str !== 'string') {
		throw new TypeError('Expected a string')
	}

	return str.replace(matchOperatorsRegex, '\\$&')
}

const strNatives: string[] = []

const natives: RegExp[] = CLIENT
	? []
	: strNatives.map((n) => new RegExp(`\\(${n}\\.js:\\d+:\\d+\\)$`))

natives.push(
	// XXX are `bootstrap_node.js` and `node.js` needed in supported versions?
	/\s*at (bootstrap_)?node\.js:\d+:\d+?$/,
	/\(internal\/[^:]+:\d+:\d+\)$/,
	/\s*at internal[/]main[/]run_main_module\.js:\d+:\d+$/,
	/\/\.node-spawn-wrap-\w+-\w+\/node:\d+:\d+\)?$/
)

function setFile(result: IParsedLine, filename?: string, cwd?: string) {
	if (filename) {
		filename = filename.replace(/\\/g, '/')
		if (cwd && filename.startsWith(`${cwd}/`)) {
			filename = filename.slice(cwd.length + 1)
		}

		result.file = filename
	}
}

function ignoredPackagesRegExp(ignoredPackages: string[]): RegExp | never[] {
	if (ignoredPackages.length === 0) {
		return []
	}

	const packages = ignoredPackages.map((mod) => escapeStringRegexp(mod))

	return new RegExp(
		`[/\\\\]node_modules[/\\\\](?:${packages.join('|')})[/\\\\][^:]+:\\d+:\\d+`
	)
}

const re = new RegExp(
	'^' +
		// Sometimes we strip out the '    at' because it's noisy
		'(?:\\s*at )?' +
		// $1 = ctor if 'new'
		'(?:(new) )?' +
		// $2 = function name (can be literally anything)
		// May contain method at the end as [as xyz]
		'(?:(.*?) \\()?' +
		// (eval at <anonymous> (file.js:1:1),
		// $3 = eval origin
		// $4:$5:$6 are eval file/line/col, but not normally reported
		'(?:eval at ([^ ]+) \\((.+?):(\\d+):(\\d+)\\), )?' +
		// File:line:col
		// $7:$8:$9
		// $10 = 'native' if native
		'(?:(.+?):(\\d+):(\\d+)|(native))' +
		// Maybe close the paren, then end
		// if $11 is ), then we only allow balanced parens in the filename
		// any imbalance is placed on the fname.  This is a heuristic, and
		// bound to be incorrect in some edge cases.  The bet is that
		// having weird characters in method names is more common than
		// having weird characters in filenames, which seems reasonable.
		'(\\)?)$'
)

const methodRe = /^(.*?) \[as (.*?)\]$/

type CallSite = NodeJS.CallSite | false

interface IParsedLine {
	file?: string
	type?: string
	isConstructor?: boolean
	evalOrigin?: string
	evalLine?: number
	evalColumn?: number
	evalFile?: string
	native?: boolean
	function?: string
	method?: string
	line?: number
	column?: number
}

/** Typescript adaptation of https://github.com/tapjs/stack-utils */
export default class StackUtils {
	private _wrapCallSite: false | ((site: CallSite) => CallSite) = false
	private _internals: RegExp[] = []
	private _cwd = ''

	public constructor(opts?: {
		internals?: RegExp[]
		ignoredPackages?: string[]
		cwd?: string
		wrapCallSite?: (site: CallSite) => CallSite
	}) {
		opts = {
			ignoredPackages: [],
			...opts,
		}

		if ('internals' in opts === false) {
			opts.internals = StackUtils.nodeInternals()
		}

		if ('cwd' in opts === false) {
			opts.cwd = process.cwd()
		}
		if (opts.cwd) {
			this._cwd = opts.cwd.replace(/\\/g, '/')
		}

		if (opts.internals) {
			this._internals = this._internals.concat(opts.internals)
		}

		if (opts.ignoredPackages) {
			this._internals = this._internals.concat(
				ignoredPackagesRegExp(opts.ignoredPackages)
			)
		}

		this._wrapCallSite = opts.wrapCallSite || false
	}

	private static nodeInternals() {
		return [...natives]
	}

	public clean(stack?: string | string[], indentSpaces = 0) {
		const indent = ' '.repeat(indentSpaces)

		if (!stack) {
			return
		}

		if (!Array.isArray(stack)) {
			stack = stack.split('\n')
		}

		if (!/^\s*at /.test(stack[0]) && /^\s*at /.test(stack[1])) {
			stack = stack.slice(1)
		}

		let outdent = false
		let lastNonAtLine: string | null = null
		const result: string[] = []

		stack.forEach((st) => {
			st = st.replace(/\\/g, '/')

			if (this._internals.some((internal) => internal.test(st))) {
				return
			}

			const isAtLine = /^\s*at /.test(st)

			if (outdent) {
				st = st.trimRight().replace(/^(\s+)at /, '$1')
			} else {
				st = st.trim()
				if (isAtLine) {
					st = st.slice(3)
				}
			}

			st = st.replace(`${this._cwd}/`, '')

			if (st) {
				if (isAtLine) {
					if (lastNonAtLine) {
						result.push(lastNonAtLine)
						lastNonAtLine = null
					}

					result.push(st)
				} else {
					outdent = true
					lastNonAtLine = st
				}
			}
		})

		return result.map((line) => `${indent}${line}\n`).join('')
	}

	public captureString(limit?: number, fn = this.captureString) {
		if (typeof limit === 'function') {
			fn = limit
			limit = Infinity
		}

		const { stackTraceLimit } = Error
		if (limit) {
			Error.stackTraceLimit = limit
		}

		const obj: Record<string, any> = {}

		Error.captureStackTrace(obj, fn)
		const { stack } = obj
		Error.stackTraceLimit = stackTraceLimit

		return this.clean(stack)
	}

	public capture(limit: number, fn = this.capture) {
		if (typeof limit === 'function') {
			fn = limit
			limit = Infinity
		}

		const { prepareStackTrace, stackTraceLimit } = Error
		Error.prepareStackTrace = (obj, site) => {
			if (this._wrapCallSite) {
				return site.map(this._wrapCallSite)
			}

			return site
		}

		if (limit) {
			Error.stackTraceLimit = limit
		}

		const obj: Record<string, any> = {}
		Error.captureStackTrace(obj, fn)
		const { stack } = obj
		Object.assign(Error, { prepareStackTrace, stackTraceLimit })

		return stack
	}

	public at(fn = this.at) {
		// @ts-ignore
		const [site] = this.capture(1, fn)

		if (!site) {
			return {}
		}

		const res: IParsedLine = {
			line: site.getLineNumber(),
			column: site.getColumnNumber(),
		}

		setFile(res, site.getFileName(), this._cwd)

		if (site.isConstructor()) {
			res.isConstructor = true
		}

		if (site.isEval()) {
			res.evalOrigin = site.getEvalOrigin()
		}

		// Node v10 stopped with the isNative() on callsites, apparently
		/* istanbul ignore next */
		if (site.isNative()) {
			res.native = true
		}

		let typename
		try {
			typename = site.getTypeName()
		} catch (_) {
			// Ignore
		}

		if (typename && typename !== 'Object' && typename !== '[object Object]') {
			res.type = typename
		}

		const fname = site.getFunctionName()
		if (fname) {
			res.function = fname
		}

		const meth = site.getMethodName()
		if (meth && fname !== meth) {
			res.method = meth
		}

		return res
	}

	public parseLine(line: string) {
		const match = line && line.match(re)
		if (!match) {
			return null
		}

		const ctor = match[1] === 'new'
		let fname = match[2]
		const evalOrigin = match[3]
		const evalFile = match[4]
		const evalLine = Number(match[5])
		const evalCol = Number(match[6])
		let file = match[7]
		const lnum = match[8]
		const col = match[9]
		const native = match[10] === 'native'
		const closeParen = match[11] === ')'
		let method

		const res: IParsedLine = {}

		if (lnum) {
			res.line = Number(lnum)
		}

		if (col) {
			res.column = Number(col)
		}

		if (closeParen && file) {
			// Make sure parens are balanced
			// if we have a file like "asdf) [as foo] (xyz.js", then odds are
			// that the fname should be += " (asdf) [as foo]" and the file
			// should be just "xyz.js"
			// walk backwards from the end to find the last unbalanced (
			let closes = 0
			for (let i = file.length - 1; i > 0; i--) {
				if (file.charAt(i) === ')') {
					closes++
				} else if (file.charAt(i) === '(' && file.charAt(i - 1) === ' ') {
					closes--
					if (closes === -1 && file.charAt(i - 1) === ' ') {
						const before = file.slice(0, i - 1)
						const after = file.slice(i + 1)
						file = after
						fname += ` (${before}`
						break
					}
				}
			}
		}

		if (fname) {
			const methodMatch = fname.match(methodRe)
			if (methodMatch) {
				fname = methodMatch[1]
				method = methodMatch[2]
			}
		}

		setFile(res, file, this._cwd)

		if (ctor) {
			res.isConstructor = true
		}

		if (evalOrigin) {
			res.evalOrigin = evalOrigin
			res.evalLine = evalLine
			res.evalColumn = evalCol
			res.evalFile = evalFile && evalFile.replace(/\\/g, '/')
		}

		if (native) {
			res.native = true
		}

		if (fname) {
			res.function = fname
		}

		if (method && fname !== method) {
			res.method = method
		}

		return res
	}
}
