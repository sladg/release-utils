# Release utils

This package exposes two CLI functions intended to deal with versioning your application and releasing.

Motivation behind is to get rid of huge dependencies and over-kill implementations such as @auto-it, release-it or semver. Those are bulky and unncessarily complex.

## TL;DR

`npx @sladg/release-utils help`

## Guess

Simple CLI command that takes commit message and current version and outputs (stdout) next version based on keywords inside commit message.

## Shipit

Similar to guess command, however, it automatically tags a commit on current branch and creates release branch for you so hooking up pipelines is as simple as it can be. Version is automatically bumped in common NPM and PHP files (package.json, package-lock.json and composer.json).

Simply call `@sladg/release-utils shipit` on any branch and be done.

## Changelog

Simple utility that compares two tags and outputs commits between those two tags. It's intended to be used in CI/CD pipelines to generate changelog for release notes. If you are using using `shipit` command, use `--changelog` flag instead.
