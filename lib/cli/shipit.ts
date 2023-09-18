import { simpleGit } from 'simple-git'

import { skipCiFlag } from '../consts'
import {
  bumpCalculator,
  bumpMapping,
  BumpType,
  findHighestTag,
  getTagsWithFallback,
  isValidTag,
  replaceVersionInCommonFiles,
} from '../utils'
import { changelogHandler } from './changelog'

interface Props {
  gitUser: string
  gitEmail: string
  tagPrefix: string
  failOnMissingCommit: boolean
  failOnMissingTag: boolean
  releaseBranchPrefix: string
  forceBump: boolean
  generateChangelog: boolean
  changelogPath: string
}

export const shipitHandler = async ({
  gitEmail,
  gitUser,
  tagPrefix,
  failOnMissingCommit,
  failOnMissingTag,
  forceBump,
  releaseBranchPrefix,
  generateChangelog,
  changelogPath,
}: Props) => {
  const gitWithoutAuthor = simpleGit()
  const git = gitWithoutAuthor
    .addConfig('user.name', gitUser)
    .addConfig('user.email', gitEmail)

  // Fetch tags to ensure we have the latest ones.
  const tags = await getTagsWithFallback(git)
  const log = await git.log({ '--max-count': 200 })
  const branch = await git.branch()
  const [remote] = await git.getRemotes()

  const latestCommit = log.latest?.hash

  const latestTag = findHighestTag(tags.all) ?? '0.0.0'
  console.log('Current version: ', latestTag)

  const currentTag = latestTag.replace(tagPrefix, '')
  console.log('Latest commit: ', latestCommit)

  if (!isValidTag(latestTag, tagPrefix)) {
    throw new Error(`Invalid tag found - ${latestTag}!`)
  }

  if (!latestCommit) {
    throw new Error('Latest commit was not found!')
  }

  // @TODO: Fetch all in case from is 0.0.0 (non-existent).
  const commits = await git.log({
    from: tags.latest,
    to: latestCommit,
  })

  if (commits.total < 1 && failOnMissingCommit) {
    throw new Error('No new commits since last tag.')
  }

  const bumps: BumpType[] = []

  commits.all.forEach(({ message, body }) => {
    const match = bumpMapping.find(({ test, scanBody }) =>
      (scanBody ? `${body}\n${message}` : message).match(test),
    )
    if (!match) {
      console.warn(`Invalid commit, cannot match bump - ${message}!`)
    } else {
      bumps.push(match?.bump)
    }
  })

  console.log('Bumps: ', bumps)

  // Bump patch in case nothing is found.
  if (bumps.length < 1 && forceBump) {
    console.log('Forcing patch bump!')
    bumps.push(BumpType.Patch)
  }

  const nextTag = bumps.reduce(
    (acc, curr) => bumpCalculator(acc, curr),
    currentTag,
  )
  const nextTagWithPrefix = tagPrefix + nextTag
  const releaseBranch = `${releaseBranchPrefix}${nextTagWithPrefix}`
  console.log(`Next version is - ${nextTagWithPrefix}!`)

  if (currentTag === nextTag) {
    throw new Error('Failed to bump version!')
  }

  const replacementResults = replaceVersionInCommonFiles(currentTag, nextTag)
  console.log(`Replaced version in files.`, replacementResults)

  // If flag is passed, changelog is generated and added.
  if (generateChangelog) {
    console.log('Generating changelog...')
    await changelogHandler({
      outputFile: changelogPath,
      nextTag: nextTagWithPrefix,
    })
  }

  // Commit changed files (versions) and create a release commit with skip ci flag.
  await git
    //
    .add('./*')
    .commit(`Release: ${nextTagWithPrefix} ${skipCiFlag}`)
    .addTag(nextTagWithPrefix)

  await git.push(remote.name, branch.current).pushTags()

  // As current branch commit includes skip ci flag, we want to ommit this flag for release branch so pipeline can run (omitting infinite loop).
  // So we are overwriting last commit message and pushing to release branch.
  await git
    //
    .raw('commit', '--message', `Release: ${nextTagWithPrefix}`, '--amend')
    .push(remote.name, `${branch.current}:${releaseBranch}`)

  // @Note: CI/CD should not be listening for tags in master, it should listen to release branch.
  // @TODO: Include commits and commit bodies in release commit so Jira can pick it up.

  console.log(`Successfuly tagged and created new branch - ${releaseBranch}`)
}
