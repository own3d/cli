interface ExtensionManifest {
    schema_version: number;
    id: string;
    name?: string;
    version: string;
    description?: string;
    summary?: string;
    compatibilities?: Partial<{
        config: {
            path: string;
        };
        "browser-source": {
            path: string;
            forms: {
                config_button: string;
                inputs: {
                    id: string;
                    type: string;
                    attributes: {
                        label: string;
                        value: string;
                        description: string;
                    };
                    validations: {
                        required: boolean;
                    };
                }[];
            };
        };
    }>;
    store_presence?: {
        category?: string;
        images?: {
            icon?: string;
            logo?: string;
            discovery?: string;
        };
        screenshots?: string[];
        keywords?: string[];
    };
    author?: {
        name?: string;
        email?: string;
    };
    publisher?: {
        name?: string;
    };
    support?: {
        url?: string;
        email?: string;
    };
    legal?: {
        terms?: string;
        privacy?: string;
    };
    oauth?: {
        scopes?: string[];
        redirect_uri?: string;
    };
    monetization?: {
        in_app_purchase?: {
            products?: {
                sku: string;
                name: string;
                description: string;
                price: number;
            }[];
        };
        subscriptions?: {
            sku: string;
            name: string;
            description: string;
            recurrence: string;
            price: number;
        }[];
    };
}

interface ExtensionCompatibility {
    id: number,
    slug: 'browser-source' | 'config',
    name: string,
    pivot: {
        version_id: string,
        compatibility_id: number,
        path: string,
        resize_by_default: boolean,
        sizing: Partial<{
            width: number,
            height: number,
            x: number,
            y: number
        }>,
        forms: null,
        yaml_forms: string,
        version: {
            id: string,
            extension_id: string,
            version: string,
            requires_subscription: false,
            file: string | null,
            status: string
            base_url: string,
            upsell_information: string,
        }
    }
}