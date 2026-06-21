import type { Args } from 'https://deno.land/std@0.207.0/cli/parse_args.ts'
import axios from 'npm:axios'
import { getHeaders } from '../helpers/getHeaders.ts'
import { setLoggerQuiet, step, success, error as logError, raw } from '../helpers/logger.ts'

export async function whoami(args: Args): Promise<number> {
    const quiet = !!(args.quiet || args.q)
    setLoggerQuiet(quiet)

    let headers: Record<string, string>
    try {
        headers = await getHeaders()
    } catch (_e) {
        logError('Not logged in. Run: own3d login')
        return 1
    }

    step('Fetching user information...')
    try {
        const { data } = await axios.get('https://id.stream.tv/api/users/@me', { headers })
        if (args.json) {
            raw(JSON.stringify(data, null, 2))
        } else {
            success(`Logged in as ${data.name}`)
            raw(` id    : ${data.id}`)
            raw(` email : ${data.email ?? '(hidden)'}`)
        }
        return 0
    } catch (e: any) { // deno-lint-ignore no-explicit-any
        logError(e?.response?.data?.message ?? e.message)
        return 1
    }
}
