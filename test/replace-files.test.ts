import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTmp, makeTmpDir } from './helpers'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

import { join } from 'node:path'
import { replaceVersionInCommonFiles } from '../lib/version'

const MANIFEST = 'package.json'

const readJson = (file: string): Record<string, unknown> =>
  JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>

describe('replaceVersionInCommonFiles', () => {
  const original = process.cwd()
  let dir = ''

  beforeEach(() => {
    dir = makeTmpDir()
  })
  afterEach(() => process.chdir(original))
  afterAll(() => cleanupTmp())

  it('bumps matched files and ignores node_modules', () => {
    writeFileSync(
      join(dir, MANIFEST),
      `${JSON.stringify(
        { name: 'x', version: '1.0.0', dependencies: { dep: '1.0.0' } },
        null,
        2,
      )  }\n`,
    )
    mkdirSync(join(dir, 'node_modules', 'foo'), { recursive: true })
    writeFileSync(
      join(dir, 'node_modules', 'foo', MANIFEST),
      `${JSON.stringify({ name: 'foo', version: '1.0.0' })  }\n`,
    )

    process.chdir(dir)
    const results = replaceVersionInCommonFiles('2.0.0')

    expect(readJson(join(dir, MANIFEST)).version).toBe('2.0.0')
    expect(
      (readJson(join(dir, MANIFEST)).dependencies as { dep: string }).dep,
    ).toBe('1.0.0')
    // node_modules excluded by IGNORED_GLOBS
    expect(
      readJson(join(dir, 'node_modules', 'foo', MANIFEST)).version,
    ).toBe('1.0.0')
    const hasNodeModules = results.some((r) => r.file.includes('node_modules'))
    expect(hasNodeModules).toBe(false)
  })

  it('matches nested workspace manifests via globs', () => {
    mkdirSync(join(dir, 'packages', 'a'), { recursive: true })
    writeFileSync(
      join(dir, 'packages', 'a', MANIFEST),
      `${JSON.stringify({ name: 'a', version: '1.0.0' }, null, 2)  }\n`,
    )

    process.chdir(dir)
    replaceVersionInCommonFiles('3.1.0')

    expect(readJson(join(dir, 'packages', 'a', MANIFEST)).version).toBe(
      '3.1.0',
    )
  })

  it('does not throw when no manifest files exist', () => {
    process.chdir(dir)
    expect(() => replaceVersionInCommonFiles('2.0.0')).not.toThrow()
  })
})

