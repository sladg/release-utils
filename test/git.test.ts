import { afterAll, afterEach, describe, expect, it } from 'vitest'

import { cleanupTmp, commitFile, makeRepo } from './helpers'
import { changelogHandler } from '../lib/cli/changelog'
import { getTags } from '../lib/utils'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'

describe('getTags', () => {
  afterAll(() => cleanupTmp())

  it('reports no tags on an untagged repo without inventing one', async () => {
    const { work, git } = await makeRepo()
    await commitFile({ git, dir: work, file: 'a.txt', content: 'a', message: 'feat: first' })

    const tags = await getTags(git, false)

    expect(tags.all).toEqual([])
    expect(tags.all).not.toContain('0.0.0')
  })

  it('throws when failOnMissingTag is set and no tag exists', async () => {
    const { work, git } = await makeRepo()
    await commitFile({ git, dir: work, file: 'a.txt', content: 'a', message: 'feat: first' })

    await expect(getTags(git, true)).rejects.toThrow(
      /No semver tag/,
    )
  })

  it('returns existing tags without inventing one', async () => {
    const { work, git } = await makeRepo()
    await commitFile({ git, dir: work, file: 'a.txt', content: 'a', message: 'feat: first' })
    await git.addTag('v1.2.3')

    const tags = await getTags(git, false)

    expect(tags.all).toContain('v1.2.3')
    expect(tags.all).not.toContain('0.0.0')
  })
})

describe('changelogHandler', () => {
  const original = process.cwd()
  afterEach(() => {
    process.chdir(original)
  })
  afterAll(() => cleanupTmp())

  const generate = async (work: string) => {
    const outputFile = join(work, 'CHANGELOG.md')
    process.chdir(work)
    await changelogHandler({
      outputFile,
      gitBaseUrl: 'https://github.com/acme/demo',
      nextTag: 'v1.0.0',
    })
    return readFileSync(outputFile, 'utf8')
  }

  // First release ever: nothing is tagged, so every commit belongs to it.
  const buildFirstRunRepo = async () => {
    const { work, git } = await makeRepo()
    await commitFile({ git, dir: work, file: 'a.txt', content: 'a', message: 'feat: first' })
    await commitFile({ git, dir: work, file: 'b.txt', content: 'b', message: 'fix: second' })
    await commitFile({ git, dir: work, file: 'c.txt', content: 'c', message: 'feat: third' })
    return generate(work)
  }

  // A prior release exists, so the new section must stop at it.
  const buildTaggedRepo = async () => {
    const { work, git } = await makeRepo()
    await commitFile({ git, dir: work, file: 'a.txt', content: 'a', message: 'feat: first' })
    await git.addTag('v0.1.0')
    await commitFile({ git, dir: work, file: 'b.txt', content: 'b', message: 'fix: second' })
    await commitFile({ git, dir: work, file: 'c.txt', content: 'c', message: 'feat: third' })
    return generate(work)
  }

  it('includes the very first commit of the repository', async () => {
    expect(await buildFirstRunRepo()).toContain('feat: first')
  })

  it('puts every commit in the first release when nothing was tagged before', async () => {
    const changelog = await buildFirstRunRepo()

    expect(changelog).toContain('feat: first')
    expect(changelog).toContain('fix: second')
    expect(changelog).toContain('feat: third')
  })

  it('does not invent a 0.0.0 release section', async () => {
    expect(await buildFirstRunRepo()).not.toContain('## [0.0.0]')
  })

  it('links a first release to a commit list, not a one-sided compare', async () => {
    expect(await buildFirstRunRepo()).toContain(
      '## [v1.0.0](https://github.com/acme/demo/commits/v1.0.0)',
    )
  })

  it('scopes each release section to its own commit range', async () => {
    const changelog = await buildTaggedRepo()
    const [, latestSection = ''] = changelog.split('## [v1.0.0]')
    const [newestOnly = ''] = latestSection.split('## [v0.1.0]')

    expect(newestOnly).toContain('fix: second')
    expect(newestOnly).toContain('feat: third')
    expect(newestOnly).not.toContain('feat: first')
  })

  it('does not repeat newer commits under the older tag', async () => {
    const changelog = await buildTaggedRepo()
    const [, oldestSection = ''] = changelog.split('## [v0.1.0]')

    expect(oldestSection).toContain('feat: first')
    expect(oldestSection).not.toContain('fix: second')
    expect(oldestSection).not.toContain('feat: third')
  })

  it('drops its own release commits but keeps commits that merely mention one', async () => {
    const { work, git } = await makeRepo()
    await commitFile({ git, dir: work, file: 'a.txt', content: 'a', message: 'Release: v0.9.0' })
    await commitFile({
      git,
      dir: work,
      file: 'b.txt',
      content: 'b',
      message: 'feat(release): support v1.2.3 configs',
    })
    const changelog = await generate(work)

    expect(changelog).toContain('feat(release): support v1.2.3 configs')
    expect(changelog).not.toContain('* Release: v0.9.0')
  })
})
