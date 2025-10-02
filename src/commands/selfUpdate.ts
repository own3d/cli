import type {Args} from "https://deno.land/std@0.207.0/cli/parse_args.ts";
import { bold, green, red, cyan, bgRed, bgGreen } from "../helpers/colors.ts";

export async function selfUpdate(_args: Args): Promise<number> {
    const quiet = !!(_args.quiet || _args.q);
    const command = new Deno.Command(Deno.execPath(), {
        args: ['install', '-Arfg', 'https://cli.own3d.dev']
    })

    if (!quiet) console.log(cyan('➜ Updating...'));
    const {code} = await command.output();

    if (code === 0) {
        if (!quiet) console.log(bgGreen(bold(' SUCCESS ')) + ' ' + green('Updated successfully!'));
    } else {
        console.error(bgRed(bold(' FAIL ')) + ' ' + red('Failed to update!'));
    }

    return code;
}