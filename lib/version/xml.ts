import type { VersionApplier } from './types'

// Comments, CDATA and processing instructions are matched first so their
// contents can never be mistaken for tags and shift the element path.
const TOKEN =
  /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[!?][\s\S]*?>|<(?<closing>\/?)(?<name>[\w.:-]+)(?:"[^"]*"|'[^']*'|[^>])*?(?<selfClosing>\/?)>/gu

// Depth-aware walk instead of a parser: a pom.xml has <version> under
// <project>, <parent>, every <dependency> and every <plugin>, so only an exact
// element path can pick the project's own version without clobbering deps.
const replaceAtPath = (
  text: string,
  path: string[],
  version: string,
): string | null => {
  const stack: string[] = []
  let openEnd = -1

  for (const match of text.matchAll(TOKEN)) {
    const [tag] = match
    const { closing, name, selfClosing } = match.groups ?? {}
    if (name === undefined || tag === undefined) continue

    if (closing === '/') {
      // Children always close deeper, so the first close at the target depth
      // is our own element's.
      if (openEnd >= 0 && stack.length === path.length) {
        if (text.slice(openEnd, match.index).trim() === version) return null
        return text.slice(0, openEnd) + version + text.slice(match.index)
      }
      stack.pop()
      continue
    }

    if (selfClosing === '/') continue
    stack.push(name)
    if (
      openEnd < 0 &&
      stack.length === path.length &&
      path.every((segment, index) => stack[index] === segment)
    ) {
      openEnd = match.index + tag.length
    }
  }

  return null
}

const applyXml: VersionApplier = (text, paths, version) => {
  const content = paths.reduce(
    (acc, path) => replaceAtPath(acc, path, version) ?? acc,
    text,
  )
  return { content, changed: content !== text }
}

export { applyXml }
