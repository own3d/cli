import type { Args } from "https://deno.land/std@0.207.0/cli/parse_args.ts";
import axios from "npm:axios";
import { getHeaders } from "../helpers/getHeaders.ts";
import { bold, cyan, green, magenta, red, yellow, bgRed, bgGreen } from "../helpers/colors.ts";
import { useStorage } from "../composables/useStorage.ts";

const BASE_URL = "https://ext.own3d.pro/v1";
const storage = useStorage();
const DEFAULT_CODESPACE_FILE = 'codespace.json';

async function setDefaultCodespaceId(id: string) {
  try {
    await storage.putJson(DEFAULT_CODESPACE_FILE, { current: id, updated_at: new Date().toISOString() });
  } catch (_e) { /* ignore */ }
}

async function getDefaultCodespaceId(): Promise<string | undefined> {
  try {
    const raw = await storage.get(DEFAULT_CODESPACE_FILE);
    const json = JSON.parse(raw);
    if (json?.current && typeof json.current === 'string') return json.current;
  } catch (_e) { /* ignore */ }
  return undefined;
}

function logErrorPrefix() {
  return bgRed(bold(" FAIL ")) + " ";
}
function logSuccessPrefix() {
  return bgGreen(bold(" SUCCESS ")) + " ";
}

function printAxiosError(e: any) { // deno-lint-ignore no-explicit-any
  if (e.response?.status === 422) {
    console.error(logErrorPrefix() + red("Validation failed (422)"));
    const errors = e.response?.data?.errors;
    if (errors && typeof errors === "object") {
      for (const [field, messages] of Object.entries(errors)) {
        if (Array.isArray(messages)) {
          messages.forEach((m) =>
            console.error(yellow(`  • [${field}] `) + red(m))
          );
        } else {
          console.error(yellow(`  • [${field}] `) + red(String(messages)));
        }
      }
    }
  } else if (e.response?.data?.message) {
    console.error(logErrorPrefix() + red(e.response.data.message));
  } else {
    console.error(logErrorPrefix() + red(e.message));
  }
}

function requireArg(args: Args, key: string, message?: string): string | never {
  const val = args[key];
  if (val === undefined || val === null) {
    console.error(
      logErrorPrefix() + red(message ?? `Missing required --${key}`),
    );
    Deno.exit(1);
  }
  if (typeof val === 'string') {
    if (val.trim().length === 0) {
      console.error(
        logErrorPrefix() + red(message ?? `Missing required --${key}`),
      );
      Deno.exit(1);
    }
    return val;
  }
  // allow number / boolean coercion (primarily numbers like --user-id 1)
  if (typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  console.error(logErrorPrefix() + red(message ?? `Invalid value for --${key}`));
  Deno.exit(1);
}

// New command: cs:use <id>
export async function csUse(args: Args): Promise<number> {
  const id = args._[0] as string || (args.id as string);
  if (!id) {
    console.error(logErrorPrefix() + red("Missing <codespace_id> argument. Usage: own3d cs:use <id>"));
    return 1;
  }
  await setDefaultCodespaceId(id);
  console.log(logSuccessPrefix() + green(`Default codespace set to ${id}`));
  return 0;
}

// Async wrapper for commands needing id (refactor usages below)
async function resolveId(args: Args): Promise<string> {
  const flagId = typeof args.id === 'string' ? args.id : undefined;
  const quiet = !!(args.quiet || args.q);
  if (flagId) return flagId;
  const envId = Deno.env.get('OWN3D_CODESPACE_ID');
  if (envId) {
    if (!quiet) console.log(cyan(`Using codespace from ENV OWN3D_CODESPACE_ID=${envId}`));
    return envId;
  }
  const stored = await getDefaultCodespaceId();
  if (stored) {
    if (!quiet) console.log(cyan(`Using default codespace: ${stored} (override with --id or env OWN3D_CODESPACE_ID)`));
    return stored;
  }
  console.error(logErrorPrefix() + red("No codespace id set. Provide --id, set OWN3D_CODESPACE_ID, or run 'own3d cs:use <id>'."));
  Deno.exit(1);
}

export async function csCreate(args: Args): Promise<number> {
    console.error(logErrorPrefix() + red("Not implemented yet"));
}

// cs:tree <id>
export async function csTree(args: Args): Promise<number> {
  const id = await resolveId(args);
  const wantJson = !!args.json;
  const showIds = !!args.ids;
  const noColor = !!args["no-color"];
  console.log(cyan("➜ Fetching file tree..."));
  try {
    const { data } = await axios.get(`${BASE_URL}/codespaces/${id}/fs/tree`, {
      headers: await getHeaders(),
    });
    if (wantJson) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(green("✔ Tree:"));
      let treeData = data;
      if (
        treeData && typeof treeData === "object" && !Array.isArray(treeData) &&
        !("entries" in treeData) && !("name" in treeData)
      ) {
        const values = Object.values(treeData);
        if (
          values.every((v: any) =>
            v && typeof v === "object" && (("directory" in v) || ("file" in v))
          )
        ) { // deno-lint-ignore no-explicit-any
          treeData = buildTreeFromMap(treeData);
        }
      }
      const output = renderFancyTree(treeData, { showIds, color: !noColor });
      console.log(output);
    }
    return 0;
  } catch (e) {
    printAxiosError(e);
    return 1;
  }
}

