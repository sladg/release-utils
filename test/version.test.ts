import { describe, expect, it } from 'vitest'

import { applyJson } from '../lib/version/json'
import { applyPlain } from '../lib/version/plain'
import { applyText } from '../lib/version/text'
import { applyToml } from '../lib/version/toml'
import { applyXml } from '../lib/version/xml'
import { applyYaml } from '../lib/version/yaml'
import { setVersionAtPath } from '../lib/version/structured'

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
    const obj: Record<string, unknown> = {}
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
      `${JSON.stringify(
        { name: 'x', version: '1.0.0', dependencies: { dep: '1.0.0' } },
        null,
        2,
      )  }\n`
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
    const input = `${JSON.stringify({ version: '1.0.0' }, null, 4)  }\n`
    const { content } = applyJson(input, [['version']], '2.0.0')
    expect(content).toBe('{\n    "version": "2.0.0"\n}\n')
  })

  it('bumps lockfile root paths but never nested deps at the same version', () => {
    const input =
      `${JSON.stringify(
        {
          version: '1.0.0',
          packages: {
            '': { version: '1.0.0' },
            'node_modules/foo': { version: '1.0.0' },
          },
        },
        null,
        2,
      )  }\n`
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
    expect(out.packages['']?.version).toBe('2.0.0')
    expect(out.packages['node_modules/foo']?.version).toBe('1.0.0')
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

describe('applyXml', () => {
  const POM = `<?xml version="1.0"?>
<project>
  <groupId>com.example</groupId>
  <version>1.0.0</version>
  <parent>
    <version>1.0.0</version>
  </parent>
  <dependencies>
    <dependency>
      <groupId>other</groupId>
      <version>1.0.0</version>
    </dependency>
  </dependencies>
</project>
`

  it('bumps project.version without touching dependency versions', () => {
    const { content, changed } = applyXml(POM, [['project', 'version']], '2.0.0')
    expect(changed).toBe(true)
    expect(content).toContain('<groupId>com.example</groupId>\n  <version>2.0.0</version>')
    expect(content).toContain('<groupId>other</groupId>\n      <version>1.0.0</version>')
    expect(content).toContain('<parent>\n    <version>1.0.0</version>')
  })

  it('bumps the parent coordinate on its own path', () => {
    const { content } = applyXml(POM, [['project', 'parent', 'version']], '2.0.0')
    expect(content).toContain('<parent>\n    <version>2.0.0</version>')
    expect(content).toContain('<groupId>com.example</groupId>\n  <version>1.0.0</version>')
  })

  it('is not confused by a version inside a comment', () => {
    const input = `<project>\n  <!-- <version>9.9.9</version> -->\n  <version>1.0.0</version>\n</project>\n`
    const { content } = applyXml(input, [['project', 'version']], '2.0.0')
    expect(content).toContain('<!-- <version>9.9.9</version> -->')
    expect(content).toContain('<version>2.0.0</version>')
  })

  it('ignores self-closing tags when tracking depth', () => {
    const input = `<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <Version>1.0.0</Version>\n  </PropertyGroup>\n  <ItemGroup>\n    <PackageReference Include="X" Version="9.9.9" />\n  </ItemGroup>\n</Project>\n`
    const { content, changed } = applyXml(
      input,
      [['Project', 'PropertyGroup', 'Version']],
      '2.0.0',
    )
    expect(changed).toBe(true)
    expect(content).toContain('<Version>2.0.0</Version>')
    expect(content).toContain('Version="9.9.9"')
  })

  it('reports no change when the path is absent', () => {
    expect(applyXml('<project><name>x</name></project>', [['project', 'version']], '2.0.0').changed).toBe(false)
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

  it('bumps a colon-separated value (mix.exs, rpm spec)', () => {
    expect(applyText(`version: "1.0.0",\n`, [['version']], '2.0.0').content).toBe(
      `version: "2.0.0",\n`,
    )
    expect(applyText(`Version:        1.0.0\n`, [['Version']], '2.0.0').content).toBe(
      `Version:        2.0.0\n`,
    )
  })

  it('bumps a bare value (gradle.properties, setup.cfg, PKGBUILD)', () => {
    expect(applyText('version=1.0.0\n', [['version']], '2.0.0').content).toBe('version=2.0.0\n')
    expect(applyText('pkgver=1.0.0\n', [['pkgver']], '2.0.0').content).toBe('pkgver=2.0.0\n')
  })

  it('leaves a bare value alone when it is not version-shaped', () => {
    expect(applyText('version = project.version\n', [['version']], '2.0.0').changed).toBe(false)
  })

  it('matches a receiver-qualified identifier but not a suffixed one', () => {
    expect(applyText(`spec.version = "1.0.0"\n`, [['version']], '2.0.0').content).toBe(
      `spec.version = "2.0.0"\n`,
    )
    expect(applyText(`myversion = "1.0.0"\n`, [['version']], '2.0.0').changed).toBe(false)
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
