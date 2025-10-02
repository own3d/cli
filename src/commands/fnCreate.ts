import type { Args } from 'https://deno.land/std@0.207.0/cli/parse_args.ts'
import { setLoggerQuiet, step, success, error as logError } from "../helpers/logger.ts";

function fileExists(name: string) {
    try {
        Deno.statSync(name)
        return true
    } catch (e) {
        if (e instanceof Deno.errors.NotFound) {
            return false
        }
        throw e
    }
}

/**
 * Create a new edge function project
 *
 * This command will create a new directory with the following structure:
 *
 * my-function
 * ├── .gitignore
 * ├── .own3d
 * │   └── manifest.json
 * └── index.ts
 *
 * @param args
 */
export function fnCreate(args: Args): Promise<number> {
    const quiet = !!(args.quiet || args.q);
    setLoggerQuiet(quiet);
    const name = args._[0]

    if (typeof name !== 'string' || name.length === 0) {
        logError('Please provide a name for the function')
        return Promise.resolve(1)
    }

    if (fileExists(name)) {
        logError('A directory with the same name already exists')
        return Promise.resolve(1)
    }

    step(`Creating new function: ${name}`)
    Deno.mkdirSync(name)
    Deno.mkdirSync(`${name}/.own3d`)
    Deno.writeTextFileSync(`${name}/.own3d/manifest.json`, `{
    "name": "${name}",
    "version": "0.0.1",
    "description": "My new function",
    "entrypoint": "index.ts"
}`)
    Deno.writeTextFileSync(`${name}/index.ts`, `Deno.serve((req) => new Response("Hello!"));

interface Person {
  name: string;
  age: number;
}

function greet(person: Person) {
  return "Hello, " + person.name + "!";
}

console.log(greet({ name: "Alice", age: 36 }));`)
    if (!quiet) success('Done!')

    return Promise.resolve(0)
}