// cs:ls [path]
export async function csLs(args: Args): Promise<number> {
  // derive path from --path or first positional (if provided)
  const pathArg = typeof args.path === 'string' ? args.path : (typeof args._[0] === 'string' ? args._[0] as string : '/');
  const id = await resolveId(args);
  const wantJson = !!args.json;
  const longOutput = !!(args.long || args.l);
  console.log(cyan(`➜ Listing directory: ${pathArg}`));
  try {
    const { data } = await axios.get(`${BASE_URL}/codespaces/${id}/fs/ls`, {
      params: { path: pathArg },
      headers: await getHeaders(),
    });

    if (wantJson) {
      console.log(JSON.stringify(data, null, 2));
      return 0;
    }

    if (!data || data.type !== 'directory' || !Array.isArray(data.entries)) {
      console.error(logErrorPrefix() + red('Unexpected API response shape (expected { path, type: "directory", entries: [] })'));
      return 1;
    }

    let entries: any[] = data.entries; // deno-lint-ignore no-explicit-any
    entries = sortEntries(entries);

    console.log(green("✔ Contents:"));

    if (!entries.length) {
      console.log(yellow("(empty)"));
      return 0;
    }

    if (longOutput) {
      const nameWidth = Math.min(60, Math.max(...entries.map(e => (e.name || '').length), 4));
      console.log(cyan(pad('TYPE', 12) + pad('NAME', nameWidth + 2) + 'ID'));
      for (const entry of entries) {
        const rawType = entry.type || (entry.is_dir ? 'dir' : 'file');
        const type = (rawType === 'directory') ? 'dir' : rawType;
        const icon = (type === 'dir') ? '📁' : '📄';
        console.log(
          pad(type, 12) + pad(`${icon} ${entry.name}`, nameWidth + 2) + (entry.id ?? '-')
        );
      }
    } else {
      for (const entry of entries) {
        const rawType = entry.type || (entry.is_dir ? 'dir' : 'file');
        const type = (rawType === 'directory') ? 'dir' : rawType;
        const icon = (type === 'dir') ? '📁' : '📄';
        console.log(`${icon} ${entry.name}`);
      }
    }

    return 0;
  } catch (e) {
    printAxiosError(e);
    return 1;
  }
}

