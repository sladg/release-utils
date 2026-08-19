type UnknownRecord = Record<string, unknown>

type VersionFormat = 'json' | 'toml' | 'yaml' | 'xml' | 'text' | 'plain'

// Shared signature for every per-format helper: take the raw file, set the
// version at the given key-paths, return the new content + whether it changed.
type VersionApplier = (
  text: string,
  paths: string[][],
  version: string,
) => { content: string; changed: boolean }

interface LockfileManager {
  // Only run when this file exists, so the right manager is picked per repo.
  detect?: string
  cmd: string
}

interface Ecosystem {
  // Globs matched from the repo root. `files[0]` is the canonical manifest
  // basename and doubles as the lockfile trigger.
  files: string[]
  format: VersionFormat
  // Jq-like key-paths to the version; each is bumped only if it exists.
  paths: string[][]
  // Ordered by preference; the first manager whose `detect` file exists wins.
  lockfile?: LockfileManager[]
}

export type { UnknownRecord, VersionFormat, VersionApplier, Ecosystem }
