import { basename, join } from 'node:path'
import { ECOSYSTEMS } from '../ecosystems'
import type { Ecosystem } from '../version/types'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { is } from '@sladg/what-that'

const runSync = (cmd: string, cwd?: string) => {
  console.log(`  $ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd })
}

// First manager whose `detect` file exists wins, so two package managers never
// both run for one ecosystem. A manager without `detect` always applies.
const availableManager = (eco: Ecosystem | undefined, cwd: string) =>
  eco?.lockfile?.find(({ detect }) => !is.string(detect) || existsSync(join(cwd, detect)))

const regenerateLockfiles = (changedFiles: string[], cwd: string) => {
  const changed = new Set(changedFiles.map((f) => basename(f)))
  for (const eco of Object.values(ECOSYSTEMS)) {
    const [trigger] = eco.files
    if (trigger === undefined || !changed.has(trigger)) continue
    const manager = availableManager(eco, cwd)
    if (manager === undefined) continue
    console.log(`Regenerating lockfile via ${manager.cmd}...`)
    runSync(manager.cmd, cwd)
  }
}

export { regenerateLockfiles }