// One fixture per ECOSYSTEMS row, so a typo in a glob or key-path fails loudly
// instead of silently doing nothing.
const FIXTURES: { file: string; content: string; expected: string }[] = [
  { file: 'package.json', content: '{\n  "version": "1.0.0"\n}\n', expected: '"version": "9.9.9"' },
  {
    file: 'package-lock.json',
    content: '{\n  "version": "1.0.0",\n  "packages": {\n    "": {\n      "version": "1.0.0"\n    }\n  }\n}\n',
    expected: '"version": "9.9.9"',
  },
  { file: 'composer.json', content: '{\n  "version": "1.0.0"\n}\n', expected: '"version": "9.9.9"' },
  { file: 'deno.json', content: '{\n  "version": "1.0.0"\n}\n', expected: '"version": "9.9.9"' },
  { file: 'lerna.json', content: '{\n  "version": "1.0.0"\n}\n', expected: '"version": "9.9.9"' },
  { file: 'tauri.conf.json', content: '{\n  "version": "1.0.0"\n}\n', expected: '"version": "9.9.9"' },
  { file: 'app.json', content: '{\n  "expo": {\n    "version": "1.0.0"\n  }\n}\n', expected: '"version": "9.9.9"' },
  { file: 'manifest.json', content: '{\n  "version": "1.0.0"\n}\n', expected: '"version": "9.9.9"' },
  { file: 'Cargo.toml', content: '[package]\nversion = "1.0.0"\n', expected: 'version = "9.9.9"' },
  { file: 'pyproject.toml', content: '[project]\nversion = "1.0.0"\n', expected: 'version = "9.9.9"' },
  { file: 'pixi.toml', content: '[project]\nversion = "1.0.0"\n', expected: 'version = "9.9.9"' },
  { file: 'Chart.yaml', content: 'version: 0.1.0\nappVersion: 1.0.0\n', expected: 'appVersion: 9.9.9' },
  { file: 'pubspec.yaml', content: 'version: 1.0.0\n', expected: 'version: 9.9.9' },
  { file: 'galaxy.yml', content: 'version: 1.0.0\n', expected: 'version: 9.9.9' },
  { file: 'CITATION.cff', content: 'version: 1.0.0\n', expected: 'version: 9.9.9' },
  { file: 'snapcraft.yaml', content: 'version: 1.0.0\n', expected: 'version: 9.9.9' },
  {
    file: 'pom.xml',
    content: '<project>\n  <version>1.0.0</version>\n</project>\n',
    expected: '<version>9.9.9</version>',
  },
  {
    file: 'app.csproj',
    content: '<Project>\n  <PropertyGroup>\n    <Version>1.0.0</Version>\n  </PropertyGroup>\n</Project>\n',
    expected: '<Version>9.9.9</Version>',
  },
  {
    file: 'app.nuspec',
    content: '<package>\n  <metadata>\n    <version>1.0.0</version>\n  </metadata>\n</package>\n',
    expected: '<version>9.9.9</version>',
  },
  { file: '__init__.py', content: '__version__ = "1.0.0"\n', expected: '__version__ = "9.9.9"' },
  { file: 'setup.py', content: 'setup(version="1.0.0")\n', expected: 'version="9.9.9"' },
  { file: 'setup.cfg', content: '[metadata]\nversion = 1.0.0\n', expected: 'version = 9.9.9' },
  { file: 'app.gemspec', content: "spec.version = '1.0.0'\n", expected: "spec.version = '9.9.9'" },
  { file: 'version.rb', content: "  VERSION = '1.0.0'\n", expected: "VERSION = '9.9.9'" },
  { file: 'app.podspec', content: "s.version = '1.0.0'\n", expected: "s.version = '9.9.9'" },
  { file: 'mix.exs', content: '      version: "1.0.0",\n', expected: 'version: "9.9.9"' },
  { file: 'build.gradle', content: "version = '1.0.0'\n", expected: "version = '9.9.9'" },
  { file: 'gradle.properties', content: 'version=1.0.0\n', expected: 'version=9.9.9' },
  { file: 'app.spec', content: 'Version:        1.0.0\n', expected: 'Version:        9.9.9' },
  { file: 'PKGBUILD', content: 'pkgver=1.0.0\n', expected: 'pkgver=9.9.9' },
  { file: 'VERSION', content: '1.0.0\n', expected: '9.9.9' },
]

describe('ECOSYSTEMS coverage', () => {
  const original = process.cwd()
  let dir = ''

  // Every fixture lives in one tree, so a single pass exercises the whole table
  // and would also surface any cross-ecosystem glob collision.
  beforeEach(() => {
    dir = makeTmpDir()
    for (const { file, content } of FIXTURES) writeFileSync(join(dir, file), content)
    process.chdir(dir)
    replaceVersionInCommonFiles('9.9.9')
  })
  afterEach(() => process.chdir(original))
  afterAll(() => cleanupTmp())

  it.each(FIXTURES)('bumps $file', ({ file, expected }) => {
    expect(readFileSync(join(dir, file), 'utf8')).toContain(expected)
  })

  it('leaves the Helm chart version alone, bumping only appVersion', () => {
    expect(readFileSync(join(dir, 'Chart.yaml'), 'utf8')).toContain('version: 0.1.0')
  })
})
