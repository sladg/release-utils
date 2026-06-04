import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

import { replaceVersionInCommonFiles } from '../lib/version'
import { cleanupTmp, makeTmpDir } from './helpers'

const MANIFEST = 'package.json'

const readJson = (file: string): { [k: string]: unknown } =>
  JSON.parse(readFileSync(file, 'utf-8'))

describe('replaceVersionInCommonFiles', () => {
  const original = process.cwd()
  let dir: string

  beforeEach(() => {
    dir = makeTmpDir()
  })
  afterEach(() => process.chdir(original))
  afterAll(() => cleanupTmp())

  it('bumps matched files and ignores node_modules', () => {
    writeFileSync(
      path.join(dir, MANIFEST),
      JSON.stringify(
        { name: 'x', version: '1.0.0', dependencies: { dep: '1.0.0' } },
        null,
        2,
      ) + '\n',
    )
    mkdirSync(path.join(dir, 'node_modules', 'foo'), { recursive: true })
    writeFileSync(
      path.join(dir, 'node_modules', 'foo', MANIFEST),
      JSON.stringify({ name: 'foo', version: '1.0.0' }) + '\n',
    )

    process.chdir(dir)
    const results = replaceVersionInCommonFiles('2.0.0')

    expect(readJson(path.join(dir, MANIFEST)).version).toBe('2.0.0')
    expect(
      (readJson(path.join(dir, MANIFEST)).dependencies as { dep: string }).dep,
    ).toBe('1.0.0')
    // node_modules excluded by IGNORED_GLOBS
    expect(
      readJson(path.join(dir, 'node_modules', 'foo', MANIFEST)).version,
    ).toBe('1.0.0')
    expect(results.some((r) => r.file.includes('node_modules'))).toBe(false)
  })

  it('matches nested workspace manifests via globs', () => {
    mkdirSync(path.join(dir, 'packages', 'a'), { recursive: true })
    writeFileSync(
      path.join(dir, 'packages', 'a', MANIFEST),
      JSON.stringify({ name: 'a', version: '1.0.0' }, null, 2) + '\n',
    )

    process.chdir(dir)
    replaceVersionInCommonFiles('3.1.0')

    expect(readJson(path.join(dir, 'packages', 'a', MANIFEST)).version).toBe(
      '3.1.0',
    )
  })

  it('does not throw when no manifest files exist', () => {
    process.chdir(dir)
    expect(() => replaceVersionInCommonFiles('2.0.0')).not.toThrow()
  })
})
