import { ECOSYSTEMS, IGNORED_GLOBS } from '../ecosystems'
import type { VersionApplier, VersionFormat } from './types'
import { readFileSync, writeFileSync } from 'node:fs'

import { applyJson } from './json'
import { applyPlain } from './plain'
import { applyText } from './text'
import { applyToml } from './toml'
import { applyXml } from './xml'
import { applyYaml } from './yaml'
import { globSync } from 'tinyglobby'

const VERSION_APPLIERS: Record<VersionFormat, VersionApplier> = {
  json: applyJson,
  toml: applyToml,
  yaml: applyYaml,
  xml: applyXml,
  text: applyText,
  plain: applyPlain,
}

const replaceVersionInCommonFiles = (newVersion: string) => {
  const results: { file: string; changed: boolean }[] = []
  for (const { files, format, paths } of Object.values(ECOSYSTEMS)) {
    if (paths.length === 0 && format !== 'plain') continue
    for (const file of globSync(files, { ignore: IGNORED_GLOBS })) {
      try {
        const text = readFileSync(file, 'utf8')
        const { content, changed } = VERSION_APPLIERS[format](text, paths, newVersion)
        if (changed) writeFileSync(file, content)
        results.push({ file, changed })
      } catch (error) {
        // A malformed file in a monorepo should not abort the whole release.
        console.warn(`Skipping ${file} - could not update version:`, error)
        results.push({ file, changed: false })
      }
    }
  }
  return results
}

export { replaceVersionInCommonFiles }
