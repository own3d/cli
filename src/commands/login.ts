import type { Args } from 'https://deno.land/std@0.207.0/cli/parse_args.ts'
import * as uuid from 'https://deno.land/std@0.207.0/uuid/mod.ts'
import { stringify } from 'https://cdn.skypack.dev/querystring'
import { open } from 'https://deno.land/x/open@v0.0.6/index.ts'
import axios from 'npm:axios'
import { useStorage } from "../composables/useStorage.ts";
import { bold, green, red, yellow, cyan, magenta, bgRed, bgGreen } from "https://deno.land/std@0.224.0/fmt/colors.ts";

const {putJson} = useStorage()

async function fetchUser(queryParams: Record<string, string>) {
    try {
        console.log(cyan('➜ Fetching user information...'));
        const user = await axios.get('https://id.stream.tv/api/users/@me', {
            headers: {
                Authorization: `Bearer ${queryParams.access_token}`,
            },
        })
        console.log(green(`✔ Logged in as ${user.data.name}`));
        queryParams.user = user.data
    // deno-lint-ignore no-explicit-any
    } catch (error: any) {
        console.error(bgRed(bold(' FAIL ')) + ' ' + red(error.message))
    }
}

export function login(_args: Args): Promise<number> {
    const state = uuid.v1.generate()
    const authorizeUrl = `https://id.stream.tv/oauth/authorize?${stringify({
        client_id: '9853a006-86a1-4f02-bfa2-d58daa3581a8',
        redirect_uri: 'http://localhost:1337/cli',
        response_type: 'token',
        scope: '*',
        state,
    })}`

    console.log(magenta('ℹ️  Please follow the instructions in the browser...'))

    if (_args['console-only']) {
        console.log(authorizeUrl)
    } else {
        setTimeout(() => open('http://localhost:1337/redirect'), 1000)
    }

    return new Promise((resolve) => {
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
                console.log(bgGreen(bold(' SUCCESS ')) + ' ' + green('Login successful, exiting...'))
                setTimeout(() => resolve(0), 1000)
                return new Response(JSON.stringify(queryParams))
            }
            return new Response(`<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
    <meta charset="UTF-8">
    <title>Login Successful</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="h-full">
<div class="min-h-full pt-16 pb-12 flex flex-col bg-white">
    <main class="flex-grow flex flex-col justify-center max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex-shrink-0 flex justify-center">
            <a href="/" class="inline-flex">
                <span class="sr-only">OWN3D</span>
                <img class="h-12 w-auto" src="https://www.own3d.tv/images/press/OWN3D-2020-logo-icon.svg" alt="">
            </a>
        </div>
        <div class="py-16">
            <div class="text-center">
                <p class="text-sm font-semibold text-orange-600 uppercase tracking-wide">OWN3D CLI</p>
                <h1 class="mt-2 text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">Login Successful</h1>
                <p class="mt-2 text-base text-gray-500">You may close the page now.</p>
                <div class="mt-6">
                    <a href="javascript:close()" class="text-base font-medium text-orange-600 hover:text-orange-500">Close window<span aria-hidden="true"> &rarr;</span></a>
                </div>
            </div>
        </div>
    </main>
</div>
<script type="application/javascript">
    fetch("/callback", {
        method: "POST",
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(Object.fromEntries(
            new URLSearchParams(location.hash.substring(1)).entries()
        ))
    }).then(res => {
        console.log("Request complete! response:", res);
        setTimeout(() => close(), 1000);
    });
</script>
</body>
</html>`, {headers: {'Content-Type': 'text/html'}})
        })
    })
}