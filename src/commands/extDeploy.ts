import type { Args } from "https://deno.land/std@0.207.0/cli/parse_args.ts";
import { getHeaders } from "../helpers/getHeaders.ts";
import { join } from "../helpers/deps.ts";
import axios from "npm:axios";
import { parse, stringify } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import { exists } from "https://deno.land/std@0.220.1/fs/exists.ts";
import { HumanSize } from "../utils.ts";
import { getFilteredFiles } from "../helpers/compress.ts";
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";
import { bold, green, red, yellow, cyan, magenta, bgRed, bgGreen, bgYellow, underline } from "../helpers/colors.ts";

export async function extDeploy(args: Args): Promise<number> {
  const archiveName: string = join(Deno.cwd(), "extension.zip");
  const manifestOnly: boolean = args["manifest-only"] ?? false;
  // check if extension contains a valid manifest
  const manifestFile: string = join(
    Deno.cwd(),
    args["manifest"] ?? "manifest.yaml",
  );
  if (!Deno.statSync(manifestFile).isFile) {
    console.error(bgRed(bold(" ERROR ")) + " " + red("Invalid extension, missing manifest"));
    return 1;
  }

  const manifest: ExtensionManifest = parse(
    Deno.readTextFileSync(manifestFile),
  ) as ExtensionManifest;

  if (!manifest) {
    console.error(bgRed(bold(" ERROR ")) + " " + red("Invalid extension, invalid manifest"));
    return 1;
  }

  if (!manifest.name || !manifest.version) {
    console.error(bgRed(bold(" ERROR ")) + " " + red("Invalid manifest, missing required fields"));
    return 1;
  }

  if (!manifestOnly) {
    console.log(cyan("➜ Compressing extension..."));

    const distFolder: string = join(Deno.cwd(), args["dist"] ?? "dist");
    if (!Deno.statSync(distFolder).isDirectory) {
      console.error(bgRed(bold(" ERROR ")) + " " + red("Invalid extension, missing dist folder"));
      return 1;
    }

    // Get filtered files (excluding those matching .gitignore patterns)
    const filesToCompress = await getFilteredFiles(distFolder, [
      "archive\\.zip",
      "\\.own3d",
    ]);

    const zip = new JSZip();

    for (const file of filesToCompress) {
      zip.addFile(file, await Deno.readFile(join(distFolder, file)));
    }

    await zip.writeZip(archiveName);

    console.log(green("✔ Extension compressed"));
  }

  if (manifestOnly) {
    console.log(magenta("ℹ️  Deploying extension (manifest only)..."));
  } else {
    const extensionSize = HumanSize(Deno.statSync(archiveName).size);
    console.log(magenta(`ℹ️  Deploying extension (script size: ${extensionSize})...`));
  }
  try {
    const { data } = await deployExtension(manifest, archiveName, args);

    console.log(bgGreen(bold(" SUCCESS ")) + " " + green("Extension is updated!"));

    console.log(bold("\nVisit your extension at:"));
    console.log(
      cyan(underline(`https://console.dev.own3d.tv/console/extension-versions/${data.version.id}/edit`)),
    );
    // deno-lint-ignore no-explicit-any
  } catch (e: any) {
    // x emoji
    console.error(bgRed(bold(" FAIL ")) + " " + red("Failed to deploy extension"));
    if (e.response?.status === 422) {
      // Laravel validation exception (HTTP 422)
      const errors = e.response?.data?.errors;
      if (errors && typeof errors === 'object') {
        console.error(yellow(bold("\nValidation errors:")));
        for (const [field, messages] of Object.entries(errors)) {
          if (Array.isArray(messages)) {
            messages.forEach(msg => console.error(yellow(`  • [${field}] `) + red(msg)));
          } else {
            console.error(yellow(`  • [${field}] `) + red(messages));
          }
        }
      } else {
        console.error(red("Validation failed, but no error details provided."));
      }
    } else if (e.response?.data?.message) {
      console.error(red(e.response?.data.message));
    } else {
      console.error(red(e.message));
    }
    return 1;
  } finally {
    if (await exists(archiveName)) {
      await Deno.remove(archiveName);
    }
  }

  console.log(green(bold("\nAll done! 🚀")));
  return 0;
}

function appendFiles(manifest: ExtensionManifest, data: FormData) {
  appendFile(manifest.store_presence?.images?.logo, data);
  appendFile(manifest.store_presence?.images?.icon, data);
  appendFile(manifest.store_presence?.images?.discovery, data);
  manifest.store_presence?.screenshots?.forEach((screenshot) => {
    appendFile(screenshot, data);
  });
}

function appendFile(path: string | undefined, data: FormData) {
  if (!path) return;
  const file = Deno.readFileSync(path);
  data.append(
    `assets[${encodeURI(path)}]`,
    new Blob([file], {
      type: "application/octet-stream",
    }),
    path.split("/").pop(),
  );
}

async function deployExtension(
  manifest: ExtensionManifest,
  archiveName: string,
  args: Args,
) {
  const data = new FormData();
  const manifestOnly: boolean = args["manifest-only"] ?? false;
  if (!manifestOnly) {
    const compressed = Deno.readFileSync(archiveName);
    data.append(
      "file",
      new Blob([compressed], {
        type: "application/zip",
      }),
      "archive.zip",
    );
  }
  data.append(
    "manifest",
    new Blob([stringify(manifest)], {
      type: "application/yaml",
    }),
    "manifest.yaml",
  );

  // Add forms.yaml if it exists
  const formsFile = join(Deno.cwd(), args["forms"] ?? "forms.yaml");
  if (await exists(formsFile)) {
    const formsContent = Deno.readFileSync(formsFile);
    data.append(
      "forms",
      new Blob([formsContent], {
        type: "application/yaml",
      }),
      "forms.yaml",
    );
  }

  if (args["assets"]) {
    // append all files to the form data
    appendFiles(manifest, data);
  }

  if (args["stage"]) {
    data.append("stage", args["stage"]);
  } else {
    data.append("stage", "local-test");
  }

  return axios.post(`https://ext.own3d.pro/v1/extensions/deploy`, data, {
    headers: {
      ...await getHeaders(),
      "Accept": "application/json",
    },
  });
}
