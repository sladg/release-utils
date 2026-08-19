import { bumpCalculator, bumpMapping, isValidTag } from '../utils'

export interface GuessHandlerProps {
  tagPrefix: string
  latestVersion: string
  commitMessage: string
}

export const guessHandler = ({ latestVersion, tagPrefix, commitMessage }: GuessHandlerProps) => {
  if (!isValidTag(latestVersion, tagPrefix)) {
    throw new Error(`Invalid version found - ${latestVersion}!`)
  }

  const match = bumpMapping.find(({ test }) => commitMessage.match(test))
  if (!match) {
    throw new Error('No mapping for for suplied commit message.')
  }

  const nextTag = bumpCalculator(latestVersion.replace(tagPrefix, ''), match?.bump)
  const nextTagWithPrefix = tagPrefix + nextTag

  return nextTagWithPrefix
}
