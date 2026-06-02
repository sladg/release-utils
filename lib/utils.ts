import { replaceInFileSync } from 'replace-in-file'
import semver from 'semver'
import semverRegex from 'semver-regex'
import type { Response, SimpleGit } from 'simple-git'

export enum BumpType {
  Patch = 'patch',
  Minor = 'minor',
  Major = 'major',
}

export enum GitProvider {
  Github = 'github',
  Gitlab = 'gitlab',
  Bitbucket = 'bitbucket',
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

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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

export const replaceVersionInCommonFiles = (
  oldVersion: string,
  newVersion: string,
) => {
  // @TODO: Implement replace with path. Aka. package.json:version
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
      'Chart.yaml',
      '**/Chart.yaml', // Helm chart — bump appVersion (the deployed app version).
    ],
    from: [
      /\"version\":(.*)"\d+\.\d+\.\d+"/, // little more generic to allow for incorrect version to be replaced
      `"version": "${oldVersion}"`, // npm/php style
      `"version":"${oldVersion}"`, // uglified npm/php style
      `version = "${oldVersion}"`, // python style
      `__version__ = '${oldVersion}'`, // python style
      // Helm appVersion — quoted or unquoted, normalized to quoted on bump.
      new RegExp(`appVersion:\\s*["']?${escapeRegExp(oldVersion)}["']?`),
    ],
    to: [
      `"version": "${newVersion}"`,
      `"version": "${newVersion}"`,
      `"version":"${newVersion}"`,
      `version = "${newVersion}"`,
      `__version__ = '${newVersion}'`,
      `appVersion: "${newVersion}"`,
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

const isSemverTag = (tag: string) =>
  semverRegex().exec(tag)?.[0] ? true : false
const parseTag = (tag: string) => semverRegex().exec(tag)?.[0] ?? '0.0.0'

export const sortTagsDescending = (tags: string[]) =>
  tags.filter(isSemverTag).sort((v1, v2) => {
    const sv1 = parseTag(v1)
    const sv2 = parseTag(v2)
    return semver.rcompare(sv1, sv2)
  })

export const findHighestTag = (tags: string[]): string | undefined =>
  sortTagsDescending(tags)[0]

/** Resolves the remote URL + provider from CI env vars. Authoritative for
 *  self-hosted instances, whose domains can't be inferred from the host. */
export const detectGitRemoteFromEnv = (): {
  url: string
  provider: GitProvider
} | null => {
  if (process.env.GITHUB_REPOSITORY && process.env.GITHUB_SERVER_URL) {
    return {
      url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`,
      provider: GitProvider.Github,
    }
  }
  if (process.env.BITBUCKET_GIT_HTTP_ORIGIN) {
    return {
      url: process.env.BITBUCKET_GIT_HTTP_ORIGIN,
      provider: GitProvider.Bitbucket,
    }
  }
  if (process.env.CI_PROJECT_URL) {
    return { url: process.env.CI_PROJECT_URL, provider: GitProvider.Gitlab }
  }
  return null
}

/** Provider inference from a host — only reliable for the public SaaS domains.
 *  Self-hosted instances must be resolved via detectGitRemoteFromEnv. */
const URL_PROVIDER_MATCHERS: ReadonlyArray<[string, GitProvider]> = [
  ['github.com', GitProvider.Github],
  ['bitbucket.org', GitProvider.Bitbucket],
  ['gitlab', GitProvider.Gitlab],
]

export const providerFromUrl = (url: string): GitProvider | null =>
  URL_PROVIDER_MATCHERS.find(([host]) => url.includes(host))?.[1] ?? null

const refRange = (previous: string, next: string) =>
  previous ? `${previous}...${next}` : next

const COMMIT_LINK_BUILDERS: Record<
  GitProvider,
  (url: string, commit: string) => string
> = {
  [GitProvider.Github]: (url, commit) => `${url}/commit/${commit}`,
  [GitProvider.Gitlab]: (url, commit) => `${url}/-/commit/${commit}`,
  [GitProvider.Bitbucket]: (url, commit) => `${url}/commits/${commit}`,
}

const COMPARE_LINK_BUILDERS: Record<
  GitProvider,
  (url: string, previous: string, next: string) => string
> = {
  [GitProvider.Github]: (url, previous, next) =>
    `${url}/compare/${refRange(previous, next)}`,
  [GitProvider.Gitlab]: (url, previous, next) =>
    `${url}/-/compare/${refRange(previous, next)}`,
  [GitProvider.Bitbucket]: (url, previous, next) =>
    `${url}/branches/compare/${previous ? `${next}%0D${previous}` : next}`,
}

export const getCommitLink = (
  provider: GitProvider,
  remoteUrl: string,
  commit: string,
) => COMMIT_LINK_BUILDERS[provider](remoteUrl, commit)

export const getCompareLink = (
  provider: GitProvider,
  remoteUrl: string,
  previous: string,
  next: string,
) => COMPARE_LINK_BUILDERS[provider](remoteUrl, previous, next)

export const getTagsWithFallback = async (
  git: Response<unknown> | SimpleGit,
) => {
  let tags = await git.fetch(['--tags']).tags({ '--sort': '-creatordate' })

  // In case there are no tags in repository, we add the first tag to older commit we can find.
  if (tags.all.length < 1) {
    console.log('No tags found, adding first tag ...')

    await git.fetch()

    const commits = await git.log({
      '--max-count': 200,
    })

    const firstCommit = commits.all[commits.all.length - 1].hash
    await git.tag(['0.0.0', firstCommit])

    tags = await git.fetch(['--tags']).tags({ '--sort': '-creatordate' })
  }

  return tags
}
