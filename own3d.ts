#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-net --allow-run --allow-sys --quiet
// deno-lint-ignore-file
// noinspection JSIgnoredPromiseFromCall

import { Args, parseArgs } from 'https://deno.land/std@0.207.0/cli/parse_args.ts'
import { fnCreate } from './src/commands/fnCreate.ts'
import { fnDeploy } from './src/commands/fnDeploy.ts'
import { login } from './src/commands/login.ts'
import { selfUpdate } from './src/commands/selfUpdate.ts'
import { extDeploy } from './src/commands/extDeploy.ts'
import { extInit } from "./src/commands/extInit.ts";
import { ExtDeployHelp } from './src/utils.ts'
import axios from 'npm:axios'

const version: string = '0.1.0-rc.2'

// set user agent for axios
axios.defaults.headers['User-Agent'] = `own3d-cli/${version}`

const help: string = `own3d ${version}
Command line tool for OWN3D Apps.

SUBCOMMANDS:
    ext:deploy   Deploy an extension to the cloud
    ext:init     Initialize a new extension project
    fn:create    Create a new edge function project
    fn:deploy    Deploy a edge function to the cloud
    self-update  Update the CLI to the latest version
    login        Log in to OWN3D

For more information, read the documentation at https://dev.own3d.tv/docs/cli/
`

const args: Args = parseArgs(Deno.args)
const subcommand = args._.shift()

if (args['help'] || args['h']) {
    switch (subcommand) {
        case 'ext:deploy':
            console.log(ExtDeployHelp)
            break
        default:
            console.log(help)
            break
    }
    Deno.exit(0)
}

// noinspection FallThroughInSwitchStatementJS
switch (subcommand) {
    case 'ext:deploy':
        Deno.exit(await extDeploy(args))
    case 'ext:init':
        Deno.exit(await extInit(args))
    case 'fn:create':
        Deno.exit(await fnCreate(args))
    case 'fn:deploy':
        Deno.exit(await fnDeploy(args))
    case 'fn:run':
        console.log('Running...')
        break
    case 'self-update':
        Deno.exit(await selfUpdate(args))
    case 'login':
        Deno.exit(await login(args))
    default:
        if (args.version) {
            console.log(version)
            Deno.exit(0)
        }
        if (args.help) {
            console.log(help)
            Deno.exit(0)
        }
        console.error(help)
        Deno.exit(1)
}