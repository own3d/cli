import {Args} from 'https://deno.land/std@0.207.0/cli/parse_args.ts'
import axios from 'npm:axios'
import {getHeaders} from '../helpers/getHeaders.ts'
import { compress } from "../helpers/compress.ts";
import {join} from "../helpers/deps.ts";

export async function fnDeploy(_args: Args) {
    const functionName: string = _args._[0] as string

    const archiveName: string = join(Deno.cwd(), 'archive.zip')

    if (typeof functionName !== 'string' || functionName.length === 0) {
        console.error('Please provide a name for the function')
        Deno.exit(1)
    }

    // check if function contains a valid manifest
    const manifestFile = `./${functionName}/.own3d/manifest.json`;
    if (!Deno.statSync(manifestFile).isFile) {
        console.error('Invalid function, missing manifest')
        Deno.exit(1)
    }
    const manifest = JSON.parse(Deno.readTextFileSync(manifestFile))

    if (!manifest) {
        console.error('Invalid function, missing manifest')
        Deno.exit(1)
    }

    if (!manifest.name || !manifest.version || !manifest.entrypoint) {
        console.error('Invalid manifest, missing required fields')
        Deno.exit(1)
    }

    console.log(`- Compressing ${functionName} function...`)

    const zipped: boolean = await compress('.', archiveName, {
        overwrite: true,
        flags: [],
        cwd: join(Deno.cwd(), functionName)
    })

    if (!zipped) {
        console.error('Failed to zip function')
        Deno.exit(1)
    }

    console.log('✔ Function compressed')
    console.log(`- Deploying ${functionName} function...`)

    try {
        const file = await Deno.readFile(archiveName);
        const formData = new FormData();
        formData.append('manifest', JSON.stringify(manifest));
        formData.append('file', new Blob([file]), 'filename.ext');
        const response = await axios.post('http://localhost:8000/api/v1/edge-functions/deploy', formData, {
            headers: await getHeaders()
        })

        console.log('✔ Deployment is live!')

        response.data.domains.forEach((domain: string) => {
            console.log(`Website URL: ${domain}`)
        })
    } catch (e) {
        console.error('Failed to deploy function')
        if(e.response?.data?.message)
            console.error(e.response?.data.message)
        else
            console.error(e.message)
        Deno.exit(1)
    }

    // cleanup
    await Deno.remove(archiveName)
}