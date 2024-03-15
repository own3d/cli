import { Args } from 'https://deno.land/std@0.207.0/cli/parse_args.ts'
import * as uuid from 'https://deno.land/std@0.207.0/uuid/mod.ts'
import { stringify } from 'https://cdn.skypack.dev/querystring'
import { open } from 'https://deno.land/x/open/index.ts'
import axios from 'npm:axios'
import { useStorage } from "../composables/useStorage.ts";

const {putJson} = useStorage()

async function fetchUser(queryParams: any) {
    try {
        console.log('Fetching user information...')
        const user = await axios.get('https://id.stream.tv/api/users/@me', {
            headers: {
                Authorization: `Bearer ${queryParams.access_token}`,
            },
        })
        console.log(`Logged in as ${user.data.name}`)
        queryParams.user = user.data
    } catch (error) {
        console.error(error.message)
    }
}

export async function login(_args: Args) {
    const state = uuid.v1.generate()
    const authorizeUrl = `https://id.stream.tv/oauth/authorize?${stringify({
        client_id: '9853a006-86a1-4f02-bfa2-d58daa3581a8',
        redirect_uri: 'http://localhost:1337/cli',
        response_type: 'token',
        scope: '*',
        state,
    })}`

    console.log('Please follow the instructions in the browser...')

    if (_args['console-only']) {
        console.log(authorizeUrl)
    } else {
        setTimeout(() => open('http://localhost:1337/redirect'), 1000)
    }

    Deno.serve({port: 1337}, async (req: Request) => {
        if (req.url.endsWith('/redirect')) {
            return new Response('', {status: 302, headers: {Location: authorizeUrl}})
        }
        if (req.url.endsWith('/callback')) {
            const queryParams = await req.json()
            if (!state || state !== queryParams.state) {
                return new Response('Invalid state.')
            }
            queryParams.expires_at = new Date(Date.now() + queryParams.expires_in * 1000)
            await fetchUser(queryParams)
            await putJson('credentials.json', queryParams)
            console.log('Login successful, exiting...')
            setTimeout(() => Deno.exit(0), 1000)
            return new Response(JSON.stringify(queryParams))
        }
        return new Response(await Deno.readTextFile('resources/views/cli.html'), {headers: {'Content-Type': 'text/html'}})
    })
}