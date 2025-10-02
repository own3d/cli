import { useStorage } from "../composables/useStorage.ts";

const { get } = useStorage();

export async function getHeaders(): Promise<Record<string, string>> {
    const accessToken = Deno.env.get("ACCESS_TOKEN");
    const apiKey = Deno.env.get("OWN3D_API_KEY");

    if (accessToken) {
        return {
            Authorization: `Bearer ${accessToken}`,
        };
    }

    if (apiKey) {
        return {
            Authorization: `Bearer ${apiKey}`,
        };
    }

    const credentials = JSON.parse(await get("credentials.json")) as {
        access_token: string;
    };

    return {
        Authorization: `Bearer ${credentials.access_token}`,
    };
}
