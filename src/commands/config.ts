import type { Args } from "https://deno.land/std@0.207.0/cli/parse_args.ts";
import { useStorage } from "../composables/useStorage.ts";
import { setLoggerQuiet, info, success, warn, error as logError, raw } from "../helpers/logger.ts";

const storage = useStorage();
const CONFIG_FILE = "cli.json";

export interface CliConfig {
  quiet: boolean;
  noColor: boolean;
}

const DEFAULT_CONFIG: CliConfig = {
  quiet: false,
  noColor: false,
};

export function loadCliConfig(): CliConfig {
  try {
    const raw = Deno.readTextFileSync(storagePath(CONFIG_FILE));
    const parsed = JSON.parse(raw);
    return normalizeConfig(parsed);
  } catch (_e) {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveCliConfig(cfg: Partial<CliConfig>): void {
  const merged = { ...loadCliConfig(), ...cfg };
  const basePath = getBasePath();
  try {
    Deno.mkdirSync(basePath, { recursive: true });
  } catch (_e) { /* ignore */ }
  Deno.writeTextFileSync(storagePath(CONFIG_FILE), JSON.stringify(merged, null, 2));
}

export async function configSet(args: Args): Promise<number> {
  const quiet = !!(args.quiet || args.q);
  setLoggerQuiet(quiet);
  const key = args._[0] as string | undefined;
  const valueRaw = args._[1] as string | undefined;
  if (!key) {
    logError("Usage: own3d config:set <key> <value>");
    warn("Keys: quiet (true|false), noColor (true|false)");
    return 1;
  }
  const normalizedKey = key as keyof CliConfig;
  if (!['quiet', 'noColor'].includes(normalizedKey)) {
    logError(`Unknown key: ${key}`);
    return 1;
  }
  let value: boolean;
  if (valueRaw === undefined) {
    // toggle if omitted
    const current = loadCliConfig();
    value = !current[normalizedKey];
  } else {
    if (!/^(true|false)$/i.test(valueRaw)) {
      logError("Value must be true or false");
      return 1;
    }
    value = /true/i.test(valueRaw);
  }
  saveCliConfig({ [normalizedKey]: value } as Partial<CliConfig>);
  const label = normalizedKey === 'noColor' ? '--no-color' : '--quiet';
  success(`Config updated: ${normalizedKey}=${value}`);
  if (normalizedKey === 'noColor') {
    info(`Hint: pass ${label} for one-off usage.`);
  }
  return 0;
}

export async function configShow(args: Args): Promise<number> {
  const quiet = !!(args.quiet || args.q);
  setLoggerQuiet(quiet);
  const cfg = loadCliConfig();
  info("CLI Preferences:");
  raw(` quiet   : ${cfg.quiet}`);
  raw(` noColor : ${cfg.noColor}`);
  return 0;
}

function normalizeConfig(obj: any): CliConfig { // deno-lint-ignore no-explicit-any
  return {
    quiet: typeof obj?.quiet === 'boolean' ? obj.quiet : false,
    noColor: typeof obj?.noColor === 'boolean' ? obj.noColor : false,
  };
}

function getBasePath(): string {
  if (Deno.build.os === 'windows') {
    return (Deno.env.get('LOCALAPPDATA') ?? '.') + '/own3d';
  }
  return (Deno.env.get('HOME') ?? '.') + '/.config/own3d';
}
function storagePath(name: string): string { return `${getBasePath()}/${name}`; }
