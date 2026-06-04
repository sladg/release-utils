import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import path from 'path'
import { SimpleGit, simpleGit } from 'simple-git'

const ROOT = path.join(process.cwd(), '.test-tmp')

// Track only the dirs this worker created. Test files run in parallel against
// the shared ROOT, so cleanup must remove its own dirs — never the whole root.
const created: string[] = []

export const makeTmpDir = () => {
  mkdirSync(ROOT, { recursive: true })
  const dir = mkdtempSync(path.join(ROOT, 'case-'))
  created.push(dir)
  return dir
}

export const cleanupTmp = () =>
  created
    .splice(0)
    .forEach((dir) => rmSync(dir, { recursive: true, force: true }))

// A real working repo wired to a bare "origin", so fetch/push behave for real
// — no mocking of simple-git needed.
export const makeRepo = async () => {
  const base = makeTmpDir()
  const remote = path.join(base, 'remote.git')
  const work = path.join(base, 'work')

  mkdirSync(remote)
  await simpleGit(remote).init(true)
  await simpleGit(base).clone(remote, work)
  const git = simpleGit(work)
    .addConfig('user.name', 'Test')
    .addConfig('user.email', 'test@test.dev')

  return { base, remote, work, git }
}

export const commitFile = async (
  git: SimpleGit,
  dir: string,
  file: string,
  content: string,
  message: string,
) => {
  writeFileSync(path.join(dir, file), content)
  await git.add('.').commit(message)
}
