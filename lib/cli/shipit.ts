import {
  BumpType,
  bumpCalculator,
  bumpMapping,
  findHighestTag,
  getTags,
  isValidTag,
} from '../utils'

import { releaseCommitPrefix, skipCiFlag } from '../consts'
import { changelogHandler } from './changelog'
import { is } from '@sladg/what-that'
import { regenerateLockfiles } from './lockfiles'
import { replaceVersionInCommonFiles } from '../version'
import { simpleGit } from 'simple-git'

export interface ShipitHandlerProps {
  gitUser: string
  gitEmail: string
  tagPrefix: string
  failOnMissingCommit: boolean
  failOnMissingTag: boolean
  releaseBranchPrefix: string
  forceBump: boolean
  generateChangelog: boolean
  changelogPath: string
  branchPrefixes: string[]
}

const getTestStr = (message: string, body: string, scanBody?: boolean) => {
  if (scanBody !== true) return message
  return `${body}\n${message}`
}

const calculateBumps = (
  commits: { all: readonly { message: string; body: string }[] },
  forceBump: boolean,
): BumpType[] => {
  const bumps: BumpType[] = []
  for (const { message, body } of commits.all) {
    const match = bumpMapping.find(({ test, scanBody }) => getTestStr(message, body, scanBody).match(test))
    if (match) {
      bumps.push(match.bump)
    } else {
      console.warn(`Invalid commit, cannot match bump - ${message}!`)
    }
  }
  if (bumps.length === 0 && forceBump) {
    console.log('Forcing patch bump!')
    bumps.push(BumpType.Patch)
  }
  return bumps
}

const buildBranchName = (releaseBranchPrefix: string, branchPrefix: string, tag: string) => {
  let prefix = ''
  if (branchPrefix.length > 0) prefix = `${branchPrefix}-`
  return `${releaseBranchPrefix}${prefix}${tag}`
}

const fetchReleaseContext = async ({
  git,
  tagPrefix,
  failOnMissingTag,
  failOnMissingCommit,
}: {
  git: ReturnType<typeof simpleGit>
  tagPrefix: string
  failOnMissingTag: boolean
  failOnMissingCommit: boolean
}) => {
  const tags = await getTags(git, failOnMissingTag)
  const log = await git.log({ '--max-count': 200 })
  const branch = await git.branch()
  const [remote] = await git.getRemotes()
  const latestCommit = log.latest?.hash
  const latestTag = findHighestTag(tags.all) ?? '0.0.0'
  const currentTag = latestTag.replace(tagPrefix, '')
  console.log('Current version:', latestTag)
  console.log('Latest commit:', latestCommit)
  if (!isValidTag(latestTag, tagPrefix)) throw new Error(`Invalid tag found - ${latestTag}!`)
  if (latestCommit === undefined) throw new Error('Latest commit was not found!')
  if (remote === undefined) throw new Error('No git remote configured!')
  // "Since the last tag" is `a..b` (exclusive of a). simple-git's from/to emits
  // the symmetric `a...b`, which differs once the history has merges.
  const revisions = is.string(tags.latest) ? `${tags.latest}..${latestCommit}` : latestCommit
  const commits = await git.log({ [revisions]: null })
  if (commits.total < 1 && failOnMissingCommit) throw new Error('No new commits since last tag.')
  return { tags, commits, branch, remote, latestTag, currentTag, latestCommit }
}

const publishRelease = async ({
  git,
  remote,
  branch,
  nextTagWithPrefix,
  releaseBranches,
}: {
  git: ReturnType<typeof simpleGit>
  remote: { name: string }
  branch: { current: string }
  nextTagWithPrefix: string
  releaseBranches: string[]
}) => {
  // Commit changed files (versions) and create a release commit with skip ci flag.
  await git
    .add('./*')
    .commit(`${releaseCommitPrefix} ${nextTagWithPrefix} ${skipCiFlag}`)
    .addTag(nextTagWithPrefix)
  await git.push(remote.name, branch.current).pushTags()
  if (releaseBranches.length === 0) return
  // As current branch commit includes skip ci flag, we want to ommit this flag for release branch so pipeline can run (omitting infinite loop).
  // So we are overwriting last commit message and pushing to release branches.
  await git.raw('commit', '--message', `${releaseCommitPrefix} ${nextTagWithPrefix}`, '--amend')
  await Promise.all(
    releaseBranches.map(async (releaseBranch) => {
      await git.push(remote.name, `${branch.current}:${releaseBranch}`)
      console.log(`Successfuly tagged and created new branch - ${releaseBranch}`)
    }),
  )
}

export const shipitHandler = async ({
  gitEmail, gitUser, tagPrefix, failOnMissingCommit, failOnMissingTag,
  forceBump, releaseBranchPrefix, generateChangelog, changelogPath, branchPrefixes,
}: ShipitHandlerProps) => {
  // Awaiting the chain would resolve to addConfig's string result, not the client.
  const git = simpleGit()
  await git.addConfig('user.name', gitUser)
  await git.addConfig('user.email', gitEmail)

  const { commits, branch, remote, currentTag } =
    await fetchReleaseContext({ git, tagPrefix, failOnMissingTag, failOnMissingCommit })

  const bumps = calculateBumps(commits, forceBump)
  const nextTag = bumps.reduce((acc, curr) => bumpCalculator(acc, curr), currentTag)
  const nextTagWithPrefix = tagPrefix + nextTag
  const releaseBranches = branchPrefixes.map((a) => buildBranchName(releaseBranchPrefix, a, nextTagWithPrefix))

  console.log(`Next version is - ${nextTagWithPrefix}!`)
  if (currentTag === nextTag) throw new Error('Failed to bump version!')

  const replacementResults = replaceVersionInCommonFiles(nextTag)
  console.log('Replaced version in files.', replacementResults)
  regenerateLockfiles(replacementResults.filter((r) => r.changed).map((r) => r.file), process.cwd())

  if (generateChangelog) {
    console.log('Generating changelog...')
    await changelogHandler({ outputFile: changelogPath, nextTag: nextTagWithPrefix })
  }

  await publishRelease({ git, remote, branch, nextTagWithPrefix, releaseBranches })

  // @Note: CI/CD should not be listening for tags in master, it should listen to release branch.
  // @TODO: Include commits and commit bodies in release commit so Jira can pick it up.
}
