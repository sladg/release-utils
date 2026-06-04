import { afterAll, describe, expect, it } from 'vitest'

import { getTagsWithFallback } from '../lib/utils'
import { cleanupTmp, commitFile, makeRepo } from './helpers'

describe('getTagsWithFallback', () => {
  afterAll(() => cleanupTmp())

  it('creates a 0.0.0 tag on the first commit when no tags exist', async () => {
    const { work, git } = await makeRepo()
    await commitFile(git, work, 'a.txt', 'a', 'feat: first')

    const tags = await getTagsWithFallback(git, false)

    expect(tags.all).toContain('0.0.0')
  })

  it('throws when failOnMissingTag is set and no tag exists', async () => {
    const { work, git } = await makeRepo()
    await commitFile(git, work, 'a.txt', 'a', 'feat: first')

    await expect(getTagsWithFallback(git, true)).rejects.toThrow(
      /No semver tag/,
    )
  })

  it('returns existing tags without inventing one', async () => {
    const { work, git } = await makeRepo()
    await commitFile(git, work, 'a.txt', 'a', 'feat: first')
    await git.addTag('v1.2.3')

    const tags = await getTagsWithFallback(git, false)

    expect(tags.all).toContain('v1.2.3')
    expect(tags.all).not.toContain('0.0.0')
  })
})
