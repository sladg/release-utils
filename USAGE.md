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
| `--gitUser` / `--gitEmail`    | `Bender` / … | Identity used for the release commit.        |

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

| Type  | Files                                                                                                          | Location                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| JSON  | `package.json`, `package-lock.json`, `composer.json`, `deno.json`, `jsr.json`, `lerna.json`, `tauri.conf.json` | `version` (plus lockfile / Tauri root entries)                                              |
| TOML  | `Cargo.toml`, `pyproject.toml`                                                                                | `package.version` / `workspace.package.version`, `project.version` / `tool.poetry.version`  |
| YAML  | `Chart.yaml`, `pubspec.yaml`, `galaxy.yml`, `CITATION.cff`                                                    | `version` (and `appVersion` for Helm)                                                       |
| text  | `**/__init__.py`                                                                                              | `__version__`                                                                                |
| plain | `VERSION`, `version.txt`                                                                                      | whole file (only when it already looks like a version)                                      |

Notes:

- Globs cover monorepos (e.g. nested `**/package.json`), excluding `node_modules`, `vendor`, `.venv` and `.git`.
- JSON keeps its indentation and YAML keeps its comments. TOML has no format-preserving editor in JS, so `Cargo.toml` / `pyproject.toml` are re-serialized (comments/layout are not preserved on bump).
- Adding support for another file is a single row in `lib/version/index.ts` — no per-file code.
