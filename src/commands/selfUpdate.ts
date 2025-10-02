import type {Args} from "https://deno.land/std@0.207.0/cli/parse_args.ts";
import { setLoggerQuiet, step, success, error as logError } from "../helpers/logger.ts";

export async function selfUpdate(_args: Args): Promise<number> {
    const quiet = !!(_args.quiet || _args.q);
    setLoggerQuiet(quiet);
    const command = new Deno.Command(Deno.execPath(), {
        args: ['install', '-Arfg', 'https://cli.own3d.dev']
    })

    step('Updating...');
    const {code} = await command.output();

    if (code === 0) {
        success('Updated successfully!');
    } else {
        logError('Failed to update!');
    }

    return code;
}