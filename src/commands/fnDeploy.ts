import {Args} from 'https://deno.land/std@0.207.0/cli/parse_args.ts'
import axios from 'npm:axios'
import {getHeaders} from '../helpers/getHeaders.ts'
import {compress} from "https://deno.land/x/zip@v1.2.5/mod.ts";

export async function fnDeploy(_args: Args) {
    const functionName: string = _args._[0] as string
    console.log(`Deploying ${functionName} function...`)

    const zipped: boolean = await compress(`./${functionName}`, './temp.zip', {
        overwrite: true,
        flags: []
    })

    if (!zipped) {
        console.error('Failed to zip function')
        Deno.exit(1)
    }

    console.log('Uploading function...')

    try {
        const file = await Deno.readFile('./temp.zip');
        const formData = new FormData();
        formData.append("function", functionName);
        formData.append('file', new Blob([file]), 'filename.ext');
        const response = await axios.post('http://localhost:8000/api/v1/edge-functions/deploy', formData, {
            headers: await getHeaders()
        })

        console.log('Function deployed', response.data)
    } catch (e) {
        console.error('Failed to deploy function')
        console.error(e.response.data.message)
        Deno.exit(1)
    }
}