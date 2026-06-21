import type { Args } from 'https://deno.land/std@0.207.0/cli/parse_args.ts'
import { parse } from 'https://deno.land/std@0.224.0/yaml/mod.ts'
import { exists } from 'https://deno.land/std@0.220.1/fs/exists.ts'
import { join } from '../helpers/deps.ts'
import { getHeaders } from '../helpers/getHeaders.ts'
import { bold, cyan, green, yellow, red, magenta, isColorDisabled } from '../helpers/colors.ts'
import { select } from '../helpers/prompt.ts'
import { error as logError } from '../helpers/logger.ts'
// deno-lint-ignore-file no-explicit-any
import { io } from 'npm:socket.io-client'
import axios from 'npm:axios'
import readline from 'node:readline'
import process from 'node:process'

const DEFAULT_AGENT_URL = 'http://localhost:6972'
const NYRA_URL = 'https://ext.own3d.pro'
const DEFAULT_CONSOLE_URL = 'http://localhost:8000/api'

const dim = (s: string) => isColorDisabled() ? s : `\x1b[2m${s}\x1b[0m`

const SLASH_COMMANDS: { cmd: string; desc: string }[] = [
    { cmd: '/switch', desc: 'Switch to a recent conversation' },
    { cmd: '/new',    desc: 'Start a new conversation' },
    { cmd: '/delete',     desc: 'Delete a conversation' },
    { cmd: '/delete-all', desc: 'Delete all conversations except the current one' },
    { cmd: '/help',   desc: 'Show available slash commands' },
    { cmd: '/exit',   desc: 'Exit the session' },
]

function slashCompleter(line: string): [string[], string] {
    if (!line.startsWith('/')) return [[], line]
    const hits = SLASH_COMMANDS.map(s => s.cmd).filter(c => c.startsWith(line))
    return [hits.slice(0, 5), line]
}

function out(text: string) { Deno.stdout.writeSync(new TextEncoder().encode(text)) }
function line(text = '')   { out(text + '\n') }
function clearLine()        { out('\r\x1b[K') }
function status(icon: string, msg: string, color: (s: string) => string = cyan) {
    line(`  ${color(icon)}  ${msg}`)
}
function printHeader() {
    const W = 58
    const title = '◆  OWN3D AI OWN3D'
    line()
    line(`  ╭${'─'.repeat(W)}╮`)
    line(`  │${' '.repeat(W)}│`)
    line(`  │   ${bold(title)}${' '.repeat(W - 3 - title.length)}│`)
    line(`  │${' '.repeat(W)}│`)
    line(`  ╰${'─'.repeat(W)}╯`)
    line()
}

async function resolveProjectId(args: Args): Promise<string | undefined> {
    if (args['project']) return String(args['project'])
    const fromEnv = Deno.env.get('OWN3D_PROJECT_ID')
    if (fromEnv) return fromEnv
    const manifestPath = join(Deno.cwd(), 'manifest.yaml')
    if (!await exists(manifestPath)) return undefined
    try {
        const manifest = parse(Deno.readTextFileSync(manifestPath)) as { ai_project_id?: string }
        return manifest?.ai_project_id
    } catch {
        return undefined
    }
}

interface AiProject {
    id: string
    name: string
    description: string
    github_repo: string
    extension?: { summary?: string }
}

async function selectProjectId(authorization: string): Promise<string | undefined> {
    const consoleUrl = Deno.env.get('OWN3D_CONSOLE_URL') || DEFAULT_CONSOLE_URL
    let projects: AiProject[]
    try {
        const { data } = await axios.get(`${consoleUrl}/v1/ai-projects`, {
            headers: { Authorization: authorization },
        })
        projects = data.data ?? []
    } catch (err: any) {
        logError(`Failed to fetch AI projects: ${err?.message ?? err}`)
        return undefined
    }

    if (projects.length === 0) {
        logError('No AI projects found. Create one at the OWN3D Developer Console.')
        return undefined
    }

    return await select('Select an AI project', projects.map(p => ({
        label: p.name,
        hint: p.github_repo,
        value: p.id,
    })))
}

async function fetchConversationProjectId(authorization: string, conversationId: string): Promise<string | undefined> {
    try {
        const { data } = await axios.get(`${NYRA_URL}/v1/conversations/${conversationId}`, {
            headers: { Authorization: authorization },
        })
        return data.metadata?.project_id
    } catch {
        return undefined
    }
}

