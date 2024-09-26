import type { Args } from 'https://deno.land/std@0.207.0/cli/parse_args.ts'
import { getHeaders } from '../helpers/getHeaders.ts'
import { join } from '../helpers/deps.ts'
import axios from 'npm:axios'
import { parse, stringify } from 'jsr:@std/yaml'
import { compress } from '../helpers/compress.ts'
import { exists } from 'https://deno.land/std@0.220.1/fs/exists.ts'
import { HumanSize } from '../utils.ts'

export interface ExtensionManifest {
    schema_version: number
    id: string
    name?: string
    version: string
    description?: string
    summary?: string
    compatibilities?: {
        config?: {
            path?: string
        }
        'browser-source'?: {
            path?: string
            forms?: {
                config_button?: string
                inputs?: {
                    id: string
                    type: string
                    attributes: {
                        label: string
                        value: string
                        description: string
                    }
                    validations: {
                        required: boolean
                    }
                }[]
            }
        }
    }
    store_presence?: {
        category?: string
        images?: {
            icon?: string
            logo?: string
            discovery?: string
        }
        screenshots?: string[]
        keywords?: string[]
    }
    author?: {
        name?: string
        email?: string
    }
    publisher?: {
        name?: string
    }
    support?: {
        url?: string
        email?: string
    }
    legal?: {
        terms?: string
        privacy?: string
    }
    oauth?: {
        scopes?: string[]
        redirect_uri?: string
    }
    monetization?: {
        in_app_purchase?: {
            products?: {
                sku: string
                name: string
                description: string
                price: number
            }[]
        }
        subscriptions?: {
            sku: string
            name: string
            description: string
            recurrence: string
            price: number
        }[]
    }
}

export async function extDeploy(args: Args): Promise<number> {
    // check if extension contains a valid manifest
    const manifestFile = join(Deno.cwd(), args['manifest'] ?? 'manifest.yaml')
    if (!Deno.statSync(manifestFile).isFile) {
        console.error('Invalid extension, missing manifest')
        return 1
    }

    const manifest: ExtensionManifest = parse(Deno.readTextFileSync(manifestFile))

    if (!manifest) {
        console.error('Invalid extension, invalid manifest')
        return 1
    }

    if (!manifest.name || !manifest.version) {
        console.error('Invalid manifest, missing required fields')
        return 1
    }

    console.log(`- Bundling extension...`)

    const distFolder = join(Deno.cwd(), args['dist'] ?? 'dist')
    if (!Deno.statSync(distFolder).isDirectory) {
        console.error('Invalid extension, missing dist folder')
        return 1
    }

    // get all files in the dist folder
    const files = []
    for await (const entry of Deno.readDir(distFolder)) {
        files.push(join(distFolder, entry.name))
    }

    // compress the dist folder
    const archiveName = join(Deno.cwd(), 'extension.zip')
    const success = await compress(files, archiveName, {
        flags: [],
        overwrite: true,
    })

    if (!success) {
        console.error('Failed to compress extension')
        return 1
    }

    console.log('✔ Extension bundled')

    const extensionSize = HumanSize(Deno.statSync(archiveName).size)
    console.log(`- Deploying extension (script size: ${extensionSize})...`)
    try {
        const {data} = await deployExtension(manifest, archiveName, args)

        console.log('✔ Extension is updated!')

        console.log('Visit your extension at:')
        console.log(`https://console.dev.own3d.tv/resources/extension-versions/${data.version.id}`)
        // deno-lint-ignore no-explicit-any
    } catch (e: any) {
        // x emoji
        console.error('✘ Failed to deploy extension')
        if (e.response?.data?.message)
            console.error(e.response?.data.message)
        else
            console.error(e.message)

        return 1
    } finally {
        if (await exists(archiveName)) {
            await Deno.remove(archiveName)
        }
    }

    return 0
}

function appendFiles(manifest: ExtensionManifest, data: FormData) {
    appendFile(manifest.store_presence?.images?.logo, data)
    appendFile(manifest.store_presence?.images?.icon, data)
    appendFile(manifest.store_presence?.images?.discovery, data)
    manifest.store_presence?.screenshots?.forEach((screenshot) => {
        appendFile(screenshot, data)
    })
}

function appendFile(path: string | undefined, data: FormData) {
    if (!path) return
    const file = Deno.readFileSync(path)
    data.append(`assets[${encodeURI(path)}]`, new Blob([file], {
        type: 'application/octet-stream',
    }), path.split('/').pop())
}

async function deployExtension(
    manifest: ExtensionManifest,
    archiveName: string,
    args: Args,
) {
    const data = new FormData()
    const compressed = Deno.readFileSync(archiveName)
    data.append('file', new Blob([compressed], {
        type: 'application/zip',
    }), 'archive.zip')
    data.append('manifest', new Blob([stringify(manifest)], {
        type: 'application/yaml',
    }), 'manifest.yaml')

    if (args['assets']) {
        // append all files to the form data
        appendFiles(manifest, data)
    }

    if (args['stage']) {
        data.append('stage', args['stage'])
    } else {
        data.append('stage', 'local-test')
    }

    return axios.post(`https://ext.own3d.pro/v1/extensions/deploy`, data, {
        headers: {
            ...await getHeaders(),
            'Accept': 'application/json',
        },
    })
}
