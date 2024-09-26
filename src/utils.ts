import { join } from 'https://deno.land/std@0.220.0/path/join.ts'

export const DockerDenoDir: string = '/home/deno'
export const DockerModsDir: string = `${DockerDenoDir}/modules`
export const DockerFuncDirPath: string = `${DockerDenoDir}/functions`


export const Own3dCliDirPath: string = '.own3d-cli'
export const TempDir: string = join(Own3dCliDirPath, '.temp')
export const FunctionsDir: string = join(Own3dCliDirPath, 'functions')

export const ExtDeployHelp: string = `Read more: https://dev.own3d.tv/docs/cli/

Usage: own3d ext:deploy [OPTIONS]

Options:
    --help, -h      Show this help message
    --dist          Path to the extension's dist directory [default: dist]
    --manifest      Path to the extension's manifest file [default: manifest.yaml]
    --assets        Upload all assets (logos, screenshots, etc.) [default: false]
    --stage         Publish to a specific stage [default: local-test]
`

export const HumanSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 Byte'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i]
}
