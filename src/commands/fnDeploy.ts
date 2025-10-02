import type { Args } from "https://deno.land/std@0.207.0/cli/parse_args.ts";
import axios from "npm:axios";
import { getHeaders } from "../helpers/getHeaders.ts";
import { getFilteredFiles } from "../helpers/compress.ts";
import { join } from "../helpers/deps.ts";
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";
import { bold, green, red, yellow, cyan, magenta, bgRed, bgGreen } from "https://deno.land/std@0.224.0/fmt/colors.ts";

export async function fnDeploy(_args: Args): Promise<number> {
    const directoryName: string = _args._[0] as string;
    const archiveName: string = join(Deno.cwd(), "archive.zip");
    const projectDirectory: string = join(Deno.cwd(), directoryName ?? ".");

    // check if function contains a valid manifest
    const manifestFile: string = join(projectDirectory, ".own3d", "manifest.json");
    try {
        if (!Deno.statSync(manifestFile).isFile) {
            console.error(bgRed(bold(" ERROR ")) + " " + red("Invalid function, missing manifest"));
            return 1;
        }
    } catch (_e) {
        console.error(bgRed(bold(" ERROR ")) + " " + red("Invalid function, missing manifest"));
        return 1
    }
    const manifest = JSON.parse(Deno.readTextFileSync(manifestFile));

    if (!manifest) {
        console.error(bgRed(bold(" ERROR ")) + " " + red("Invalid function, missing manifest"));
        return 1;
    }

    if (!manifest.name || !manifest.version || !manifest.entrypoint) {
        console.error(bgRed(bold(" ERROR ")) + " " + red("Invalid manifest, missing required fields"));
        return 1;
    }

    console.log(cyan(`➜ Compressing ${manifest.name} function...`));

    // Get filtered files (excluding those matching .gitignore patterns)
    const filesToCompress = await getFilteredFiles(projectDirectory, [
        "archive.zip",
        ".own3d",
    ]);

    const zip = new JSZip();

    for (const file of filesToCompress) {
        zip.addFile(file, await Deno.readFile(join(projectDirectory, file)));
    }

    await zip.writeZip(archiveName);

    console.log(green("✔ Function compressed"));
    console.log(magenta(`ℹ️  Deploying ${manifest.name} function...`));

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
            "https://ext.own3d.pro/v1/edge-functions/deploy",
            formData,
            {
                headers: await getHeaders(),
            },
        );

        console.log(bgGreen(bold(" SUCCESS ")) + " " + green("Deployment is live!"));

        response.data.domains.forEach((domain: string) => {
            console.log(cyan(`Website URL: ${domain}`));
        });
    } catch (e) {
        console.error(bgRed(bold(" FAIL ")) + " " + red("Failed to deploy function"));
        if (e.response?.data?.message) {
            console.error(red(e.response.data.message));
        } else {
            console.error(red(e.message));
        }
        return 1;
    } finally {
        await Deno.remove(archiveName);
    }

    return 0;
}
