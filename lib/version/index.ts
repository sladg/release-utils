import { readFileSync, writeFileSync } from 'fs'
import { globSync } from 'tinyglobby'

import { applyJson } from './json'
import { applyPlain } from './plain'
import { applyText } from './text'
import { applyToml } from './toml'
import type { VersionApplier, VersionFileRule, VersionFormat } from './types'
import { applyYaml } from './yaml'

const VERSION_APPLIERS: Record<VersionFormat, VersionApplier> = {
  json: applyJson,
  toml: applyToml,
  yaml: applyYaml,
  text: applyText,
  plain: applyPlain,
}

// Single declarative table mapping file globs to where the version lives.
// Extend support for a new language by adding a row — no per-file code.
const versionFiles: ReadonlyArray<VersionFileRule> = [
  // --- JSON (native, nested-safe) ---
  {
    files: ['package.json', '**/package.json'],
    format: 'json',
    paths: [['version']],
  },
  {
    files: ['package-lock.json', '**/package-lock.json'],
    format: 'json',
    paths: [['version'], ['packages', '', 'version']],
  },
  {
    files: ['composer.json', '**/composer.json'],
    format: 'json',
    paths: [['version']],
  },
  // Deno / JSR registry manifests.
  {
    files: ['deno.json', '**/deno.json', 'jsr.json', '**/jsr.json'],
    format: 'json',
    paths: [['version']],
  },
  // Lerna monorepo (fixed-version mode).
  {
    files: ['lerna.json', '**/lerna.json'],
    format: 'json',
    paths: [['version']],
  },
  // Tauri (v2 → top-level version, v1 → package.version).
  {
    files: ['tauri.conf.json', '**/tauri.conf.json'],
    format: 'json',
    paths: [['version'], ['package', 'version']],
  },
  // --- TOML ---
  // Cargo: single crate (package.version) or workspace inheritance.
  {
    files: ['Cargo.toml', '**/Cargo.toml'],
    format: 'toml',
    paths: [
      ['package', 'version'],
      ['workspace', 'package', 'version'],
    ],
  },
  {
    files: ['pyproject.toml', '**/pyproject.toml'],
    format: 'toml',
    paths: [
      ['project', 'version'],
      ['tool', 'poetry', 'version'],
    ],
  },
  // --- YAML (comment-preserving) ---
  {
    files: ['Chart.yaml', '**/Chart.yaml'],
    format: 'yaml',
    paths: [['version'], ['appVersion']],
  },
  // Dart / Flutter.
  {
    files: ['pubspec.yaml', '**/pubspec.yaml'],
    format: 'yaml',
    paths: [['version']],
  },
  // Ansible collections + Citation File Format.
  {
    files: ['galaxy.yml', '**/galaxy.yml', 'CITATION.cff', '**/CITATION.cff'],
    format: 'yaml',
    paths: [['version']],
  },
  // --- Free-form source (identifier-anchored) ---
  { files: ['**/__init__.py'], format: 'text', paths: [['__version__']] },
  // --- Whole-file version (replaced only if it already looks like a version) ---
  {
    files: ['VERSION', '**/VERSION', 'version.txt', '**/version.txt'],
    format: 'plain',
    paths: [],
  },
]

const IGNORED_GLOBS = [
  '**/node_modules/**',
  '**/.venv/**',
  '**/vendor/**',
  '**/.git/**',
]

export const replaceVersionInCommonFiles = (newVersion: string) =>
  versionFiles.reduce<{ file: string; changed: boolean }[]>((results, rule) => {
    const matches = globSync(rule.files, { ignore: IGNORED_GLOBS })
    const ruleResults = matches.map((file) => {
      try {
        const text = readFileSync(file, 'utf-8')
        const { content, changed } = VERSION_APPLIERS[rule.format](
          text,
          rule.paths,
          newVersion,
        )
        if (changed) writeFileSync(file, content)
        return { file, changed }
      } catch (e) {
        // A malformed file in a monorepo should not abort the whole release.
        console.warn(`Skipping ${file} - could not update version:`, e)
        return { file, changed: false }
      }
    })
    return results.concat(ruleResults)
  }, [])
