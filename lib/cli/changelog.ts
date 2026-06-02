import { writeFileSync } from 'fs'
import { DefaultLogFields, simpleGit } from 'simple-git'

import {
  detectGitRemoteFromEnv,
  getCommitLink,
  getCompareLink,
  providerFromUrl,
  sortTagsDescending,
} from '../utils'

interface Props {
  outputFile: string
  gitBaseUrl?: string
  nextTag?: string
}

export const changelogHandler = async ({
  outputFile,
  gitBaseUrl,
  nextTag,
}: Props) => {
  const git = simpleGit()

  // CI env is authoritative (handles self-hosted hosts); an explicit
  // gitBaseUrl override falls back to host-based provider inference.
  const fromEnv = detectGitRemoteFromEnv()
  const gitUrl = gitBaseUrl ?? fromEnv?.url
  if (!gitUrl) {
    throw new Error('Could not determine git base URL!')
  }

  const provider = gitBaseUrl ? providerFromUrl(gitBaseUrl) : fromEnv?.provider
  if (!provider) {
    throw new Error(
      `Could not determine git provider from "${gitUrl}". Supported: GitHub, GitLab, Bitbucket. Pass a recognizable --gitBaseUrl or run inside CI.`,
    )
  }

  await git.fetch(['--tags'])

  const tags = await git.tags()
  const commits = await git.log()
  const sortedTags = sortTagsDescending(tags.all)
  const sortedNormalizedTags = nextTag ? [nextTag, ...sortedTags] : sortedTags

  // Sorted from newest to oldest (highest version to lowest).
  const tagsWithLog = sortedNormalizedTags.map(async (tag, index, arr) => {
    const lowerTag = arr[index + 1]
    const higherTag = arr[index - 1]

    const latestTag = sortedTags.includes(tag) ? tag : commits.latest?.hash

    const log = await git.log({ from: lowerTag, to: latestTag })
    const filteredLog = log.all
      // Remove automatic commits (typically generated inside pipeline)
      .filter((a) => !a.message.includes('[skip ci]'))
      // Remove release commits (typically previous release)
      .filter((a) => !a.message.match(/release(.*)v(.*)\.(.*)\.(.*)/gi)?.length)

    // Make them unique.
    const authors = filteredLog.reduce(
      (acc, curr) => ({
        ...acc,
        [curr.author_email]: `[${curr.author_name}](mailto:${curr.author_email})`,
      }),
      {},
    )

    return {
      tag,
      log: filteredLog,
      authors: Object.values(authors),
      urlToGitDiff: getCompareLink(provider, gitUrl, lowerTag, tag),
    }
  })

  const result = await Promise.all(tagsWithLog)

  const changelog: string[] = []

  changelog.push('# Changelog')

  result.forEach((a) => {
    changelog.push('\n')
    changelog.push(`## [${a.tag}](${a.urlToGitDiff})\n`)

    const logs = a.log as DefaultLogFields[]

    logs.forEach((b) => {
      changelog.push(
        `* ${b.message} \[[${b.hash}](${getCommitLink(
          provider,
          gitUrl,
          b.hash,
        )})\]`,
      )
    })
  })

  writeFileSync(outputFile, changelog.join('\n'))

  console.log('Changelog has been generated sucessfully.')
}
