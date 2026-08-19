# Usage

Detailed flags and examples for each command. For a quick overview see the [README](./README.md).

All commands run via:

```bash
npx --package @sladg/release-utils utils <command> [options]
```

## guess

Takes a commit message and the current version, prints the next version to **stdout** (and nothing else, so it's safe to capture).

```bash
# guess <commitMessage> <latestVersion>
npx --package @sladg/release-utils utils guess "feat: add login" v1.2.3
# -> v1.3.0

# Capture it in a pipeline:
NEXT=$(npx --package @sladg/release-utils utils guess "fix: typo" v1.2.3)
echo "$NEXT" # -> v1.2.4

# Custom tag prefix (default "v"):
npx --package @sladg/release-utils utils guess "feat: x" 1.2.3 --tagPrefix ""
# -> 1.3.0
```

## shipit

Calculates the next version from the commits since the last tag, bumps it across your manifest files (see below), tags the commit, and pushes the tag plus a release branch.

```bash
# Basic: bump, tag, push tag + a release/ branch.
npx --package @sladg/release-utils utils shipit \
  --gitUser "CI Bot" --gitEmail "ci@example.com"

# Also generate/update CHANGELOG.md as part of the release commit.
npx --package @sladg/release-utils utils shipit --changelog

# Monorepo: fork master into one release branch per app
# (-> release/api-v1.3.0 and release/web-v1.3.0).
npx --package @sladg/release-utils utils shipit --branchPrefixes "api,web"

# Fail instead of releasing when there is no semver tag yet.
npx --package @sladg/release-utils utils shipit --failOnMissingTag
```

Common flags:

| Flag                          | Default      | Description                                  |
| ----------------------------- | ------------ | -------------------------------------------- |
| `--tagPrefix <prefix>`        | `v`          | Prefix for tags.                             |
| `--releaseBranchPrefix <p>`   | `release/`   | Prefix for the release branch.               |
| `--branchPrefixes <a,b>`      | —            | Comma-separated; creates one branch each.    |
| `--changelog`                 | `false`      | Generate/update `CHANGELOG.md`.              |
| `--failOnMissingTag`          | `false`      | Fail if no semver tag exists yet.            |
| `--failOnMissingCommit`       | `true`       | Fail when there are no commits since the last tag. |
| `-f, --forceBump`             | `true`       | Fall back to a patch bump when no commit maps to one. |
| `--gitUser` / `--gitEmail`    | `Bender` / `bender@bot.eu` | Identity used for the release commit. |

### First release

With no semver tag in the repo, `shipit` starts from `0.0.0` and counts **every** commit in the history toward the bump — an untagged repo has nothing released yet, so nothing is excluded. The changelog gets a single section for the new tag containing the full history, linked to the tag's commit list rather than a compare.

Pass `--failOnMissingTag` to refuse to release instead.

## changelog

Generates a changelog from git tags. When using `shipit`, prefer its `--changelog` flag instead.

Commit and compare links are produced for GitHub, GitLab and Bitbucket. The provider/URL is detected from CI environment variables (authoritative for self-hosted instances); otherwise pass `--gitBaseUrl`.

```bash
# Inside CI (provider + URL auto-detected), write ./CHANGELOG.md:
npx --package @sladg/release-utils utils changelog

# Locally / outside CI, set the repo URL and a custom output path:
npx --package @sladg/release-utils utils changelog \
  --gitBaseUrl https://github.com/sladg/release-utils \
  --outputFile ./docs/CHANGELOG.md
```

## commit

Interactive replacement for `git commit` — launches a `commitizen` prompt (via `cz-emoji-conventional`) for type, scope and message, then creates the commit. No config files needed.

```bash
# Stage changes first, then run the prompt:
git add .
npx --package @sladg/release-utils utils commit

# Run against a different project directory:
npx --package @sladg/release-utils utils commit --cwd ../other-project
```

## Supported version files

`shipit` locates the version by a declarative path (not blind text replacement), so nested dependency versions are never touched — even when a dependency shares your app's version.

| Type  | Files | Location |
| ----- | ----- | -------- |
| JSON  | `package.json`, `package-lock.json`, `composer.json`, `deno.json(c)`, `jsr.json`, `lerna.json`, `tauri.conf.json`, `app.json` (Expo), `manifest.json` (browser extension) | `version` (plus lockfile root entry, `expo.version`, Tauri `package.version`) |
| TOML  | `Cargo.toml`, `pyproject.toml`, `pixi.toml` | `package.version` / `workspace.package.version`, `project.version` / `tool.poetry.version` / `tool.commitizen.version`, `project.version` / `workspace.version` |
| YAML  | `Chart.yaml`, `pubspec.yaml`, `galaxy.yml`, `CITATION.cff`, `snapcraft.yaml` | `version` (and `appVersion` for Helm) |
| XML   | `pom.xml`, `*.csproj` / `*.vbproj` / `*.fsproj`, `Directory.Build.props`, `*.nuspec` | `project.version` + `project.parent.version`, `Project.PropertyGroup.Version` / `VersionPrefix`, `package.metadata.version` |
| text  | `**/__init__.py`, `_version.py`, `version.py`, `setup.py`, `setup.cfg`, `*.gemspec`, `version.rb`, `*.podspec`, `mix.exs`, `build.gradle(.kts)`, `gradle.properties`, `*.spec` (RPM), `PKGBUILD` | identifier-anchored: `__version__`, `VERSION`, `version`, `Version`, `pkgver` |
| plain | `VERSION`, `version.txt` | whole file (only when it already looks like a version) |

Notes:

- Globs cover monorepos (e.g. nested `**/package.json`), excluding `node_modules`, `vendor`, `.venv`, `venv`, `target`, `bin`, `obj`, `dist` and `.git`.
- JSON keeps its indentation and YAML keeps its comments. TOML has no format-preserving editor in JS, so `Cargo.toml` / `pyproject.toml` are re-serialized (comments/layout are not preserved on bump).
- XML is edited by an element-path walk, not a regex, so a `<version>` under `<dependency>` or `<plugin>` is never touched.
- Identifier-anchored files accept `=` or `:` and quoted or bare values. A bare value is only replaced when what is already there looks like a version, so `version = project.version` is left alone.
- Helm charts bump `appVersion` only — the chart's own `version` tracks template changes, not app releases.
- Adding support for another file is a single row in `lib/ecosystems.ts` — no per-file code.

## Lockfile regeneration

After a version bump, `shipit` regenerates the lockfile for any ecosystem whose manifest changed. The first package manager whose lockfile is present wins, so two never run for the same ecosystem.

| Manifest | Detected lockfile → command |
| -------- | --------------------------- |
| `package.json` | `bun.lock(b)` → `bun install --lockfile-only`, `pnpm-lock.yaml` → `pnpm install --lockfile-only`, `package-lock.json` → `npm install --package-lock-only` |
| `Cargo.toml` | always → `cargo update --workspace` |
| `pyproject.toml` | `uv.lock` → `uv lock`, `poetry.lock` → `poetry lock --no-update`, `pdm.lock` → `pdm lock` |
| `composer.json` | `composer.lock` → `composer update --lock` |
| `mix.exs` | `mix.lock` → `mix deps.get` |

Go is absent by design, not unsupported. `shipit` tags, branches and changelogs a Go repo like any other — there is simply no file to rewrite. A Go module's version *is* its git tag; `go.mod` holds the module path and the `go 1.x` language directive, neither of which is the app version. Since a release changes no dependency, `go.sum` stays valid and `go mod tidy` would only risk pulling unrelated dependency churn into the release commit.