// Normalize map-shaped API tree { name: { id, directory: { ... } | file: [] }, ... }
function buildTreeFromMap(obj: any, name = "/"): any { // deno-lint-ignore no-explicit-any
  const entries: any[] = []; // deno-lint-ignore no-explicit-any
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    const val = obj[key];
    if (!val || typeof val !== "object") continue;
    if (val.directory && typeof val.directory === "object") {
      entries.push({
        name: key,
        id: val.id,
        type: "directory",
        entries: buildTreeFromMap(val.directory, key).entries,
      });
    } else if ("file" in val) {
      entries.push({
        name: key,
        id: val.id,
        type: "file",
      });
    } else {
      // Fallback: unknown shape treat as file
      entries.push({ name: key, id: val.id, type: "file" });
    }
  }
  return { name, type: "directory", entries };
}

// Fancy tree rendering utilities
interface TreeRenderOptions {
  showIds: boolean;
  color: boolean;
}

function colorize(name: string, type: string, color: boolean): string {
  if (!color) return name;
  if (type === "directory" || type === "dir") return cyan(bold(name));
  if (name.endsWith(".ts") || name.endsWith(".tsx") || name.endsWith(".vue")) {
    return green(name);
  }
  if (name.endsWith(".json")) return yellow(name);
  if (name === "README.md") return magenta(name);
  return name;
}

function renderFancyTree(root: any, opts: TreeRenderOptions): string { // deno-lint-ignore no-explicit-any
  const lines: string[] = [];
  function walk(node: any, prefix: string, isLast: boolean, depth: number) { // deno-lint-ignore no-explicit-any
    const isDir = node.type === "directory" || node.type === "dir";
    const icon = isDir ? "📁" : "📄";
    const displayName = colorize(node.name ?? "/", node.type, opts.color);
    const idSuffix = opts.showIds && node.id
      ? cyan(dim(` (id:${node.id})`))
      : "";
    if (depth === 0) {
      lines.push(`${icon} ${displayName}${idSuffix}`);
    } else {
      const branch = isLast ? "└─ " : "├─ ";
      lines.push(`${prefix}${branch}${icon} ${displayName}${idSuffix}`);
    }
    const children = (node.entries && Array.isArray(node.entries))
      ? sortEntries(node.entries)
      : [];
    children.forEach((child: any, idx: number) => { // deno-lint-ignore no-explicit-any
      const nextPrefix = depth === 0 ? "" : prefix + (isLast ? "   " : "│  ");
      walk(child, nextPrefix, idx === children.length - 1, depth + 1);
    });
  }
  walk(root, "", true, 0);
  return lines.join("\n");
}

// helper dim color (std colors has dim under v0.224?) fallback
function dim(str: string): string {
  return `\x1b[2m${str}\x1b[22m`;
}

// cs:read [path]
export async function csRead(args: Args): Promise<number> {
  const path = typeof args.path === 'string' ? args.path : (typeof args._[0] === 'string' ? args._[0] as string : undefined);
  if (!path) {
    console.error(logErrorPrefix() + red('Missing file path. Usage: own3d cs:read <path> [--id=<codespace>]'));
    return 1;
  }
  const id = await resolveId(args);
  try {
    const { data } = await axios.get(`${BASE_URL}/codespaces/${id}/fs/file`, {
      params: { path },
      headers: await getHeaders(),
    });
    console.log(data);
    return 0;
  } catch (e) {
    printAxiosError(e);
    return 1;
  }
}

// cs:write [path] --file=local
export async function csWrite(args: Args): Promise<number> {
  const path = typeof args.path === 'string' ? args.path : (typeof args._[0] === 'string' ? args._[0] as string : undefined);
  if (!path) {
    console.error(logErrorPrefix() + red('Missing destination path. Usage: own3d cs:write <path> --file=localFile [--id=<codespace>]'));
    return 1;
  }
  const filePath = requireArg(args, 'file', 'Missing required --file local file path');
  const id = await resolveId(args);
  console.log(cyan(`➜ Uploading file to: ${path}`));
  try {
    const content = await Deno.readFile(filePath);
    const form = new FormData();
    form.append('path', path);
    form.append('file', new Blob([content]), filePath.split(/[/\\]/).pop());
    await axios.post(`${BASE_URL}/codespaces/${id}/fs/file`, form, { headers: await getHeaders() });
    console.log(logSuccessPrefix() + green('File written'));
    return 0;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      console.error(logErrorPrefix() + red(`Local file not found: ${filePath}`));
      return 1;
    }
    printAxiosError(e);
    return 1;
  }
}

