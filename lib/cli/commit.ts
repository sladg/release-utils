import { bootstrap } from 'commitizen/dist/cli/git-cz'

export interface CommitHandlerProps {
  cwd: string
}

export const commitHandler = ({ cwd }: CommitHandlerProps) => {
  bootstrap(
    {
      // cliPath: path.join(__dirname, '../'),
      cliPath: cwd,
      // this is new
      config: {
        path: 'cz-emoji-conventional',
        version_files: [
          // @NOTE: Not used, we calculate version ourselves, we don't rely on commitizen.
        ],
      },
    },
    // This needs to be empty so commitizen does not pickup our CLI args
    [],
  )
}
