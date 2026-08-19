#!/usr/bin/env node

import { Command } from 'commander'
import { changelogHandler } from './cli/changelog'
import { commitHandler } from './cli/commit'
import { guessHandler } from './cli/guess'
import packageJson from '../package.json'
import { resolve } from 'node:path'
import { shipitHandler } from './cli/shipit'
import { wrapProcess } from './utils'

const commandCwd = process.cwd()
const program = new Command()

program
  //
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version)

program
  .command('guess')
  .description(
    'Calculate next version based on last version and commit message.',
  )
  .argument('<commitMessage>', 'Commit message to use for guessing bump.')
  .argument(
    '<latestVersion>',
    'Your existing app version which should be used for calculation of next version.',
  )
  .option(
    '-t, --tagPrefix <prefix>',
    'Prefix version with string of your choice',
    'v',
  )
  .action(async (commitMessage: string, latestVersion: string, options: { tagPrefix: string }) => {
    const { tagPrefix } = options
    await wrapProcess(() => guessHandler({ commitMessage, latestVersion, tagPrefix }))
  })

program
  .command('shipit')
  .description(
    'Get last tag, calculate bump version for all commits that happened and create release branch.',
  )
  .option(
    '--failOnMissingCommit',
    'In case commit has not happened since last tag (aka. we are on latest tag) fail.',
    Boolean,
    true,
  )
  .option(
    '--failOnMissingTag',
    'In case no tags exist that are in semver version format fail.',
    false,
  )
  .option(
    '-f, --forceBump',
    'In case no compatible commits found, use patch as fallback and ensure bump happens.',
    Boolean,
    true,
  )
  .option(
    '-t, --tagPrefix <prefix>',
    'Prefix version with string of your choice.',
    'v',
  )
  .option(
    '-r, --releaseBranchPrefix <prefix>',
    'Prefix for release branch fork.',
    'release/',
  )
  .option('--gitUser <user>', 'User name to be used for commits.', 'Bender')
  .option(
    '--gitEmail <email>',
    'User email to be used for commits.',
    'bender@bot.eu',
  )
  .option(
    '--branchPrefixes <prefix01>,<prefix02>',
    'Comma separated list of prefixes; one release branch is created per prefix.',
    '',
  )
  .option('--changelog', 'Generate changelog.', false)
  .action(async (options: {
    tagPrefix: string; failOnMissingCommit: boolean; failOnMissingTag: boolean
    releaseBranchPrefix: string; forceBump: boolean; gitUser: string; gitEmail: string
    changelog: boolean; branchPrefixes: string
  }) => {
    const {
      tagPrefix,
      failOnMissingCommit,
      failOnMissingTag,
      releaseBranchPrefix,
      forceBump,
      gitUser,
      gitEmail,
      changelog,
      branchPrefixes,
    } = options
    await wrapProcess(() =>
      shipitHandler({
        tagPrefix,
        gitEmail,
        gitUser,
        failOnMissingCommit,
        failOnMissingTag,
        forceBump,
        releaseBranchPrefix,
        generateChangelog: changelog,
        branchPrefixes: branchPrefixes.split(','),
        changelogPath: resolve(commandCwd, './CHANGELOG.md'),
      }),
    )
  })

program
  .command('changelog')
  .description('Generate changelog from Git, assuming tag being a release.')
  .option(
    '--outputFile <path>',
    'Path to file where changelog should be written.',
    resolve(commandCwd, './CHANGELOG.md'),
  )
  .option('--gitBaseUrl <url>', 'Absolute URL to your git project')
  .action(async (options: { outputFile: string; gitBaseUrl?: string }) => {
    const { outputFile, gitBaseUrl } = options
    await wrapProcess(() =>
      changelogHandler(gitBaseUrl === undefined ? { outputFile } : { outputFile, gitBaseUrl }),
    )
  })

program
  .command('commit')
  .description('Commit changes to git.')
  .option('--cwd <path>', 'Path to your project.', commandCwd)
  .action(async (options: { cwd: string }) => {
    const { cwd } = options
    await wrapProcess(() => {
      commitHandler({ cwd })
    })
  })

await program.parseAsync(process.argv)
