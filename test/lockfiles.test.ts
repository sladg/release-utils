import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupTmp, makeTmpDir } from './helpers'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { regenerateLockfiles } from '../lib/cli/lockfiles'
import { writeFileSync } from 'node:fs'

vi.mock('node:child_process', () => ({ execSync: vi.fn() }))

const exec = vi.mocked(execSync)

const touch = (dir: string, file: string) => writeFileSync(join(dir, file), '')

beforeEach(() => exec.mockClear())
afterEach(() => cleanupTmp())

describe('regenerateLockfiles', () => {
  it('picks bun first', () => {
    const dir = makeTmpDir()
    touch(dir, 'bun.lock')
    touch(dir, 'pnpm-lock.yaml')
    regenerateLockfiles(['package.json'], dir)
    expect(exec).toHaveBeenCalledWith('bun install --lockfile-only', expect.objectContaining({ cwd: dir }))
    expect(exec).toHaveBeenCalledTimes(1)
  })

  it('picks npm', () => {
    const dir = makeTmpDir()
    touch(dir, 'package-lock.json')
    regenerateLockfiles(['package.json'], dir)
    expect(exec).toHaveBeenCalledWith('npm install --package-lock-only', expect.objectContaining({ cwd: dir }))
  })

  it('runs cargo update when Cargo.toml changed', () => {
    const dir = makeTmpDir()
    regenerateLockfiles(['packages/foo/Cargo.toml', 'Cargo.toml'], dir)
    expect(exec).toHaveBeenCalledWith('cargo update --workspace', expect.objectContaining({ cwd: dir }))
  })

  it('runs bun install --lockfile-only when package.json changed and bun.lock present', () => {
    const dir = makeTmpDir()
    touch(dir, 'bun.lock')
    regenerateLockfiles(['package.json'], dir)
    expect(exec).toHaveBeenCalledWith('bun install --lockfile-only', expect.objectContaining({ cwd: dir }))
  })

  it('runs pnpm install --lockfile-only when package.json changed and pnpm-lock.yaml present', () => {
    const dir = makeTmpDir()
    touch(dir, 'pnpm-lock.yaml')
    regenerateLockfiles(['package.json'], dir)
    expect(exec).toHaveBeenCalledWith('pnpm install --lockfile-only', expect.objectContaining({ cwd: dir }))
  })

  it('skips node lockfile when package.json changed but no lockfile present', () => {
    const dir = makeTmpDir()
    regenerateLockfiles(['package.json'], dir)
    expect(exec).not.toHaveBeenCalled()
  })

  it('runs uv lock when pyproject.toml changed and uv.lock present', () => {
    const dir = makeTmpDir()
    touch(dir, 'uv.lock')
    regenerateLockfiles(['pyproject.toml'], dir)
    expect(exec).toHaveBeenCalledWith('uv lock', expect.objectContaining({ cwd: dir }))
  })

  it('runs poetry lock when pyproject.toml changed and poetry.lock present', () => {
    const dir = makeTmpDir()
    touch(dir, 'poetry.lock')
    regenerateLockfiles(['pyproject.toml'], dir)
    expect(exec).toHaveBeenCalledWith('poetry lock --no-update', expect.objectContaining({ cwd: dir }))
  })

  it('prefers uv over poetry when both lockfiles present', () => {
    const dir = makeTmpDir()
    touch(dir, 'uv.lock')
    touch(dir, 'poetry.lock')
    regenerateLockfiles(['pyproject.toml'], dir)
    expect(exec).toHaveBeenCalledWith('uv lock', expect.objectContaining({ cwd: dir }))
    expect(exec).toHaveBeenCalledTimes(1)
  })

  it('skips python lockfile when pyproject.toml changed but no lockfile present', () => {
    const dir = makeTmpDir()
    regenerateLockfiles(['pyproject.toml'], dir)
    expect(exec).not.toHaveBeenCalled()
  })

  it('runs multiple commands when multiple file types changed', () => {
    const dir = makeTmpDir()
    touch(dir, 'bun.lock')
    regenerateLockfiles(['Cargo.toml', 'package.json'], dir)
    expect(exec).toHaveBeenCalledTimes(2)
    expect(exec).toHaveBeenCalledWith('cargo update --workspace', expect.anything())
    expect(exec).toHaveBeenCalledWith('bun install --lockfile-only', expect.anything())
  })

  it('does nothing when no relevant files changed', () => {
    const dir = makeTmpDir()
    regenerateLockfiles(['README.md', 'src/main.ts'], dir)
    expect(exec).not.toHaveBeenCalled()
  })
})
