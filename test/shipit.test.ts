import { afterAll, afterEach, describe, expect, it } from 'vitest'

import { cleanupTmp, commitFile, makeRepo } from './helpers'
import { shipitHandler } from '../lib/cli/shipit'
import { simpleGit } from 'simple-git'

const SHIPIT_PROPS = {
  gitUser: 'Bender',
  gitEmail: 'bender@bot.eu',
  tagPrefix: 'v',
  failOnMissingCommit: true,
  failOnMissingTag: false,
  releaseBranchPrefix: 'release/',
  forceBump: true,
  generateChangelog: false,
  changelogPath: 'CHANGELOG.md',
  branchPrefixes: [''],
  postBump: undefined,
}

const FORMATTED_MANIFEST = '{"version":"1.1.0","formatted":true}'

/** A repo with v1.0.0 released and one feat commit since, so shipit bumps to v1.1.0. */
const releasedRepo = async () => {
  const repo = await makeRepo()
  const { work, git } = repo
  await commitFile({ git, dir: work, file: 'package.json', content: '{ "version": "1.0.0" }\n', message: 'feat: init' })
  await git.addTag('v1.0.0')
  await commitFile({ git, dir: work, file: 'a.txt', content: 'a', message: 'feat: next' })
  await git.push(['--all']).pushTags()
  process.chdir(work)
  return repo
}

describe('shipitHandler --postBump', () => {
  const original = process.cwd()
  afterEach(() => {
    process.chdir(original)
  })
  afterAll(() => cleanupTmp())

  it('runs on the bumped tree and includes its changes in the release commit and tag', async () => {
    const { git, remote } = await releasedRepo()

    await shipitHandler({
      ...SHIPIT_PROPS,
      postBump: `cp package.json seen-by-hook.json && printf '${FORMATTED_MANIFEST}' > package.json`,
    })

    const origin = simpleGit(remote)
    const status = await git.status()
    expect(JSON.parse(await origin.show(['v1.1.0:seen-by-hook.json']))).toEqual({ version: '1.1.0' })
    expect(await origin.show(['v1.1.0:package.json'])).toBe(FORMATTED_MANIFEST)
    expect(await origin.show(['release/v1.1.0:package.json'])).toBe(FORMATTED_MANIFEST)
    expect(status.isClean()).toBe(true)
  })

  it('aborts the release before committing, tagging or pushing when the command fails', async () => {
    const { git, remote } = await releasedRepo()
    const headBefore = await git.revparse(['HEAD'])

    await expect(shipitHandler({ ...SHIPIT_PROPS, postBump: 'exit 3' })).rejects.toThrow()

    const origin = simpleGit(remote)
    const localTags = await git.tags()
    const remoteTags = await origin.tags()
    const remoteBranches = await origin.branch()
    expect(await git.revparse(['HEAD'])).toBe(headBefore)
    expect(localTags.all).not.toContain('v1.1.0')
    expect(remoteTags.all).not.toContain('v1.1.0')
    expect(remoteBranches.all).not.toContain('release/v1.1.0')
  })

  it('releases unchanged when no command is given', async () => {
    const { remote } = await releasedRepo()

    await shipitHandler(SHIPIT_PROPS)

    expect(JSON.parse(await simpleGit(remote).show(['v1.1.0:package.json']))).toEqual({ version: '1.1.0' })
  })
})
