# Release utils

Tiny `npx` commands to automate your git release flow — guess the next version, tag & branch a release, generate a changelog, and commit with a prompt.

Language-agnostic: bumps versions across Node, PHP, Rust, Python, Dart/Flutter, Helm, Deno, Ansible and more.

Built to avoid the bulk and complexity of tools like @auto-it or release-it.

```bash
npx --package @sladg/release-utils utils help
```

## Commands

**`guess`** — print the next version (to stdout) based on a commit message.

```bash
npx --package @sladg/release-utils utils guess "feat: add login" v1.2.3   # -> v1.3.0
```

**`shipit`** — bump the version across your manifest files, tag the commit, and push a `release/` branch. Works across many ecosystems out of the box — Node, PHP, Rust, Python, Dart/Flutter, Helm, Deno, Ansible and more.

```bash
npx --package @sladg/release-utils utils shipit --changelog
```

**`changelog`** — write `CHANGELOG.md`, grouped by tag with GitHub/GitLab/Bitbucket links.

```bash
npx --package @sladg/release-utils utils changelog
```

**`commit`** — interactive `commitizen` prompt (emoji + conventional), no config needed.

```bash
git add . && npx --package @sladg/release-utils utils commit
```

## More

Advanced flags, monorepo usage, and the full list of supported version files (`package.json`, `Cargo.toml`, `pyproject.toml`, `Chart.yaml`, …) are in **[USAGE.md](./USAGE.md)**.
