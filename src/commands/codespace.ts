import type { Args } from "https://deno.land/std@0.207.0/cli/parse_args.ts";
import axios from "npm:axios";
import { getHeaders } from "../helpers/getHeaders.ts";
import {
  bgGreen,
  bgRed,
  bold,
  cyan,
  green,
  magenta,
  red,
  yellow,
} from "https://deno.land/std@0.224.0/fmt/colors.ts";

const BASE_URL = "https://ext.own3d.pro/v1";

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
  if (typeof val !== "string" || !val.length) {
    console.error(
      logErrorPrefix() + red(message ?? `Missing required --${key}`),
    );
    Deno.exit(1);
  }
  return val;
}

// cs:create --name --repo --user-id --password
export async function csCreate(args: Args): Promise<number> {
  const name = requireArg(args, "name");
  const repository_url = args.repo || args.repository || args["repository-url"];
  if (!repository_url || typeof repository_url !== "string") {
    console.error(
      logErrorPrefix() + red("Missing required --repo (repository url)"),
    );
    return 1;
  }
  const user_id = requireArg(args, "user-id", "Missing required --user-id");
  const password = requireArg(args, "password");

  console.log(cyan("➜ Creating codespace..."));
  try {
    const { data } = await axios.post(`${BASE_URL}/codespaces`, {
      name,
      repository_url,
      user_id,
      password,
    }, { headers: await getHeaders() });

    console.log(logSuccessPrefix() + green("Codespace created"));
    console.log(magenta(`ID: ${data.id}`));
    return 0;
  } catch (e) {
    printAxiosError(e);
    return 1;
  }
}

function ensureId(args: Args): string {
  const id = args._[0];
  if (typeof id !== "string" || !id.length) {
    console.error(logErrorPrefix() + red("Missing <codespace_id> argument"));
    Deno.exit(1);
  }
  return id;
}

// cs:tree <id>
export async function csTree(args: Args): Promise<number> {
  const id = ensureId(args);
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

// cs:ls <id> --path
export async function csLs(args: Args): Promise<number> {
  const id = ensureId(args);
  const path = args.path || "/";
  const wantJson = !!args.json;
  const longOutput = !!(args.long || args.l);
  console.log(cyan(`➜ Listing directory: ${path}`));
  try {
    const { data } = await axios.get(`${BASE_URL}/codespaces/${id}/fs/ls`, {
      params: { path },
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

// cs:read <id> --path
export async function csRead(args: Args): Promise<number> {
  const id = ensureId(args);
  const path = requireArg(args, "path");
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

// cs:write <id> --path --file
export async function csWrite(args: Args): Promise<number> {
  const id = ensureId(args);
  const path = requireArg(args, "path");
  const filePath = requireArg(
    args,
    "file",
    "Missing required --file local file path",
  );

  console.log(cyan(`➜ Uploading file to: ${path}`));
  try {
    const content = await Deno.readFile(filePath);
    const form = new FormData();
    form.append("path", path);
    form.append("file", new Blob([content]), filePath.split(/[/\\]/).pop());

    await axios.post(`${BASE_URL}/codespaces/${id}/fs/file`, form, {
      headers: await getHeaders(),
    });
    console.log(logSuccessPrefix() + green("File written"));
    return 0;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      console.error(
        logErrorPrefix() + red(`Local file not found: ${filePath}`),
      );
      return 1;
    }
    printAxiosError(e);
    return 1;
  }
}

// cs:rm <id> --path
export async function csRm(args: Args): Promise<number> {
  const id = ensureId(args);
  const path = requireArg(args, "path");
  console.log(cyan(`➜ Deleting: ${path}`));
  try {
    await axios.delete(`${BASE_URL}/codespaces/${id}/fs/rm`, {
      headers: await getHeaders(),
      params: { path },
    });
    console.log(logSuccessPrefix() + green("Deleted"));
    return 0;
  } catch (e) {
    printAxiosError(e);
    return 1;
  }
}

// cs:reset <id>
export async function csReset(args: Args): Promise<number> {
  const id = ensureId(args);
  console.log(
    yellow(
      "⚠️  Resetting filesystem to repository state (all changes lost)...",
    ),
  );
  try {
    await axios.post(`${BASE_URL}/codespaces/${id}/fs/reset`, undefined, {
      headers: await getHeaders(),
    });
    console.log(logSuccessPrefix() + green("Filesystem reset"));
    return 0;
  } catch (e) {
    printAxiosError(e);
    return 1;
  }
}

// cs:sync <id>
export async function csSync(args: Args): Promise<number> {
  const id = ensureId(args);
  console.log(cyan("➜ Syncing filesystem to CDN..."));
  try {
    await axios.post(`${BASE_URL}/codespaces/${id}/fs/sync`, undefined, {
      headers: await getHeaders(),
    });
    console.log(logSuccessPrefix() + green("Synced to CDN"));
    return 0;
  } catch (e) {
    printAxiosError(e);
    return 1;
  }
}

// Utility to sort entries: dirs first then files, alphabetical
function sortEntries(entries: any[]): any[] { // deno-lint-ignore no-explicit-any
  return entries.sort((a, b) => {
    const at = (a.type === "directory" || a.type === "dir") ? 0 : 1;
    const bt = (b.type === "directory" || b.type === "dir") ? 0 : 1;
    if (at !== bt) return at - bt;
    return (a.name || "").localeCompare(b.name || "");
  });
}

function pad(str: string, len: number): string {
  return str + " ".repeat(Math.max(0, len - str.length));
}
