import { exists, join } from './deps.ts'

interface CompressOptions {
    overwrite?: boolean;
    flags: string[];
    cwd?: string;
}

const compressProcess = async (
    files: string | string[],
    archiveName: string = './archive.zip',
    options?: CompressOptions,
): Promise<boolean> => {
    if (await exists(archiveName) && !(options?.overwrite)) {
        throw `The archive file ${
            join(Deno.cwd(), archiveName)
        }.zip already exists, Use the {overwrite: true} option to overwrite the existing archive file`
    }
    const filesList = typeof files === 'string'
        ? files
        : files.join(Deno.build.os === 'windows' ? ', ' : ' ')
    const compressCommandProcess = Deno.build.os === 'windows'
        ? new Deno.Command('PowerShell', {
            args: [
                'Compress-Archive',
                '-Path',
                filesList,
                '-DestinationPath',
                archiveName,
                ...(options?.overwrite ? ['-Force'] : [])
            ],
        })
        : new Deno.Command('zip', {
            args: ['-r', ...options?.flags ?? [], archiveName, ...filesList.split(' ')],
        });

    const { success } = await compressCommandProcess.output();
    return success
}

export const compress = async (
    files: string | string[],
    archiveName: string = './archive.zip',
    options?: CompressOptions,
): Promise<boolean> => {
    return await compressProcess(files, archiveName, options)
}
