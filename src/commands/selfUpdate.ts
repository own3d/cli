import type {Args} from "https://deno.land/std@0.207.0/cli/parse_args.ts";
import { bold, green, red, yellow, cyan, bgRed, bgGreen } from "https://deno.land/std@0.224.0/fmt/colors.ts";

export async function selfUpdate(_args: Args): Promise<number> {
    const command = new Deno.Command(Deno.execPath(), {
        args: ['install', '-Arfg', 'https://cli.own3d.dev']
    })

    console.log(cyan('➜ Updating...'));
    // create subprocess and collect output
    const {code} = await command.output();

    if (code === 0) {
        console.log(bgGreen(bold(' SUCCESS ')) + ' ' + green('Updated successfully!'));
    } else {
        console.error(bgRed(bold(' FAIL ')) + ' ' + red('Failed to update!'));
    }

    return code;
}