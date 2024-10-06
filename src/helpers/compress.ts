import { exists, join } from './deps.ts';
import { string } from 'https://deno.land/x/clay@v0.2.5/mod.ts'

interface CompressOptions {
    overwrite?: boolean;
    flags?: string[];
    cwd?: string;  // Add the cwd (current working directory) option for relative path handling
}

const compressProcess = async (
    files: string | string[],
    archiveName: string = './archive.zip',
    options?: CompressOptions,
): Promise<boolean> => {
    // Ensure the archive does not already exist if overwrite is not enabled
    if (await exists(archiveName) && !(options?.overwrite)) {
        throw `The archive file ${join(Deno.cwd(), archiveName)}.zip already exists. Use the {overwrite: true} option to overwrite the existing archive file.`;
    }

    // Convert `files` to a string of space-separated paths
    const filesList = typeof files === 'string'
        ? [files]
        : files;

    // Ensure `flags` array exists, even if not provided
    const flags = options?.flags ?? [];

    // Resolve the working directory (defaults to the current directory if not provided)
    const cwd = options?.cwd || Deno.cwd();

    // Adjust the command depending on the OS
    const compressCommandProcess = Deno.build.os === 'windows'
        ? new Deno.Command('PowerShell', {
            args: [
                'Compress-Archive',
                '-Path',
                filesList.join(','),
                '-DestinationPath',
                archiveName,
                ...(options?.overwrite ? ['-Force'] : [])
            ],
        })
        : new Deno.Command('zip', {
            args: ['-r', ...flags, archiveName, ...filesList.map(file => `-j ${join(cwd, file)}`)],
        });

    // Execute the compression command
    const { success } = await compressCommandProcess.output();

    return success;
};

export const compress = async (
    files: string | string[],
    archiveName: string = './archive.zip',
    options?: CompressOptions,
): Promise<boolean> => {
    return await compressProcess(files, archiveName, options);
};

// Helper function to read and parse .gitignore
async function parseGitignore(cwd: string): Promise<string[]> {
    const gitignorePath = join(cwd, '.gitignore');
    if (await exists(gitignorePath)) {
        const content = await Deno.readTextFile(gitignorePath);
        return content.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#')); // Exclude comments and empty lines
    }
    return [];
}

// Function to filter out files matching .gitignore patterns
export async function getFilteredFiles(cwd: string, patterns: string[]): Promise<string[]> {
    const gitignorePatterns = await parseGitignore(cwd);
    gitignorePatterns.push(...patterns);
    const allFiles: string[] = [];

    // Helper function to check if a file matches any of the ignore patterns
    function isIgnored(filePath: string): boolean {
        return gitignorePatterns.some(pattern => new RegExp(pattern).test(filePath));
    }

    // Recursive function to collect files
    async function collectFiles(dir: string) {
        for await (const dirEntry of Deno.readDir(dir)) {
            const fullPath = `${dir}/${dirEntry.name}`;

            // Skip if the file is ignored
            if (isIgnored(fullPath)) {
                continue;
            }

            if (dirEntry.isDirectory) {
                // Recurse into subdirectories
                await collectFiles(fullPath);
            } else if (dirEntry.isFile) {
                // Strip the cwd and add relative paths
                const relativePath = fullPath.slice(cwd.length + 1);
                allFiles.push(relativePath);
            }
        }
    }

    // Start the recursion from the current directory
    await collectFiles(cwd);

    return allFiles;
}