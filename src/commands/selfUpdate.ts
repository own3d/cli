import type {Args} from "https://deno.land/std@0.207.0/cli/parse_args.ts";

export async function selfUpdate(_args: Args): Promise<number> {
    const command = new Deno.Command(Deno.execPath(), {
        args: ['install', '-Arfg', 'https://cli.own3d.dev']
    })

    console.log('Updating...')
    // create subprocess and collect output
    const {code} = await command.output();

    if (code === 0) {
        console.log('Updated successfully!')
    } else {
        console.error('Failed to update!')
    }

    return code;
}