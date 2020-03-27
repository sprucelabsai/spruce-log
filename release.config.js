const spruceSemanticRelease = require('@sprucelabs/semantic-release')

const config = spruceSemanticRelease({
	npmPublish: true,
	branches: [
		'dev',
		{ name: 'canary', prerelease: true },
		{ name: 'prerelease/*', prerelease: true }
	]
})

module.exports = config
