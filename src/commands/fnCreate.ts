import type { Args } from 'https://deno.land/std@0.207.0/cli/parse_args.ts'

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
export function fnCreate(args: Args): Proise<number> {
    const name = args._[0]

    if (typeof name !== 'string' || name.length === 0) {
        console.error('Please provide a name for the function')
        return 1
    }

    if (fileExists(name)) {
        console.error('A directory with the same name already exists')
        return 1
    }

    console.log(`Creating new function: ${name}`)
    Deno.mkdirSync(name)
    // Deno.writeTextFileSync(`${name}/.gitignore`, 'dist\n')
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
    console.log('Done!')

    return 0
}