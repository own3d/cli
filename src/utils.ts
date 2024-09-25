import { join } from 'https://deno.land/std@0.220.0/path/join.ts'

export const DockerDenoDir = '/home/deno'
export const DockerModsDir = `${DockerDenoDir}/modules`
export const DockerFuncDirPath = `${DockerDenoDir}/functions`


export const Own3dCliDirPath = '.own3d-cli'
export const TempDir = join(Own3dCliDirPath, '.temp')
export const FunctionsDir = join(Own3dCliDirPath, 'functions')