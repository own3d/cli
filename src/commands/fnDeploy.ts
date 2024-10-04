import type { Args } from "https://deno.land/std@0.207.0/cli/parse_args.ts";
import axios from "npm:axios";
import { getHeaders } from "../helpers/getHeaders.ts";
import { compress, getFilteredFiles } from "../helpers/compress.ts";
import { join } from "../helpers/deps.ts";

export async function fnDeploy(_args: Args): Promise<number> {
    const directoryName: string = _args._[0] as string;
    const archiveName: string = join(Deno.cwd(), "archive.zip");
    const projectDirectory: string = join(Deno.cwd(), directoryName ?? ".");

    // check if function contains a valid manifest
    const manifestFile: string = join(projectDirectory, ".own3d", "manifest.json");
    if (!Deno.statSync(manifestFile).isFile) {
        console.error("Invalid function, missing manifest");
        return 1;
    }
    const manifest = JSON.parse(Deno.readTextFileSync(manifestFile));

    if (!manifest) {
        console.error("Invalid function, missing manifest");
        return 1;
    }

    if (!manifest.name || !manifest.version || !manifest.entrypoint) {
        console.error("Invalid manifest, missing required fields");
        return 1;
    }

    console.log(`- Compressing ${manifest.name} function...`);

    // Get filtered files (excluding those matching .gitignore patterns)
    const filesToCompress = await getFilteredFiles(projectDirectory, [
        "archive.zip",
        ".own3d",
    ]);

    // Use the contents of the current directory for compression
    const zipped: boolean = await compress(
        filesToCompress,
        archiveName,
        {
            overwrite: true,
            flags: [],
            cwd: projectDirectory,
        },
    );

    if (!zipped) {
        console.error("Failed to zip function");
        return 1;
    }

    console.log("✔ Function compressed");
    console.log(`- Deploying ${manifest.name} function...`);

    try {
        const file = await Deno.readFile(archiveName);
        const formData = new FormData();
        formData.append("format", "esm-cdn");
        formData.append(
            "manifest",
            new Blob([JSON.stringify(manifest)], { type: "application/json" }),
            "manifest.json",
        );
        formData.append("file", new Blob([file]), "function.zip");
        const response = await axios.post(
            "http://localhost:8000/api/v1/edge-functions/deploy",
            formData,
            {
                headers: await getHeaders(),
            },
        );

        console.log("✔ Deployment is live!");

        response.data.domains.forEach((domain: string) => {
            console.log(`Website URL: ${domain}`);
        });
    } catch (e) {
        console.error("Failed to deploy function");
        if (e.response?.data?.message) {
            console.error(e.response?.data.message);
        } else {
            console.error(e.message);
        }
        return 1;
    } finally {
        await Deno.remove(archiveName);
    }

    return 0;
}
