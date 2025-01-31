import { join } from 'https://deno.land/std@0.220.0/path/join.ts'
import { string } from 'https://deno.land/x/clay@v0.2.5/src/types.ts'
import { exists } from 'https://deno.land/std@0.133.0/fs/exists.ts'

export const DockerDenoDir: string = '/home/deno'
export const DockerModsDir: string = `${DockerDenoDir}/modules`
export const DockerFuncDirPath: string = `${DockerDenoDir}/functions`


export const Own3dCliDirPath: string = '.own3d-cli'
export const TempDir: string = join(Own3dCliDirPath, '.temp')
export const FunctionsDir: string = join(Own3dCliDirPath, 'functions')

export const ExtDeployHelp: string = `Read more: https://dev.own3d.tv/docs/cli/

Usage: own3d ext:deploy [OPTIONS]

Options:
    --help, -h      Show this help message
    --dist          Path to the extension's dist directory [default: dist]
    --manifest      Path to the extension's manifest file [default: manifest.yaml]
    --assets        Upload all assets (logos, screenshots, etc.) [default: false]
    --stage         Publish to a specific stage [default: local-test]
    --manifest-only Only upload the manifest file [default: false]
`

export const HumanSize = (bytes: number): string => {
    const sizes: string[] = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 Byte'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i]
}

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