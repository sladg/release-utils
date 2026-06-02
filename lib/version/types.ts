export type UnknownRecord = { [key: string]: unknown }

export type VersionFormat = 'json' | 'toml' | 'yaml' | 'text' | 'plain'

// Shared signature for every per-format helper: take the raw file, set the
// version at the given key-paths, return the new content + whether it changed.
export type VersionApplier = (
  text: string,
  paths: string[][],
  version: string,
) => { content: string; changed: boolean }

export interface VersionFileRule {
  files: string[]
  format: VersionFormat
  // jq-like key-paths to the version; each is bumped only if it exists.
  paths: string[][]
}
