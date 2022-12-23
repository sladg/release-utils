import { replaceInFileSync } from 'replace-in-file'
import semver from 'semver'
import semverRegex from 'semver-regex'

export enum BumpType {
	Patch = 'patch',
	Minor = 'minor',
	Major = 'major',
}

export const bumpMapping = [
	{
		test: /(.*)(BREAKING CHANGE:|BREAKING CHANGE\((.*)\):)/,
		bump: BumpType.Major,
		scanBody: true,
	},
	{
		test: /BREAKING CHANGE/i,
		bump: BumpType.Major,
		scanBody: true,
	},
	{
		test: /(.*)(feat:|feat\((.*)\):|feature:|feature\((.*)\):)/,
		bump: BumpType.Minor,
	},
	{
		test: /(.*)(perf:|perf\((.*)\):)/,
		bump: BumpType.Minor,
	},
	{
		test: /(.*)(ref:|ref\((.*)\):|refactor:|refactor\((.*)\):|refactoring:|refactoring\((.*)\):)/,
		bump: BumpType.Minor,
	},
	{
		test: /(.*)(style:|style\((.*)\):)/,
		bump: BumpType.Minor,
	},
	{
		test: /(.*)(test:|test\((.*)\):|tests:|tests\((.*)\):)/,
		bump: BumpType.Minor,
	},
	{
		test: /(.*)(ci:|ci\((.*)\):)/,
		bump: BumpType.Minor,
	},
	{
		test: /(.*)(build:|build\((.*)\):)/,
		bump: BumpType.Minor,
	},
	{
		test: /(.*)(fix:|fix\((.*)\):)/,
		bump: BumpType.Patch,
	},
	{
		test: /(.*)(chore:|chore\((.*)\):)/,
		bump: BumpType.Patch,
	},
	{
		test: /(.*)(revert:|revert\((.*)\):)/,
		bump: BumpType.Patch,
	},
	{
		test: /(.*)(docs:|docs\((.*)\):|doc:|doc\((.*)\):)/,
		bump: BumpType.Patch,
	},
]

export const isValidTag = (tag: string, prefix: string) => {
	// Replace "v" in case used for tagging.
	const normalizedTag = tag.replace(prefix, '')
	const [major, minor, patch] = normalizedTag.split('.').map(Number).map(isNaN)

	return !major && !minor && !patch
}

export const bumpCalculator = (version: string, bumpType: BumpType) => {
	const [major, minor, patch] = version.split('.').map(Number)

	if (bumpType === BumpType.Major) {
		return `${major + 1}.0.0`
	}

	if (bumpType === BumpType.Minor) {
		return `${major}.${minor + 1}.0`
	}

	if (bumpType === BumpType.Patch) {
		return `${major}.${minor}.${patch + 1}`
	}

	throw new Error(`Unknown bump type - ${bumpType}!`)
}

export const replaceVersionInCommonFiles = (oldVersion: string, newVersion: string) => {
	const results = replaceInFileSync({
		allowEmptyPaths: true,
		ignore: [
			'**/node_modules/**',
			'**/.venv/**',
			'**/vendor/**',
			'**/.git/**',
			//
		],
		files: [
			'package.json',
			'**/package.json', // Useful for workspaces with nested package.jsons also including versions.
			// @TODO: Do not use until https://github.com/sladg/release-utils/issues/2 is fixed.
			// 'package-lock.json',
			// 'package-lock.json', // Duplicate because lock file contains two occurences.
			// 'yarn.lock', Yarn3 lock file does not contain version from package.json
			'composer.json',
			'**/composer.json', // Useful for workspaces with nested composer.jsons also including versions.
			// 'composer.lock', Composer2 lock file does not include version from composer.json
			'pyproject.toml',
			'**/__init__.py',
		],
		from: [
			/\"version\":(.*)"\d+\.\d+\.\d+"/, // little more generic to allow for incorrect version to be replaced
			`"version": "${oldVersion}"`, // npm/php style
			`"version":"${oldVersion}"`, // uglified npm/php style
			`version = "${oldVersion}"`, // python style
			`__version__ = '${oldVersion}'`, // python style
		],
		to: [
			`"version": "${newVersion}"`,
			`"version": "${newVersion}"`,
			`"version":"${newVersion}"`,
			`version = "${newVersion}"`,
			`__version__ = '${newVersion}'`,
			//
		],
	})

	return results
}

export const wrapProcess = async (fn: Promise<any>) => {
	try {
		await fn
	} catch (e) {
		console.error('Process failed with error:', e)
		process.exit(1)
	}
}

const isSemverTag = (tag: string) => (semverRegex().exec(tag)?.[0] ? true : false)
const parseTag = (tag: string) => semverRegex().exec(tag)?.[0] ?? '0.0.0'

export const sortTagsDescending = (tags: string[]) =>
	tags.filter(isSemverTag).sort((v1, v2) => {
		const sv1 = parseTag(v1)
		const sv2 = parseTag(v2)
		return semver.rcompare(sv1, sv2)
	})

export const findHighestTag = (tags: string[]) => sortTagsDescending(tags)[0]

export const getCommitLink = (remoteUrl: string, commit: string) => {
	if (remoteUrl.includes('bitbucket.org')) {
		return `${remoteUrl}/commits/${commit}`
	}

	if (remoteUrl.includes('github.com')) {
		return `${remoteUrl}/commit/${commit})`
	}

	return null
}

export const getCompareLink = (remoteUrl: string, previous: string, next: string) => {
	if (remoteUrl.includes('bitbucket.org')) {
		const formattedPrevious = previous ? `${next}%0D${previous}` : next
		return `${remoteUrl}/branches/compare/${formattedPrevious}`
	}

	if (remoteUrl.includes('github.com')) {
		const formattedPath = previous ? `${previous}...${next}` : next
		return `${remoteUrl}/compare/${formattedPath}`
	}

	return null
}
