#!/usr/bin/env node

import { Command } from 'commander'
import path from 'path'

import packageJson from '../package.json'
import { changelogHandler } from './cli/changelog'
import { guessHandler } from './cli/guess'
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
  .action(async (commitMessage, latestVersion, options) => {
    console.log('Our config is: ', options)
    const { tagPrefix } = options
    wrapProcess(guessHandler({ commitMessage, latestVersion, tagPrefix }))
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
    '-a, --autoPush',
    'This will automatically create release branch and tag commit in master.',
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
  .option('--changelog', 'Generate changelog.', false)
  .action(async (options) => {
    console.log('Our config is: ', options)
    const {
      tagPrefix,
      failOnMissingCommit,
      failOnMissingTag,
      releaseBranchPrefix,
      forceBump,
      gitUser,
      gitEmail,
      changelog,
    } = options
    wrapProcess(
      shipitHandler({
        tagPrefix,
        gitEmail,
        gitUser,
        failOnMissingCommit,
        failOnMissingTag,
        forceBump,
        releaseBranchPrefix,
        generateChangelog: changelog,
        changelogPath: path.resolve(commandCwd, './CHANGELOG.md'),
      }),
    )
  })

program
  .command('changelog')
  .description('Generate changelog from Git, assuming tag being a release.')
  .option(
    '--outputFile <path>',
    'Path to file where changelog should be written.',
    path.resolve(commandCwd, './CHANGELOG.md'),
  )
  .option('--gitBaseUrl <url>', 'Absolute URL to your git project', undefined)
  .action(async (options) => {
    console.log('Our config is: ', options)
    const { outputFile, gitBaseUrl } = options
    wrapProcess(changelogHandler({ outputFile, gitBaseUrl }))
  })

program
  .command('commit')
  //
  .description('Commit changes to git.')
  .option('')
  .action(async () => {
    //
  })

program.parse(process.argv)
