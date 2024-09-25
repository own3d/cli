import { DockerDenoDir, DockerFuncDirPath, FunctionsDir, TempDir } from '../utils.ts'
import type { Args } from 'https://deno.land/std@0.207.0/cli/parse_args.ts'
import { join as posixJoin } from 'https://deno.land/std@0.220.0/path/posix/join.ts'
import { compress } from 'https://deno.land/x/brotli/mod.ts'
import { join } from 'https://deno.land/std/path/mod.ts'
import { getHeaders } from '../helpers/getHeaders.ts'
import axios, { type AxiosResponse } from 'npm:axios'
import { copy } from 'https://deno.land/std@0.133.0/fs/copy.ts'
import { exists } from 'https://deno.land/std@0.220.1/fs/exists.ts'
import remove = Deno.remove

interface DockerRunOptions {
    image: string
    cmd: string[]
    binds: string[]
    workingDir: string
}

interface Manifest {
    name: string
    version: string
    entrypoint: string
    description?: string
    runtime?: string
    memory?: number
    timeout?: number
    environment?: Record<string, string>
}

interface DeployResponse {
    id: number
    revision: string
    function_id: number
    production: boolean
    domains: string[]
}

export function useDeploy(_args: Args) {
    const eszipContentType = 'application/vnd.denoland.eszip'
    const compressedEszipMagicId = 'EZBR'

    // Import Map from CLI flag, i.e. --import-map, takes priority over config.toml & fallback.
    const dockerImportMapPath = DockerDenoDir + '/import_map.json'
    const dockerOutputDir = '/root/eszips'

    const deployFunction = async (manifest: Manifest, compressed: Uint8Array): Promise<AxiosResponse<DeployResponse>> => {
        // save compressed as eszip2
        Deno.writeFileSync(join(TempDir, `${manifest.name}.eszip2`), compressed)

        const data = new FormData()
        data.append('mime_type', eszipContentType)
        data.append('file', new Blob([compressed], {
            type: eszipContentType,
        }), `${manifest.name}.eszip`)
        data.append('manifest', new Blob([JSON.stringify(manifest)], {
            type: 'application/json',
        }), 'manifest.json')

        return axios.post(`http://localhost:8000/api/v1/edge-functions/deploy`, data, {
            headers: await getHeaders(),
        })
    }

    const bundleFunction = async (
        slug: string,
        manifest: Manifest,
        dockerEntrypointPath: string,
        importMapPath: string,
    ): Promise<Uint8Array> => {
        const cwd = Deno.cwd()

        // create temp directory to store generated eszip
        const hostOutputDir = join(TempDir, `.output_${manifest.name}`)
        const EdgeRuntimeId = 'edge-runtime'

        // copy the cwd/${base} directory to the FunctionsDir
        const hostFuncDir = join(cwd, slug)
        const funcFuncDir = join(cwd, FunctionsDir, manifest.name)
        if (await exists(funcFuncDir)) {
            await remove(funcFuncDir, {recursive: true})
        }
        await copy(hostFuncDir, funcFuncDir)

        const outputPath = posixJoin(dockerOutputDir, 'output.eszip')
        const binds = [
            `${EdgeRuntimeId}:/root/.cache/deno:rw,z`,
            join(cwd, FunctionsDir) + ':' + DockerFuncDirPath + ':ro,z',
            join(cwd, hostOutputDir) + ':' + dockerOutputDir + ':rw,z',
        ]

        const cmd = [
            'bundle',
            '--entrypoint',
            dockerEntrypointPath,
            '--output',
            outputPath,
        ]

        if (_args['debug']) {
            cmd.push('--verbose')
        }

        if (importMapPath) {
            const modules = BindImportMap(importMapPath, dockerImportMapPath)
            binds.push(...modules)
            cmd.push('--import-map', dockerImportMapPath)
        }

        try {
            await dockerRun({
                image: 'ghcr.io/supabase/edge-runtime:v1.40.0',
                cmd,
                binds,
                workingDir: DockerFuncDirPath,
            })
        } finally {
            await remove(funcFuncDir, {recursive: true})
        }

        const eszipBytes = await Deno.readFile(join(hostOutputDir, 'output.eszip'))
        const compressed = compress(eszipBytes)

        const magicIdBytes = new TextEncoder().encode(compressedEszipMagicId)
        const finalBuffer = new Uint8Array(magicIdBytes.length + compressed.length)
        finalBuffer.set(magicIdBytes, 0)
        finalBuffer.set(compressed, magicIdBytes.length)

        return compressed
    }

    const dockerRun = async (options: DockerRunOptions): Promise<string> => {
        const {image, cmd, binds, workingDir} = options
        const dockerCmd = [
            'run',
            '--rm',
            '--workdir',
            workingDir,
            ...binds.flatMap((bind) => ['-v', bind]),
            image,
            ...cmd,
        ]

        const command = new Deno.Command('docker', {
            args: dockerCmd,
        })

        const {success, stdout, stderr} = await command.output()
        const output = new TextDecoder().decode(stdout)
        const error = new TextDecoder().decode(stderr)

        if (!success) {
            throw new Error(error)
        }

        return output
    }

    const BindImportMap = (hostImportMapPath: string, dockerImportMapPath: string): string[] => {
        return [
            `${hostImportMapPath}:${dockerImportMapPath}:ro,z`,
        ]
    }

    return {
        bundleFunction,
        deployFunction,
    }
}