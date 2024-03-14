#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-net --allow-run --allow-sys --quiet
// deno-lint-ignore-file
import { Args, parseArgs } from 'https://deno.land/std@0.207.0/cli/parse_args.ts'
import { fnCreate } from './src/commands/fnCreate.ts'
import { fnDeploy } from './src/commands/fnDeploy.ts'
import { login } from './src/commands/login.ts'

const help: string = `own3d 0.0.1
Command line tool for OWN3D Apps.

SUBCOMMANDS:
    fn:create    Create a new edge function project
    fn:deploy    Deploy a edge function to the cloud

For more information, read the documentation at https://dev.own3d.tv/docs/cli/
`

const args: Args = parseArgs(Deno.args)
const subcommand = args._.shift()
switch (subcommand) {
    case 'fn:create':
        fnCreate(args)
        break
    case 'fn:deploy':
        fnDeploy(args)
        break
    case 'fn:run':
        console.log('Running...')
        break
    case 'login':
        login(args)
        break
    default:
        if (args.version) {
            console.log('0.0.1')
            Deno.exit(0)
        }
        if (args.help) {
            console.log(help)
            Deno.exit(0)
        }
        console.error(help)
        Deno.exit(1)
}