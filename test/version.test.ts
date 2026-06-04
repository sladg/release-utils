import { describe, expect, it } from 'vitest'

import { applyJson } from '../lib/version/json'
import { applyPlain } from '../lib/version/plain'
import { setVersionAtPath } from '../lib/version/structured'
import { applyText } from '../lib/version/text'
import { applyToml } from '../lib/version/toml'
import { applyYaml } from '../lib/version/yaml'

const parse = (text: string): unknown => JSON.parse(text)

describe('setVersionAtPath', () => {
  it('sets an existing string leaf and reports change', () => {
    const obj = { version: '1.0.0' }
    expect(setVersionAtPath(obj, ['version'], '2.0.0')).toBe(true)
    expect(obj.version).toBe('2.0.0')
  })

  it('is a no-op when the value already matches', () => {
    const obj = { version: '1.0.0' }
    expect(setVersionAtPath(obj, ['version'], '1.0.0')).toBe(false)
  })

  it('never creates missing keys', () => {
    const obj: { [k: string]: unknown } = {}
    expect(setVersionAtPath(obj, ['a', 'b', 'version'], '2.0.0')).toBe(false)
    expect(obj).toEqual({})
  })

  it('ignores non-string leaves', () => {
    const obj = { version: 123 }
    expect(setVersionAtPath(obj, ['version'], '2.0.0')).toBe(false)
    expect(obj.version).toBe(123)
  })
})

describe('applyJson', () => {
  it('bumps the root version, leaves a dependency at the same version', () => {
    const input =
      JSON.stringify(
        { name: 'x', version: '1.0.0', dependencies: { dep: '1.0.0' } },
        null,
        2,
      ) + '\n'
    const { content, changed } = applyJson(input, [['version']], '2.0.0')
    expect(changed).toBe(true)
    const out = parse(content) as {
      version: string
      dependencies: { dep: string }
    }
    expect(out.version).toBe('2.0.0')
    expect(out.dependencies.dep).toBe('1.0.0')
  })

  it('does not rely on the old value', () => {
    const input = '{\n  "version": "garbage"\n}\n'
    const { content } = applyJson(input, [['version']], '2.0.0')
    expect((parse(content) as { version: string }).version).toBe('2.0.0')
  })

  it('preserves 4-space indentation and trailing newline', () => {
    const input = JSON.stringify({ version: '1.0.0' }, null, 4) + '\n'
    const { content } = applyJson(input, [['version']], '2.0.0')
    expect(content).toBe('{\n    "version": "2.0.0"\n}\n')
  })

  it('bumps lockfile root paths but never nested deps at the same version', () => {
    const input =
      JSON.stringify(
        {
          version: '1.0.0',
          packages: {
            '': { version: '1.0.0' },
            'node_modules/foo': { version: '1.0.0' },
          },
        },
        null,
        2,
      ) + '\n'
    const { content } = applyJson(
      input,
      [['version'], ['packages', '', 'version']],
      '2.0.0',
    )
    const out = parse(content) as {
      version: string
      packages: Record<string, { version: string }>
    }
    expect(out.version).toBe('2.0.0')
    expect(out.packages[''].version).toBe('2.0.0')
    expect(out.packages['node_modules/foo'].version).toBe('1.0.0')
  })
})

describe('applyToml', () => {
  it('bumps package.version, leaves a nested dependency untouched', () => {
    const input = `[package]\nversion = "1.0.0"\n\n[dependencies]\nfoo = { version = "1.0.0" }\n`
    const { content, changed } = applyToml(
      input,
      [['package', 'version']],
      '2.0.0',
    )
    expect(changed).toBe(true)
    expect(content).toMatch(/version = "2\.0\.0"/)
    expect(content).toMatch(/\[dependencies\.foo\]\nversion = "1\.0\.0"/)
  })
})

describe('applyYaml', () => {
  it('bumps paths and preserves comments', () => {
    const input = `# keep me\nversion: 1.0.0\nappVersion: 1.0.0 # inline\n`
    const { content, changed } = applyYaml(
      input,
      [['version'], ['appVersion']],
      '2.0.0',
    )
    expect(changed).toBe(true)
    expect(content).toContain('# keep me')
    expect(content).toContain('# inline')
    expect(content).toContain('version: 2.0.0')
    expect(content).toContain('appVersion: 2.0.0')
  })

  it('only touches paths that exist', () => {
    const { changed } = applyYaml('name: x\n', [['version']], '2.0.0')
    expect(changed).toBe(false)
  })
})

describe('applyText', () => {
  it('bumps __version__ regardless of quote style', () => {
    expect(
      applyText(`__version__ = "1.0.0"\n`, [['__version__']], '2.0.0').content,
    ).toBe(`__version__ = "2.0.0"\n`)
    expect(
      applyText(`__version__ = '1.0.0'\n`, [['__version__']], '2.0.0').content,
    ).toBe(`__version__ = '2.0.0'\n`)
  })

  it('reports no change when the identifier is absent', () => {
    expect(applyText('print("hi")\n', [['__version__']], '2.0.0').changed).toBe(
      false,
    )
  })
})

describe('applyPlain', () => {
  it('replaces a version-shaped file', () => {
    expect(applyPlain('1.0.0\n', [], '2.0.0')).toEqual({
      content: '2.0.0\n',
      changed: true,
    })
  })

  it('leaves a non-version file alone', () => {
    expect(applyPlain('codename-foxtrot\n', [], '2.0.0')).toEqual({
      content: 'codename-foxtrot\n',
      changed: false,
    })
  })
})
