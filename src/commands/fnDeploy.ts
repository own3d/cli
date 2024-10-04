import type { Args } from "https://deno.land/std@0.207.0/cli/parse_args.ts";
import { join } from "../helpers/deps.ts";
import { HumanSize } from "../utils.ts";
import { useDeploy } from "../composables/useDeploy.ts";

export async function fnDeploy(args: Args): Promise<number> {
    const { bundleFunction, deployFunction } = useDeploy(args);

    // check if function contains a valid manifest
    const manifestFile = join(
        Deno.cwd(),
        ".own3d",
        "manifest.json",
    );
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

    // 2. Bundle Function
    console.log(`- Bundling ${manifest.name} function (v2)...`);
    const compressed = await bundleFunction(manifest);
    console.log("✔ Function bundled");

    // 3. Deploy Function
    const functionSize = HumanSize(compressed.length);
    console.log(
        `- Deploying ${manifest.name} function (script size: ${functionSize})...`,
    );

    try {
        const { data } = await deployFunction(manifest, compressed);

        console.log("✔ Deployment is live!", data);

        data.domains.forEach((domain: string) => {
            console.log(`Website URL: ${domain}`);
        });
    } catch (e) {
        // x emoji
        console.error("✘ Failed to deploy function");
        if (e.response?.data?.message) {
            console.error(e.response?.data.message);
        } else {
            console.error(e.message);
        }

        return 1;
    }

    return 0;
}