// cs:rm [path]
export async function csRm(args: Args): Promise<number> {
  const path = typeof args.path === 'string' ? args.path : (typeof args._[0] === 'string' ? args._[0] as string : undefined);
  if (!path) {
    console.error(logErrorPrefix() + red('Missing file path. Usage: own3d cs:rm <path> [--id=<codespace>]'));
    return 1;
  }
  const id = await resolveId(args);
  console.log(cyan(`➜ Deleting: ${path}`));
  try {
    await axios.delete(`${BASE_URL}/codespaces/${id}/fs/rm`, {
      headers: await getHeaders(),
      params: { path },
    });
    console.log(logSuccessPrefix() + green('Deleted'));
    return 0;
  } catch (e) {
    printAxiosError(e);
    return 1;
  }
}

// cs:reset <id>
export async function csReset(args: Args): Promise<number> {
  const id = await resolveId(args);
  console.log(yellow('⚠️  Resetting filesystem to repository state (all changes lost)...'));
  try {
    await axios.post(`${BASE_URL}/codespaces/${id}/fs/reset`, undefined, { headers: await getHeaders() });
    console.log(logSuccessPrefix() + green('Filesystem reset'));
    return 0;
  } catch (e) {
    printAxiosError(e);
    return 1;
  }
}

// cs:sync <id>
export async function csSync(args: Args): Promise<number> {
  const id = await resolveId(args);
  console.log(cyan('➜ Syncing filesystem to CDN...'));
  try {
    await axios.post(`${BASE_URL}/codespaces/${id}/fs/sync`, undefined, { headers: await getHeaders() });
    console.log(logSuccessPrefix() + green('Synced to CDN'));
    return 0;
  } catch (e) {
    printAxiosError(e);
    return 1;
  }
}

// Utility to sort entries: dirs first then files, alphabetical (ensure present if truncated earlier)
function sortEntries(entries: any[]): any[] { // deno-lint-ignore no-explicit-any
  return entries.sort((a, b) => {
    const at = (a.type === 'directory' || a.type === 'dir') ? 0 : 1;
    const bt = (b.type === 'directory' || b.type === 'dir') ? 0 : 1;
    if (at !== bt) return at - bt;
    return (a.name || '').localeCompare(b.name || '');
  });
}
function pad(str: string, len: number): string { return str + ' '.repeat(Math.max(0, len - str.length)); }

// cs:info
export async function csInfo(_args: Args): Promise<number> {
  const flagId = typeof _args.id === 'string' ? _args.id : undefined;
  const envId = Deno.env.get('OWN3D_CODESPACE_ID') || undefined;
  const stored = await getDefaultCodespaceId();

  let resolved: string | undefined;
  let source: string | undefined;
  if (flagId) { resolved = flagId; source = '--id flag'; }
  else if (envId) { resolved = envId; source = 'environment (OWN3D_CODESPACE_ID)'; }
  else if (stored) { resolved = stored; source = 'stored default (cs:use)'; }

  if (_args.json) {
    console.log(JSON.stringify({ id: resolved ?? null, source: source ?? null }, null, 2));
    return resolved ? 0 : 1;
  }

  if (resolved) {
    console.log(logSuccessPrefix() + green(`Active codespace: ${resolved}`));
    console.log(cyan(`Source: ${source}`));
    console.log(yellow(`Override order: --id > ENV OWN3D_CODESPACE_ID > stored default`));
    return 0;
  } else {
    console.error(logErrorPrefix() + red('No active codespace resolved.'));
    console.log(cyan('Set one with: own3d cs:use <id>  OR  pass --id=<id>  OR  export OWN3D_CODESPACE_ID=<id>'));
    return 1;
  }
}
