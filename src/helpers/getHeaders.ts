import { useStorage } from "../composables/useStorage.ts";

const {get } = useStorage()

export async function getHeaders() {

    const accessToken = Deno.env.get('ACCESS_TOKEN')

    if (accessToken) {
        return {
            Authorization: `Bearer ${accessToken}`,
        }
    }

    const credentials = JSON.parse(await get('credentials.json'))

    return {
        Authorization: `Bearer ${credentials.access_token}`,
    }
}