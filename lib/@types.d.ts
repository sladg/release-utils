declare module 'commitizen/dist/cli/git-cz' {
  export function bootstrap(
    props: {
      cliPath: string
      config: {
        path: string
        version_files: string[]
      }
    },
    gitProps: [],
  ): void
}
