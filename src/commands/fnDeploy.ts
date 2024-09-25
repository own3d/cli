import type { Args } from 'https://deno.land/std@0.207.0/cli/parse_args.ts'
import { join } from '../helpers/deps.ts'
import { exists } from 'https://deno.land/std@0.220.1/fs/exists.ts'
import { DockerFuncDirPath, Own3dCliDirPath } from '../utils.ts'
import { useDeploy } from '../composables/useDeploy.ts'
import remove = Deno.remove
import { posixJoin } from 'https://deno.land/std@0.200.0/path/_join.ts'

const HumanSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 Byte'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i]
}

export async function fnDeploy(_args: Args): Promise<number> {
    const {bundleFunction, deployFunction} = useDeploy(_args)
    const functionName: string = _args._[0] as string

    if (typeof functionName !== 'string' || functionName.length === 0) {
        console.error('Please provide a name for the function')
        return 1
    }

    // check if function contains a valid manifest
    const manifestFile = join(Deno.cwd(), functionName, '.own3d', 'manifest.json')
    if (!Deno.statSync(manifestFile).isFile) {
        console.error('Invalid function, missing manifest')
        return 1
    }
    const manifest = JSON.parse(Deno.readTextFileSync(manifestFile))

    if (!manifest) {
        console.error('Invalid function, missing manifest')
        return 1
    }

    if (!manifest.name || !manifest.version || !manifest.entrypoint) {
        console.error('Invalid manifest, missing required fields')
        return 1
    }

    // 2. Bundle Function
    console.log(`- Bundling ${functionName} function...`)

    const importMapPath: string = ''
    const dockerEntrypointPath: string = posixJoin(DockerFuncDirPath, manifest.name, 'index.ts')
    const compressed = await bundleFunction(functionName, manifest, dockerEntrypointPath, importMapPath)

    console.log('✔ Function bundled')

    // 3. Deploy Function
    const functionSize = HumanSize(compressed.length)
    console.log(`- Deploying ${functionName} function (script size: ${functionSize})...`)

    try {
        const {data} = await deployFunction(manifest, compressed)

        console.log('✔ Deployment is live!')

        data.domains.forEach((domain: string) => {
            console.log(`Website URL: ${domain}`)
        })
    } catch (e) {
        // x emoji
        console.error('✘ Failed to deploy function')
        if (e.response?.data?.message)
            console.error(e.response?.data.message)
        else
            console.error(e.message)

        if (await exists(Own3dCliDirPath)) {
            await remove(Own3dCliDirPath, {recursive: true})
        }

        return 1
    }

    if (await exists(Own3dCliDirPath)) {
        await remove(Own3dCliDirPath, {recursive: true})
    }

    return 0
}