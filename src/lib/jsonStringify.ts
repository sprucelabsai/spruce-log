// Adapted from https://github.com/debitoor/safe-json-stringify

const hasProp = Object.prototype.hasOwnProperty

function throwsMessage(err?: Error) {
	return '[Throws: ' + (err ? err.message : '?') + ']'
}

function safeGetValueFromPropertyOnObject(obj: any, property: any) {
	if (hasProp.call(obj, property)) {
		try {
			return obj[property]
		} catch (err) {
			return throwsMessage(err)
		}
	}

	return obj[property]
}

function ensureProperties(obj: any) {
	const seen: any[] = [] // store references to objects we have seen before

	function visit(obj: any): any {
		if (obj === null || typeof obj !== 'object') {
			return obj
		}

		if (seen.indexOf(obj) !== -1) {
			return '[Circular]'
		}
		seen.push(obj)

		if (typeof obj.toJSON === 'function') {
			try {
				const fResult = visit(obj.toJSON())
				seen.pop()
				return fResult
			} catch (err) {
				return throwsMessage(err)
			}
		}

		if (Array.isArray(obj)) {
			const aResult = obj.map(visit)
			seen.pop()
			return aResult
		}

		const result: any = Object.keys(obj).reduce(function (result: any, prop) {
			// prevent faulty defined getter properties
			result[prop] = visit(safeGetValueFromPropertyOnObject(obj, prop))
			return result
		}, {})
		seen.pop()
		return result
	}

	return visit(obj)
}

export default function (
	value: any,
	replacer?: (this: any, key: string, value: any) => any,
	space?: string | number
): string {
	return JSON.stringify(ensureProperties(value), replacer, space)
}
