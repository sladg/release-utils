import type { Response, SimpleGit } from 'simple-git'
import { execSync } from 'node:child_process'
import { is } from '@sladg/what-that'
import semver from 'semver'
import semverRegex from 'semver-regex'

enum BumpType {
  Patch = 'patch',
  Minor = 'minor',
  Major = 'major',
}

enum GitProvider {
  Github = 'github',
  Gitlab = 'gitlab',
  Bitbucket = 'bitbucket',
}

const bumpMapping = [
  {
    test: /(?:.*)(?:BREAKING CHANGE:|BREAKING CHANGE\((?:.*)\):)/u,
    bump: BumpType.Major,
    scanBody: true,
  },
  {
    test: /BREAKING CHANGE/iu,
    bump: BumpType.Major,
    scanBody: true,
  },
  {
    test: /(?:.*)(?:feat:|feat\((?:.*)\):|feature:|feature\((?:.*)\):)/u,
    bump: BumpType.Minor,
  },
  {
    test: /(?:.*)(?:perf:|perf\((?:.*)\):)/u,
    bump: BumpType.Minor,
  },
  {
    test: /(?:.*)(?:ref:|ref\((?:.*)\):|refactor:|refactor\((?:.*)\):|refactoring:|refactoring\((?:.*)\):)/u,
    bump: BumpType.Minor,
  },
  {
    test: /(?:.*)(?:style:|style\((?:.*)\):)/u,
    bump: BumpType.Minor,
  },
  {
    test: /(?:.*)(?:test:|test\((?:.*)\):|tests:|tests\((?:.*)\):)/u,
    bump: BumpType.Minor,
  },
  {
    test: /(?:.*)(?:ci:|ci\((?:.*)\):)/u,
    bump: BumpType.Minor,
  },
  {
    test: /(?:.*)(?:build:|build\((?:.*)\):)/u,
    bump: BumpType.Minor,
  },
  {
    test: /(?:.*)(?:fix:|fix\((?:.*)\):)/u,
    bump: BumpType.Patch,
  },
  {
    test: /(?:.*)(?:chore:|chore\((?:.*)\):)/u,
    bump: BumpType.Patch,
  },
  {
    test: /(?:.*)(?:revert:|revert\((?:.*)\):)/u,
    bump: BumpType.Patch,
  },
  {
    test: /(?:.*)(?:docs:|docs\((?:.*)\):|doc:|doc\((?:.*)\):)/u,
    bump: BumpType.Patch,
  },
]

const isValidTag = (tag: string, prefix: string) => {
  // Strip the prefix from the front only (not anywhere it happens to occur).
  let normalizedTag = tag
  if (tag.startsWith(prefix)) normalizedTag = tag.slice(prefix.length)
  const parts = normalizedTag.split('.')

  return parts.length === 3 && parts.every((p) => p !== '' && !isNaN(Number(p)))
}

const bumpCalculator = (version: string, bumpType: BumpType): string => {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number)
  const bumps: Record<BumpType, string> = {
    [BumpType.Major]: `${major + 1}.0.0`,
    [BumpType.Minor]: `${major}.${minor + 1}.0`,
    [BumpType.Patch]: `${major}.${minor}.${patch + 1}`,
  }

  return bumps[bumpType]
}

// Takes a thunk rather than a promise: guess/commit throw synchronously, so
// passing an already-invoked handler would blow up before this try ever runs.
const wrapProcess = async (run: () => unknown) => {
  try {
    // Handlers return their result (e.g. the next version); print it to stdout
    // so it can be captured. Side-effect-only handlers return undefined.
    const result = await run()
    if (is.not.undefined(result)) {
      console.log(result)
    }
  } catch (error) {
    console.error('Process failed with error:', error)
    process.exit(1)
  }
}

/** Runs a command through the shell, so user-supplied hooks may use arguments,
 *  pipes and `&&`. A non-zero exit throws. */
