export function getHeaders() {

    const accessToken = Deno.env.get('ACCESS_TOKEN')

    if (accessToken) {
        return {
            Authorization: `Bearer ${accessToken}`,
        }
    }

    const credentials = JSON.parse(Deno.readTextFileSync('credentials.json'))
    return {
        Authorization: `Bearer ${credentials.access_token}`,
    }
}