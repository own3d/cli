export function useStorage() {
    const getBasePath = () => {
        if (Deno.build.os === 'windows') {
            return Deno.env.get('LOCALAPPDATA') + '/own3d'
        }
        return Deno.env.get('HOME') + '/.config/own3d'
    }

    const path = (key: string) => {
        return getBasePath() + '/' + key
    }

    const put = async (key: string, value: string) => {
        await Deno.mkdir(getBasePath(), {recursive: true});
        await Deno.writeTextFile(path(key), value);
    }

    const putJson = async (key: string, value: string | object | number) => {
        await put(key, JSON.stringify(value, null, 2));
    }

    const get = async (key: string) => {
        return await Deno.readTextFile(path(key));
    }

    return {
        put,
        putJson,
        get
    }
}