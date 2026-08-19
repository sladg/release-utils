import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import type { SimpleGit } from 'simple-git'
import { join } from 'node:path'
import { simpleGit } from 'simple-git'

const ROOT = join(process.cwd(), '.test-tmp')

// Track only the dirs this worker created. Test files run in parallel against
// the shared ROOT, so cleanup must remove its own dirs — never the whole root.
const created: string[] = []

const makeTmpDir = () => {
  mkdirSync(ROOT, { recursive: true })
  const dir = mkdtempSync(join(ROOT, 'case-'))
  created.push(dir)
  return dir
}

const cleanupTmp = () =>
  created
    .splice(0)
    .forEach((dir) => rmSync(dir, { recursive: true, force: true }))

// A real working repo wired to a bare "origin", so fetch/push behave for real
// — no mocking of simple-git needed.
const makeRepo = async () => {
  const base = makeTmpDir()
  const remote = join(base, 'remote.git')
  const work = join(base, 'work')

  mkdirSync(remote)
  await simpleGit(remote).init(true)
  await simpleGit(base).clone(remote, work)
  const git = simpleGit(work)
    .addConfig('user.name', 'Test')
    .addConfig('user.email', 'test@test.dev')

  return { base, remote, work, git }
}

const commitFile = async ({
  git,
  dir,
  file,
  content,
  message,
}: {
  git: SimpleGit
  dir: string
  file: string
  content: string
  message: string
}) => {
  writeFileSync(join(dir, file), content)
  await git.add('.').commit(message)
}

export { makeTmpDir, cleanupTmp, makeRepo, commitFile }
