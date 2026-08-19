import type { LogResult, SimpleGit } from 'simple-git'
import { detectGitRemoteFromEnv, getCommitLink, getCompareLink, providerFromUrl, sortTagsDescending } from '../utils'

import type { GitProvider } from '../utils'
import { is } from '@sladg/what-that'
import { releaseCommitPrefix } from '../consts'
import { simpleGit } from 'simple-git'
import { writeFileSync } from 'node:fs'

export interface ChangelogHandlerProps {
  outputFile: string
  gitBaseUrl?: string
  nextTag?: string
}

interface RemoteInfo { provider: GitProvider; gitUrl: string }

const resolveRemote = (gitBaseUrl: string | undefined): RemoteInfo => {
  const fromEnv = detectGitRemoteFromEnv()
  const gitUrl = gitBaseUrl ?? fromEnv?.url
  if (!is.string(gitUrl)) throw new Error('Could not determine git base URL!')
  let provider = fromEnv?.provider
  if (is.string(gitBaseUrl)) provider = providerFromUrl(gitBaseUrl) ?? undefined
  if (!is.string(provider)) {
    throw new Error(
      `Could not determine git provider from "${gitUrl}". Supported: GitHub, GitLab, Bitbucket. Pass a recognizable --gitBaseUrl or run inside CI.`,
    )
  }
  return { provider, gitUrl }
}

interface TagCtx {
  tag: string
  index: number
  arr: string[]
  git: SimpleGit
  commits: LogResult
  sortedTags: string[]
  provider: GitProvider
  gitUrl: string
}

const processTag = async ({ tag, index, arr, git, commits, sortedTags, provider, gitUrl }: TagCtx) => {
  const lowerTag = arr[index + 1]
  const upper = sortedTags.includes(tag) ? tag : commits.latest?.hash

  // A tag section covers `(previous, this]`, which is git's `a..b`. simple-git's
  // from/to would emit the symmetric `a...b`, and with no `from` the nonsensical
  // `HEAD...b`, so the revision range is built here instead. The oldest tag has
  // no lower bound: `git log <tag>` walks back to the root commit and includes it.
  const revisions = is.string(lowerTag) ? `${lowerTag}..${upper}` : upper
  const log = is.string(revisions) ? await git.log({ [revisions]: null }) : { all: [] }
  const filteredLog = log.all
    // Remove automatic commits (typically generated inside pipeline)
    .filter((a) => !a.message.includes('[skip ci]'))
    // Remove release commits (typically previous release). Anchored on the exact
    // prefix this tool writes, so "feat(release): support v1.2.3" is kept.
    .filter((a) => !a.message.trimStart().startsWith(releaseCommitPrefix))

  return {
    tag,
    log: filteredLog,
    urlToGitDiff: getCompareLink({ provider, remoteUrl: gitUrl, previous: lowerTag ?? '', next: tag }),
  }
}

type TagEntry = Awaited<ReturnType<typeof processTag>>

const renderChangelog = (result: TagEntry[], provider: GitProvider, gitUrl: string) => {
  const lines = ['# Changelog']
  for (const a of result) {
    lines.push('\n', `## [${a.tag}](${a.urlToGitDiff})\n`)
    for (const b of a.log) {
      lines.push(`* ${b.message} [[${b.hash}](${getCommitLink(provider, gitUrl, b.hash)})]`)
    }
  }
  return lines.join('\n')
}

export const changelogHandler = async ({ outputFile, gitBaseUrl, nextTag }: ChangelogHandlerProps) => {
  const git = simpleGit()
  const { provider, gitUrl } = resolveRemote(gitBaseUrl)

  await git.fetch(['--tags'])
  const tags = await git.tags()
  const commits = await git.log()
  const sortedTags = sortTagsDescending(tags.all)

  const normalizedTags = [...sortedTags]
  if (is.string(nextTag)) normalizedTags.unshift(nextTag)

  const entries = await Promise.all(
    normalizedTags.map((tag, index, arr) =>
      processTag({ tag, index, arr, git, commits, sortedTags, provider, gitUrl }),
    ),
  )

  writeFileSync(outputFile, renderChangelog(entries, provider, gitUrl))
  console.log('Changelog has been generated sucessfully.')
}