async function createConversation(authorization: string, projectId: string): Promise<string> {
    const { data } = await axios.post(`${NYRA_URL}/v1/conversations`, {
        metadata: { project_id: projectId },
    }, {
        headers: { Authorization: authorization },
    })
    return data.id
}

export async function ai(args: Args): Promise<number> {
    let headers: Record<string, string>
    try {
        headers = await getHeaders()
    } catch {
        logError('Not logged in. Run: own3d login')
        return 1
    }
    const authorization = headers.Authorization

    let projectId = await resolveProjectId(args)
    const resumeId: string | null = args['resume'] ?? null
    if (!projectId && resumeId) {
        projectId = await fetchConversationProjectId(authorization, resumeId)
    }
    if (!projectId) {
        projectId = await selectProjectId(authorization)
        if (!projectId) return 1
    }
    const serverUrl: string = args['server'] || Deno.env.get('OWN3D_AGENT_URL') || DEFAULT_AGENT_URL

    let isRunning = false
    let isThinking = false
    let inTextStream = false
    let conversationId: string | null = resumeId

    const autoApprove = !!args['auto-approve']
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true, completer: slashCompleter, historySize: 0 })
    rl.on('SIGINT', () => {
        line()
        if (conversationId) line(`${dim('Resume:')}  own3d ai --resume ${conversationId}`)
        line(dim('Bye.'))
        Deno.exit(0)
    })

    function ask(prompt: string): Promise<string> {
        return new Promise(resolve => rl.question(prompt, resolve))
    }

    // --- Loading Spinner UI ---
    let spinnerTimer: number | undefined;
    function startSpinner(msg: string) {
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let i = 0;
        spinnerTimer = setInterval(() => {
            clearLine();
            out(`  ${cyan(frames[i])} ${msg}`);
            i = (i + 1) % frames.length;
        }, 80);
    }

    function stopSpinner() {
        if (spinnerTimer) {
            clearInterval(spinnerTimer);
            spinnerTimer = undefined;
            clearLine();
        }
    }
    // --------------------------

    function showHelp() {
        line()
        line(`${bold('  Slash commands:')}`)
        SLASH_COMMANDS.forEach(s => line(`  ${cyan(s.cmd.padEnd(12))}  ${dim(s.desc)}`))
        line()
    }

    async function fetchConversations(): Promise<any[]> {
        try {
            const { data } = await axios.get(`${NYRA_URL}/v1/conversations`, {
                headers: { Authorization: authorization },
                params: { metadata: { project_id: projectId }, limit: 10 },
            })
            return data.data ?? []
        } catch (err: any) {
            logError(`Failed to fetch conversations: ${err?.message ?? err}`)
            return []
        }
    }

    function conversationChoices(conversations: any[]) {
        return conversations.map((c: any) => ({
            label: c.id.split('-').at(-1) ?? c.id,
            hint: c.created_at ? new Date(typeof c.created_at === 'number' && c.created_at < 1e12 ? c.created_at * 1000 : c.created_at).toLocaleDateString() : undefined,
            value: c.id as string,
            active: c.id === conversationId,
        }))
    }

    async function switchConversation() {
        const conversations = await fetchConversations()
        if (conversations.length === 0) {
            line()
            line(dim('  No conversations found.'))
            return
        }

        const chosen = await select('Switch conversation', conversationChoices(conversations))
        if (!chosen) return
        conversationId = chosen
        status('↩', `Switched  ${dim(conversationId)}`, magenta)
    }

    async function deleteAllConversations() {
        const conversations = await fetchConversations()
        const targets = conversations.filter((c: any) => c.id !== conversationId)
        if (targets.length === 0) {
            line()
            line(dim('  No other conversations to delete.'))
            return
        }

        line()
        const confirm = (await ask(`  ${red('Delete all')}  ${dim(`${targets.length} conversation${targets.length === 1 ? '' : 's'}`)}  [y/N]  `)).trim().toLowerCase()
        if (confirm !== 'y') {
            status('○', 'Cancelled', yellow)
            return
        }

        let deleted = 0
        await Promise.all(targets.map(async (c: any) => {
            try {
                await axios.delete(`${NYRA_URL}/v1/conversations/${c.id}`, {
                    headers: { Authorization: authorization },
                })
                deleted++
            } catch {
                status('✗', `Failed to delete ${c.id.split('-').at(-1) ?? c.id}`, red)
            }
        }))

        status('✗', `Deleted ${deleted} of ${targets.length} conversation${targets.length === 1 ? '' : 's'}`, red)
    }

    async function deleteConversation() {
        const conversations = await fetchConversations()
        if (conversations.length === 0) {
            line()
            line(dim('  No conversations found.'))
            return
        }

        const chosen = await select('Delete conversation', conversationChoices(conversations))
        if (!chosen) return

        const shortId = chosen.split('-').at(-1) ?? chosen
        const confirm = (await ask(`  ${red('Delete')}  ${dim(shortId)}  [y/N]  `)).trim().toLowerCase()
        if (confirm !== 'y') {
            status('○', 'Cancelled', yellow)
            return
        }

        try {
            await axios.delete(`${NYRA_URL}/v1/conversations/${chosen}`, {
                headers: { Authorization: authorization },
            })
            status('✗', `Deleted  ${dim(shortId)}`, red)
            if (chosen === conversationId) {
                conversationId = await createConversation(authorization, projectId!)
                status('↩', `New conversation  ${dim(conversationId)}`, magenta)
            }
        } catch (err: any) {
            logError(`Failed to delete: ${err?.message ?? err}`)
        }
    }

    async function handleSlashCommand(input: string) {
        const [command] = input.trim().split(/\s+/)
        switch (command) {
            case '/switch':
                await switchConversation()
                break
            case '/new':
                conversationId = await createConversation(authorization, projectId!)
                status('↩', `New conversation  ${dim(conversationId)}`, magenta)
                break
            case '/delete':
                await deleteConversation()
                break
            case '/delete-all':
                await deleteAllConversations()
                break
            case '/help':
                showHelp()
                break
            case '/exit':
                line()
                if (conversationId) line(`${dim('Resume:')}  own3d ai --resume ${conversationId}`)
                line(dim('Bye.'))
                Deno.exit(0)
                break
            default: {
                const hits = SLASH_COMMANDS.filter(s => s.cmd.startsWith(command))
                line()
                if (hits.length) {
                    line(`${yellow('  Did you mean:')}`)
                    hits.slice(0, 5).forEach(s => line(`  ${cyan(s.cmd.padEnd(12))}  ${dim(s.desc)}`))
                } else {
                    line(`${red('  Unknown command:')} ${command}`)
                    showHelp()
                }
                line()
            }
        }
    }

    line()
    startSpinner(dim('Connecting to agent...'))

    const socket = io(serverUrl, {
        query: { authorization, projectId },
        transports: ['websocket'],
    })

    function startRun(input: string) {
        isRunning = true
        socket.emit('run.start', { input, conversationId: conversationId ?? undefined })
    }

    async function promptAndRun() {
        if (isRunning) return
        line()

        let ghost = ''

        const renderGhost = (cur: string) => {
            // \x1b[0K erases from cursor to EOL — clears any previous ghost text
            out('\x1b[0K')
            ghost = ''
            const cursor: number = (rl as any).cursor ?? cur.length
            // Only show ghost when cursor is at end of line, input starts with /,
            // and the input is not already an exact command (avoids /delete → /delete-all confusion)
            if (cursor < cur.length || !cur.startsWith('/') || cur.length === 0) return
            if (SLASH_COMMANDS.some(s => s.cmd === cur)) return
            const match = SLASH_COMMANDS.find(s => s.cmd.startsWith(cur) && s.cmd.length > cur.length)
            if (!match) return
            ghost = match.cmd.slice(cur.length)
            // Write dim ghost text then move cursor back so user keeps typing at same spot
            out(`\x1b[2m${ghost}\x1b[0m\x1b[${ghost.length}D`)
        }

        const onKeypress = () => setImmediate(() => renderGhost((rl as any).line ?? ''))
        process.stdin.on('keypress', onKeypress)

        const input = await new Promise<string>(resolve => {
            rl.question(`${bold(cyan('You'))}  `, answer => {
                process.stdin.off('keypress', onKeypress)
                resolve(answer.trim())
            })
        })

        if (!input) { await promptAndRun(); return }
        if (input.startsWith('/')) {
            await handleSlashCommand(input)
            await promptAndRun()
            return
        }
        startRun(input)
    }

    socket.on('project.connected', async (data: any) => {
        stopSpinner() // Hide spinner once successfully connected

        const projectName = data.project?.name ?? 'AI OWN3D'

        line()
        line(`  ${bold(magenta('OWN3D'))}  ${bold('AI OWN3D')}`)
        line(`  ${dim('─'.repeat(54))}`)
        line(`  ${cyan(projectName)}`)
        line()

        status('✓', `Connected  ${dim(projectId)}`, green)

        if (!conversationId) {
            conversationId = await createConversation(authorization, projectId)
        }
        status('↩', `Conversation  ${dim(conversationId)}`, magenta)
        await promptAndRun()
    })

    socket.on('thinking.start', () => {
        isThinking = true
        line()
        out(dim('  ◆ Thinking…'))
    })

    socket.on('thinking.stop', () => {
        if (isThinking) { clearLine(); isThinking = false }
    })

    socket.on('run.event', (data: any) => {
        const raw = data?.event?.event
        if (!raw) return
        const type: string = raw.type ?? ''

        if (type === 'response.output_text.delta') {
            if (!inTextStream) {
                if (isThinking) { clearLine(); isThinking = false }
                line()
                out(`${bold('OWN3D')}  `)
                inTextStream = true
            }
            out(raw.delta ?? '')
        } else if (type === 'response.output_text.done') {
            if (inTextStream) { line(); inTextStream = false }
        } else if (type === 'response.output_item.added') {
            const item = raw.item ?? {}
            if (item.type === 'function_call') {
                if (isThinking) { clearLine(); isThinking = false }
                if (inTextStream) { line(); inTextStream = false }
                line()
                line(`${yellow('  ⚙ Tool')}  ${bold(item.name ?? '?')}`)
            }
        } else if (type === 'response.function_call_arguments.done') {
            try {
                const argObj = JSON.parse(raw.arguments ?? '{}')
                const preview = Object.entries(argObj)
                    .map(([k, v]) => `${dim(String(k))}=${String(JSON.stringify(v)).slice(0, 100)}`)
                    .join('  ')
                if (preview) line(`         ${preview}`)
            } catch { /* skip malformed args */ }
        }
    })

    socket.on('run.completed', async () => {
        isRunning = false; inTextStream = false
        await promptAndRun()
    })

    socket.on('run.cancelled', async () => {
        isRunning = false; inTextStream = false
        line()
        status('○', 'Cancelled', yellow)
        await promptAndRun()
    })

    socket.on('run.error', async (data: any) => {
        isRunning = false; inTextStream = false
        if (isThinking) { clearLine(); isThinking = false }
        line()
        status('✗', `Error: ${data?.message ?? 'unknown error'}`, red)
        if (data?.hint) line(`  ${dim(data.hint)}`)
        await promptAndRun()
    })

    socket.on('approval.request', async (req: any) => {
        if (isThinking) { clearLine(); isThinking = false }
        if (inTextStream) { line(); inTextStream = false }
        line()
        line(`${yellow('  ⚠  Approval required')}  ${bold(req.name ?? req.itemId)}`)
        const params = req.params ?? {}
        for (const [k, v] of Object.entries(params)) {
            const val = String(typeof v === 'string' ? v : JSON.stringify(v)).slice(0, 120)
            line(`     ${dim(k + ':')} ${val}`)
        }
        if (autoApprove) {
            status('✓', 'Auto-approved', green)
            socket.emit('approval.answer', { itemId: req.itemId, approve: true, reason: 'Auto-approved' })
            return
        }
        line()
        const answer = (await ask('  Approve? [Y/n]  ')).trim().toLowerCase()
        const approve = answer !== 'n'
        socket.emit('approval.answer', {
            itemId: req.itemId,
            approve,
            reason: approve ? 'Approved by user' : 'Rejected by user',
        })
    })

    socket.on('disconnect', (reason: string) => {
        stopSpinner() // Ensure spinner halts on DC
        line()
        status('✗', `Disconnected: ${reason}`, red)
        if (conversationId) line(`${dim('Resume:')}  own3d ai --resume ${conversationId}`)
        Deno.exit(1)
    })

    socket.on('connect_error', (err: any) => {
        stopSpinner() // Ensure spinner halts on connection error
        line()
        status('✗', `Connection error: ${err?.message ?? err}`, red)
        Deno.exit(1)
    })

    // Keep the process alive — socket event handlers drive the lifetime
    return await new Promise<number>(() => {})
}