import type { Ecosystem } from './version/types'

// THE table. One row per ecosystem, holding everything we know about it:
// which files carry the version, how to parse them, where the version sits,
// and which lockfile must be regenerated afterwards.
//
// Adding support for a language means adding a row here and nothing else.
//
// Conventions:
// - `files[0]` is the canonical manifest basename; it doubles as the lockfile
//   trigger, so ecosystems with a `lockfile` must not start with a glob.
// - `paths` are tried independently and written only where they already exist,
//   so listing several layouts for one file is free.
// - `lockfile` managers are ordered by preference; the first whose `detect`
//   file exists wins, so two managers never both run for one ecosystem.
const ECOSYSTEMS: Record<string, Ecosystem> = {
  // --- JSON ---
  node: {
    files: ['package.json', '**/package.json'],
    format: 'json',
    paths: [['version']],
    lockfile: [
      { detect: 'bun.lock', cmd: 'bun install --lockfile-only' },
      { detect: 'bun.lockb', cmd: 'bun install --lockfile-only' },
      { detect: 'pnpm-lock.yaml', cmd: 'pnpm install --lockfile-only' },
      { detect: 'package-lock.json', cmd: 'npm install --package-lock-only' },
    ],
  },
  npmLockfile: {
    files: ['package-lock.json', '**/package-lock.json'],
    format: 'json',
    // Root entry of the lockfile mirrors the manifest version.
    paths: [['version'], ['packages', '', 'version']],
  },
  php: {
    files: ['composer.json', '**/composer.json'],
    format: 'json',
    paths: [['version']],
    lockfile: [{ detect: 'composer.lock', cmd: 'composer update --lock' }],
  },
  deno: {
    files: ['deno.json', '**/deno.json', 'deno.jsonc', '**/deno.jsonc', 'jsr.json', '**/jsr.json'],
    format: 'json',
    paths: [['version']],
  },
  lerna: {
    files: ['lerna.json', '**/lerna.json'],
    format: 'json',
    // Fixed-version mode only; independent mode leaves this at "independent".
    paths: [['version']],
  },
  tauri: {
    files: ['tauri.conf.json', '**/tauri.conf.json'],
    format: 'json',
    paths: [['version'], ['package', 'version']],
  },
  expo: {
    files: ['app.json', '**/app.json'],
    format: 'json',
    paths: [['expo', 'version']],
  },
  browserExtension: {
    files: ['manifest.json', '**/manifest.json'],
    format: 'json',
    paths: [['version']],
  },

  // --- TOML ---
  rust: {
    files: ['Cargo.toml', '**/Cargo.toml'],
    format: 'toml',
    paths: [
      ['package', 'version'],
      ['workspace', 'package', 'version'],
    ],
    lockfile: [{ cmd: 'cargo update --workspace' }],
  },
  python: {
    files: ['pyproject.toml', '**/pyproject.toml'],
    format: 'toml',
    paths: [
      ['project', 'version'],
      ['tool', 'poetry', 'version'],
      ['tool', 'commitizen', 'version'],
    ],
    lockfile: [
      { detect: 'uv.lock', cmd: 'uv lock' },
      { detect: 'poetry.lock', cmd: 'poetry lock' },
      { detect: 'pdm.lock', cmd: 'pdm lock' },
    ],
  },
  pixi: {
    files: ['pixi.toml', '**/pixi.toml'],
    format: 'toml',
    paths: [['project', 'version'], ['workspace', 'version']],
  },
  // --- YAML ---
  helm: {
    files: ['Chart.yaml', '**/Chart.yaml'],
    format: 'yaml',
    // Chart `version` tracks template changes, not app releases — only
    // appVersion follows the app semver.
    paths: [['appVersion']],
  },
  dart: {
    files: ['pubspec.yaml', '**/pubspec.yaml'],
    format: 'yaml',
    paths: [['version']],
  },
  ansible: {
    files: ['galaxy.yml', '**/galaxy.yml'],
    format: 'yaml',
    paths: [['version']],
  },
  citation: {
    files: ['CITATION.cff', '**/CITATION.cff'],
    format: 'yaml',
    paths: [['version']],
  },
  snapcraft: {
    files: ['snapcraft.yaml', '**/snapcraft.yaml', 'snap/snapcraft.yaml'],
    format: 'yaml',
    paths: [['version']],
  },

  // --- XML ---
  maven: {
    files: ['pom.xml', '**/pom.xml'],
    format: 'xml',
    // In a multi-module repo the parent is the in-repo aggregator, so its
    // coordinate in each module has to move with the release.
    paths: [
      ['project', 'version'],
      ['project', 'parent', 'version'],
    ],
  },
  dotnet: {
    files: [
      '**/*.csproj',
      '**/*.vbproj',
      '**/*.fsproj',
      '**/Directory.Build.props',
    ],
    format: 'xml',
    paths: [
      ['Project', 'PropertyGroup', 'Version'],
      ['Project', 'PropertyGroup', 'VersionPrefix'],
    ],
  },
  nuget: {
    files: ['**/*.nuspec'],
    format: 'xml',
    paths: [['package', 'metadata', 'version']],
  },

  // --- Identifier-anchored source ---
  pythonModule: {
    files: ['**/__init__.py', '**/_version.py', '**/version.py'],
    format: 'text',
    paths: [['__version__'], ['VERSION']],
  },
  pythonSetup: {
    files: ['setup.py', '**/setup.py', 'setup.cfg', '**/setup.cfg'],
    format: 'text',
    paths: [['version']],
  },
  ruby: {
    files: ['**/*.gemspec', '**/version.rb'],
    format: 'text',
    paths: [['version'], ['VERSION']],
  },
  cocoapods: {
    files: ['**/*.podspec'],
    format: 'text',
    paths: [['version']],
  },
  elixir: {
    files: ['mix.exs', '**/mix.exs'],
    format: 'text',
    paths: [['version']],
    lockfile: [{ detect: 'mix.lock', cmd: 'mix deps.get' }],
  },
  gradle: {
    files: [
      'build.gradle',
      '**/build.gradle',
      'build.gradle.kts',
      '**/build.gradle.kts',
      'gradle.properties',
      '**/gradle.properties',
    ],
    format: 'text',
    paths: [['version']],
  },
  rpm: {
    files: ['**/*.spec'],
    format: 'text',
    paths: [['Version']],
  },
  arch: {
    files: ['PKGBUILD', '**/PKGBUILD'],
    format: 'text',
    paths: [['pkgver']],
  },

  // --- Whole-file version ---
  plainVersion: {
    files: ['VERSION', '**/VERSION', 'version.txt', '**/version.txt'],
    format: 'plain',
    paths: [],
  },
}

const IGNORED_GLOBS = [
  '**/node_modules/**',
  '**/.venv/**',
  '**/venv/**',
  '**/vendor/**',
  '**/target/**',
  '**/bin/**',
  '**/obj/**',
  '**/dist/**',
  '**/.git/**',
]

export { ECOSYSTEMS, IGNORED_GLOBS }
