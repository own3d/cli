// deno-lint-ignore-file
import type { Args } from "https://deno.land/std@0.207.0/cli/parse_args.ts";
import { join } from "../helpers/deps.ts";
import axios from "npm:axios";
import {stringify} from "https://deno.land/std@0.224.0/yaml/stringify.ts";
import { bold, green, red, yellow, cyan, magenta, bgRed, bgGreen, underline } from "https://deno.land/std@0.224.0/fmt/colors.ts";

async function createManifestFile(manifestFile: string, extension: any, version: any) {
    const manifest: Partial<ExtensionManifest> = {
        schema_version: 1,
        id: extension.id,
        name: extension.name,
        version: version.version,
        description: extension.description,
        summary: extension.summary,
        compatibilities: {},
    };

    // fill compatibilities
    version.compatibilities.forEach((compatibility: ExtensionCompatibility) => {
        const newCompatibility: any = {
            path: compatibility.pivot.path,
        };

        if (compatibility.pivot.sizing) {
            newCompatibility.sizing = compatibility.pivot.sizing;
        }

        if (compatibility.pivot.forms) {
            newCompatibility.forms = compatibility.pivot.forms;
        }

        // @ts-ignore
        manifest.compatibilities[compatibility.slug] = newCompatibility;
    });

    if (extension.publisher_name) {
        if (!manifest.publisher) manifest.publisher = {};
        manifest.publisher.name = extension.publisher_name;
    }

    if (extension.author_name) {
        if (!manifest.author) manifest.author = {};
        manifest.author.name = extension.author_name;
    }

    if (extension.author_email) {
        if (!manifest.author) manifest.author = {};
        manifest.author.email = extension.author_email;
    }

    if (extension.support_email) {
        if (!manifest.support) manifest.support = {};
        manifest.support.email = extension.support_email;
    }

    if (extension.support_url) {
        if (!manifest.support) manifest.support = {};
        manifest.support.url = extension.support_url;
    }

    if (extension.privacy_policy_url) {
        if (!manifest.legal) manifest.legal = {};
        manifest.legal.privacy = extension.privacy_policy_url;
    }

    if (extension.eula_tos_url) {
        if (!manifest.legal) manifest.legal = {};
        manifest.legal.terms = extension.eula_tos_url;
    }

    // write manifest file
    await Deno.writeTextFile(manifestFile, stringify(manifest));

    console.log(`Success! \`manifest.yaml\` has been created 🎉

You can now proceed with developing your OWN3D extension.
Next Steps:
- Edit \`manifest.yaml\` to double-check the configuration.
- Deploy with \`own3d ext:deploy\`.

Happy coding! 🚀`);
}

export async function extInit(args: Args): Promise<number> {
    // check if folder is already initialized
    const manifestFile: string = join(
        Deno.cwd(),
        args["manifest"] ?? "manifest.yaml",
    );

    // create manifest file by pulling data from own3d
    console.log(`🚀 Welcome to OWN3D Extension Setup!
-------------------------------------
This command will generate a \`manifest.yaml\` file for your extension.

Before we begin, make sure you have created an extension at:
➡️ https://console.dev.own3d.tv/console/extensions/create

You'll need:
✅ Extension ID (UUID)
✅ Version ID (UUID)

Let's get started! 🎉
`);
    let extensionId = args["id"];
    let extensionVersion = args["version"];

    try {
        extensionId = extensionId ?? prompt("Please enter your Extension ID (UUID):");
        extensionVersion = extensionVersion ?? prompt("Please enter your Version ID (UUID):");
    } catch (error) {
        console.error(bgRed(bold(" ERROR ")) + " " + red("Invalid extension id or version id"));
        return 1
    }

    console.log(cyan(`\n🔎 Summary:`));
    console.log(cyan('--------------------------'));
    console.log(magenta(`📦 Extension ID: ${extensionId}`));
    console.log(magenta(`📌 Version ID: ${extensionVersion}`));
    console.log(cyan(`\nGenerating manifest.yaml... 🛠️`))

    try {
        const { data: extension } = await axios.get(
            `https://console.dev.own3d.tv/api/v1/extensions/${extensionId}`,
        );
        const { data: version } = await axios.get(
            `https://console.dev.own3d.tv/api/v1/extensions/${extensionId}/versions/${extensionVersion}`,
        );

        await createManifestFile(manifestFile, extension, version);
    } catch (error) {
        console.error(bgRed(bold(" ERROR ")) + " " + red("Invalid extension id or version"));
        return 1
    }
    return 0;
}
