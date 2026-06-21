import process from 'node:process'
import readline from 'node:readline'
import { bold, cyan, green, isColorDisabled } from './colors.ts'

const dim = (s: string) => isColorDisabled() ? s : `\x1b[2m${s}\x1b[0m`

export interface Choice<T> {
    label: string
    hint?: string
    value: T
    active?: boolean
}

const MAX_VISIBLE = 8

function write(s: string) { process.stdout.write(s) }

export async function select<T>(message: string, choices: Choice<T>[]): Promise<T | undefined> {
    if (choices.length === 0) return undefined
    if (!(process.stdin as any).isTTY) return undefined

    let idx = Math.max(0, choices.findIndex(c => c.active))
    let drawn = 0

    const clear = () => {
        if (!drawn) return
        write(`\r\x1b[${drawn}A\x1b[0J`)
        drawn = 0
    }

    const redraw = () => {
        clear()
        const total = choices.length
        const half = Math.floor(MAX_VISIBLE / 2)
        const start = Math.max(0, Math.min(idx - half, total - MAX_VISIBLE))
        const end = Math.min(total, start + MAX_VISIBLE)

        write(`\n  ${bold(message)}\n\n`)
        drawn += 3

        if (start > 0) { write(`  ${dim(`↑ ${start} more`)}\n`); drawn++ }

        for (let i = start; i < end; i++) {
            const c = choices[i]
            const sel = i === idx
            const marker = sel ? cyan('●') : c.active ? green('●') : dim('○')
            const label  = sel ? bold(c.label) : c.active ? green(c.label) : c.label
            const hint   = c.hint ? `  ${dim(c.hint)}` : ''
            write(`  ${marker}  ${label}${hint}\n`)
            drawn++
        }

        if (end < total) { write(`  ${dim(`↓ ${total - end} more`)}\n`); drawn++ }

        write('\n')
        drawn++
    }

    redraw()

    readline.emitKeypressEvents(process.stdin)
    const wasRaw = (process.stdin as any).isRaw ?? false
    if (!wasRaw) (process.stdin as any).setRawMode?.(true)

    return new Promise<T | undefined>(resolve => {
        const restore = () => {
            process.stdin.off('keypress', handler)
            if (!wasRaw) (process.stdin as any).setRawMode?.(false)
        }

        const done = (value: T | undefined) => { restore(); clear(); resolve(value) }

        const handler = (_: unknown, key: { name?: string; ctrl?: boolean; shift?: boolean } | undefined) => {
            if (!key) return
            const { name, ctrl, shift } = key
            if (ctrl && name === 'c')                    { restore(); write('\n'); process.exit(0) }
            else if (name === 'up' || (name === 'tab' && shift))  { idx = (idx - 1 + choices.length) % choices.length; redraw() }
            else if (name === 'down' || (name === 'tab' && !shift)) { idx = (idx + 1) % choices.length; redraw() }
            else if (name === 'return')                   { done(choices[idx].value) }
            else if (name === 'escape')                   { done(undefined) }
        }

        process.stdin.on('keypress', handler)
    })
}