const runSync = (cmd: string, cwd?: string) => {
  console.log(`  $ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd })
}

const isSemverTag =(tag: string) => Boolean(semverRegex().exec(tag)?.[0])
const parseTag = (tag: string): string => semverRegex().exec(tag)?.[0] ?? '0.0.0'

const sortTagsDescending = (tags: string[]) =>
  tags.filter(isSemverTag).toSorted((v1, v2) => {
    const sv1 = parseTag(v1)
    const sv2 = parseTag(v2)
    if (semver.gt(sv1, sv2)) return -1
    if (semver.lt(sv1, sv2)) return 1
    return 0
  })

const findHighestTag = (tags: string[]): string | undefined =>
  sortTagsDescending(tags)[0]

/** Resolves the remote URL + provider from CI env vars. Authoritative for
 *  self-hosted instances, whose domains can't be inferred from the host. */
const detectGitRemoteFromEnv = (): {
  url: string
  provider: GitProvider
} | null => {
  if (is.string(process.env.GITHUB_REPOSITORY) && is.string(process.env.GITHUB_SERVER_URL)) {
    return {
      url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`,
      provider: GitProvider.Github,
    }
  }
  if (is.string(process.env.BITBUCKET_GIT_HTTP_ORIGIN)) {
    return {
      url: process.env.BITBUCKET_GIT_HTTP_ORIGIN,
      provider: GitProvider.Bitbucket,
    }
  }
  if (is.string(process.env.CI_PROJECT_URL)) {
    return { url: process.env.CI_PROJECT_URL, provider: GitProvider.Gitlab }
  }
  return null
}

/** Provider inference from a host — only reliable for the public SaaS domains.
 *  Self-hosted instances must be resolved via detectGitRemoteFromEnv. */
const URL_PROVIDER_MATCHERS: readonly [string, GitProvider][] = [
  ['github.com', GitProvider.Github],
  ['bitbucket.org', GitProvider.Bitbucket],
  ['gitlab', GitProvider.Gitlab],
]

const providerFromUrl = (url: string): GitProvider | null =>
  URL_PROVIDER_MATCHERS.find(([host]) => url.includes(host))?.[1] ?? null

const refRange = (previous: string, next: string) => `${previous}...${next}`

const COMMIT_LINK_BUILDERS: Record<
  GitProvider,
  (url: string, commit: string) => string
> = {
  [GitProvider.Github]: (url, commit) => `${url}/commit/${commit}`,
  [GitProvider.Gitlab]: (url, commit) => `${url}/-/commit/${commit}`,
  [GitProvider.Bitbucket]: (url, commit) => `${url}/commits/${commit}`,
}

// The oldest section has no earlier ref to diff against, so it links to that
// tag's commit list — a one-sided compare URL 404s on every provider.
const COMPARE_LINK_BUILDERS: Record<
  GitProvider,
  (url: string, previous: string, next: string) => string
> = {
  [GitProvider.Github]: (url, previous, next) => {
    if (!previous) return `${url}/commits/${next}`
    return `${url}/compare/${refRange(previous, next)}`
  },
  [GitProvider.Gitlab]: (url, previous, next) => {
    if (!previous) return `${url}/-/commits/${next}`
    return `${url}/-/compare/${refRange(previous, next)}`
  },
  [GitProvider.Bitbucket]: (url, previous, next) => {
    if (!previous) return `${url}/commits/tag/${next}`
    return `${url}/branches/compare/${next}%0D${previous}`
  },
}

const getCommitLink = (
  provider: GitProvider,
  remoteUrl: string,
  commit: string,
) => COMMIT_LINK_BUILDERS[provider](remoteUrl, commit)

const getCompareLink = ({
  provider,
  remoteUrl,
  previous,
  next,
}: {
  provider: GitProvider
  remoteUrl: string
  previous: string
  next: string
}) => COMPARE_LINK_BUILDERS[provider](remoteUrl, previous, next)

// An untagged repo reports no tags rather than inventing one. Callers already
// treat a missing lower bound as "the whole history", which is what an unreleased
// repo means — synthesising a 0.0.0 tag on the first commit instead excluded that
// commit from every range that started at it.
const getTags = async (
  git: Response<unknown> | SimpleGit,
  failOnMissingTag: boolean,
) => {
  const tags = await git.fetch(['--tags']).tags({ '--sort': '-creatordate' })

  if (tags.all.length === 0 && failOnMissingTag) {
    throw new Error('No semver tag found in repository.')
  }

  return tags
}

export {
  BumpType,
  GitProvider,
  bumpMapping,
  isValidTag,
  bumpCalculator,
  wrapProcess,
  runSync,
  sortTagsDescending,
  findHighestTag,
  detectGitRemoteFromEnv,
  providerFromUrl,
  getCommitLink,
  getCompareLink,
  getTags,
}
