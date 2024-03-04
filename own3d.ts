import { parseArgs } from 'https://deno.land/std@0.207.0/cli/parse_args.ts'

const help: string = `own3d 0.0.1
Command line tool for OWN3D Apps.

SUBCOMMANDS:
    fn:deploy    Deploy a function to the cloud
    fn:run       Run a function locally

For more information, read the documentation at https://dev.own3d.tv/docs/cli/
`

const args = parseArgs(Deno.args)
const subcommand: string = args._.shift()
switch (subcommand) {
    case 'fn:deploy':
        console.log('Deploying...')
        break
    case 'fn:run':
        console.log('Running...')
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