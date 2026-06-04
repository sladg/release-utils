import { afterEach, describe, expect, it } from 'vitest'

import { guessHandler } from '../lib/cli/guess'
import {
  bumpCalculator,
  BumpType,
  detectGitRemoteFromEnv,
  findHighestTag,
  getCommitLink,
  getCompareLink,
  GitProvider,
  isValidTag,
  providerFromUrl,
  sortTagsDescending,
} from '../lib/utils'

describe('bumpCalculator', () => {
  it('bumps patch/minor/major', () => {
    expect(bumpCalculator('1.2.3', BumpType.Patch)).toBe('1.2.4')
    expect(bumpCalculator('1.2.3', BumpType.Minor)).toBe('1.3.0')
    expect(bumpCalculator('1.2.3', BumpType.Major)).toBe('2.0.0')
  })
})

describe('isValidTag', () => {
  it('accepts a prefixed semver tag', () => {
    expect(isValidTag('v1.2.3', 'v')).toBe(true)
  })

  it('rejects malformed tags', () => {
    expect(isValidTag('v1.2', 'v')).toBe(false)
    expect(isValidTag('abc', 'v')).toBe(false)
  })
})

describe('guessHandler (bumpMapping)', () => {
  it('maps feat -> minor, fix -> patch, BREAKING CHANGE -> major', async () => {
    expect(
      await guessHandler({
        commitMessage: 'feat: x',
        latestVersion: 'v1.2.3',
        tagPrefix: 'v',
      }),
    ).toBe('v1.3.0')
    expect(
      await guessHandler({
        commitMessage: 'fix: x',
        latestVersion: 'v1.2.3',
        tagPrefix: 'v',
      }),
    ).toBe('v1.2.4')
    expect(
      await guessHandler({
        commitMessage: 'feat: x\n\nBREAKING CHANGE: y',
        latestVersion: 'v1.2.3',
        tagPrefix: 'v',
      }),
    ).toBe('v2.0.0')
  })

  it('throws on an unmappable message', async () => {
    await expect(
      guessHandler({
        commitMessage: 'random words',
        latestVersion: 'v1.0.0',
        tagPrefix: 'v',
      }),
    ).rejects.toThrow()
  })
})

describe('tag sorting', () => {
  it('sorts semver tags descending and skips garbage', () => {
    const tags = ['v1.0.0', 'garbage', 'v2.0.0', 'v1.5.0']
    expect(sortTagsDescending(tags)).toEqual(['v2.0.0', 'v1.5.0', 'v1.0.0'])
    expect(findHighestTag(tags)).toBe('v2.0.0')
  })
})

describe('provider links', () => {
  const url = 'https://example.com/me/app'

  it('builds commit links per provider', () => {
    expect(getCommitLink(GitProvider.Github, url, 'abc')).toBe(
      `${url}/commit/abc`,
    )
    expect(getCommitLink(GitProvider.Gitlab, url, 'abc')).toBe(
      `${url}/-/commit/abc`,
    )
    expect(getCommitLink(GitProvider.Bitbucket, url, 'abc')).toBe(
      `${url}/commits/abc`,
    )
  })

  it('builds compare links per provider', () => {
    expect(getCompareLink(GitProvider.Github, url, 'v1.0.0', 'v1.1.0')).toBe(
      `${url}/compare/v1.0.0...v1.1.0`,
    )
    expect(getCompareLink(GitProvider.Gitlab, url, 'v1.0.0', 'v1.1.0')).toBe(
      `${url}/-/compare/v1.0.0...v1.1.0`,
    )
  })

  it('infers provider from a host', () => {
    expect(providerFromUrl('https://github.com/x/y')).toBe(GitProvider.Github)
    expect(providerFromUrl('https://gitlab.example.com/x/y')).toBe(
      GitProvider.Gitlab,
    )
    expect(providerFromUrl('https://example.com/x/y')).toBeNull()
  })
})

describe('detectGitRemoteFromEnv', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })

  it('reads GitHub Actions env', () => {
    process.env.GITHUB_SERVER_URL = 'https://github.com'
    process.env.GITHUB_REPOSITORY = 'me/app'
    expect(detectGitRemoteFromEnv()).toEqual({
      url: 'https://github.com/me/app',
      provider: GitProvider.Github,
    })
  })

  it('returns null outside known CI', () => {
    delete process.env.GITHUB_SERVER_URL
    delete process.env.GITHUB_REPOSITORY
    delete process.env.BITBUCKET_GIT_HTTP_ORIGIN
    delete process.env.CI_PROJECT_URL
    expect(detectGitRemoteFromEnv()).toBeNull()
  })
})
