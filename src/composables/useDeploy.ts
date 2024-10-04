import type { Args } from "https://deno.land/std@0.207.0/cli/parse_args.ts";
import { compress } from "https://deno.land/x/brotli/mod.ts";
import { getHeaders } from "../helpers/getHeaders.ts";
import axios, { type AxiosResponse } from "npm:axios";
import * as esbuild from "npm:esbuild@0.20.2";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.10.3";

interface Manifest {
    name: string;
    version: string;
    entrypoint: string;
    description?: string;
    runtime?: string;
    memory?: number;
    timeout?: number;
    environment?: Record<string, string>;
}

interface DeployResponse {
    id: number;
    revision: string;
    function_id: number;
    production: boolean;
    domains: string[];
}

export function useDeploy(_args: Args) {
    const deployFunction = async (
        manifest: Manifest,
        compressed: Uint8Array,
    ): Promise<AxiosResponse<DeployResponse>> => {
        const data = new FormData();
        data.append("format", "esm-br");
        data.append(
            "manifest",
            new Blob([JSON.stringify(manifest)], {
                type: "application/json",
            }),
            "manifest.json",
        );
        data.append(
            "file",
            new Blob([compressed], {
                type: "application/javascript",
            }),
            `${manifest.name}.esm.js.br`,
        );

        return axios.post(
            `http://localhost:8000/api/v1/edge-functions/deploy`,
            data,
            {
                headers: await getHeaders(),
            },
        );
    };

    const bundleFunction = async (
        manifest: Manifest,
    ): Promise<Uint8Array> => {
        const outfile = `./${manifest.name}.esm.js`;
        const result = await esbuild.build({
            plugins: [...denoPlugins()],
            entryPoints: [manifest.entrypoint],
            outfile,
            bundle: true,
            format: "esm",
        });
        if (result.errors.length > 0) {
            throw new Error(`Unable to bundle ${manifest.name} function.`);
        }
        esbuild.stop();
        const contents = await Deno.readFile(outfile);
        await Deno.remove(outfile);
        return compress(contents);
    };

    return {
        bundleFunction,
        deployFunction,
    };
}
