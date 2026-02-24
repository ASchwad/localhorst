import type { PortEntry } from "./ports";

export interface ProcessInfo extends PortEntry {
  cwd: string;
  fullCommand: string;
  framework: string | null;
}

const FRAMEWORK_PATTERNS: [RegExp, string][] = [
  [/next[\s-]server|next[\s-]dev|\.next/, "Next.js"],
  [/vite/, "Vite"],
  [/nuxt/, "Nuxt"],
  [/remix[\s-]serve/, "Remix"],
  [/angular/, "Angular"],
  [/svelte[\s-]kit|svelte/, "SvelteKit"],
  [/astro/, "Astro"],
  [/webpack[\s-]dev[\s-]server|webpack/, "Webpack"],
  [/parcel/, "Parcel"],
  [/gatsby/, "Gatsby"],
  [/expo/, "Expo"],
  [/storybook/, "Storybook"],
  [/esbuild/, "esbuild"],
  [/turbopack|turbo/, "Turbopack"],
  [/node/, "Node"],
  [/bun/, "Bun"],
  [/deno/, "Deno"],
  [/python|flask|django|uvicorn|gunicorn/, "Python"],
  [/ruby|rails|puma/, "Rails"],
  [/php|artisan|laravel/, "Laravel"],
];

function detectFramework(fullCommand: string, shortCommand: string): string | null {
  const haystack = `${fullCommand} ${shortCommand}`.toLowerCase();
  for (const [pattern, name] of FRAMEWORK_PATTERNS) {
    if (pattern.test(haystack)) return name;
  }
  return null;
}

/**
 * Batch-lookup working directories for a set of PIDs.
 * Uses: lsof -a -d cwd -F pn -p PID1,PID2,...
 */
async function batchCwd(pids: number[]): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (pids.length === 0) return result;

  const proc = Bun.spawn(
    ["lsof", "-a", "-d", "cwd", "-F", "pn", "-p", pids.join(",")],
    { stdout: "pipe", stderr: "pipe" },
  );

  const stdout = await new Response(proc.stdout).text();
  await proc.exited;

  let currentPid = 0;
  for (const line of stdout.split("\n")) {
    if (!line) continue;
    if (line[0] === "p") {
      currentPid = parseInt(line.slice(1), 10);
    } else if (line[0] === "n") {
      result.set(currentPid, line.slice(1));
    }
  }

  return result;
}

/**
 * Batch-lookup full command lines for a set of PIDs.
 * Uses: ps -o pid=,args= -p PID1,PID2,...
 */
async function batchCommandLines(
  pids: number[],
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (pids.length === 0) return result;

  const proc = Bun.spawn(
    ["ps", "-o", "pid=,args=", "-p", pids.join(",")],
    { stdout: "pipe", stderr: "pipe" },
  );

  const stdout = await new Response(proc.stdout).text();
  await proc.exited;

  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const spaceIdx = trimmed.indexOf(" ");
    if (spaceIdx === -1) continue;
    const pid = parseInt(trimmed.slice(0, spaceIdx), 10);
    const args = trimmed.slice(spaceIdx + 1).trim();
    if (!isNaN(pid)) {
      result.set(pid, args);
    }
  }

  return result;
}

/**
 * Enrich port entries with cwd, full command line, and framework detection.
 */
export async function enrichProcesses(
  entries: PortEntry[],
): Promise<ProcessInfo[]> {
  const pids = [...new Set(entries.map((e) => e.pid))];

  // Run both lookups in parallel
  const [cwdMap, cmdMap] = await Promise.all([
    batchCwd(pids),
    batchCommandLines(pids),
  ]);

  return entries
    .map((entry) => {
      const cwd = cwdMap.get(entry.pid) ?? "";
      const fullCommand = cmdMap.get(entry.pid) ?? "";
      const framework = detectFramework(fullCommand, entry.command);
      return { ...entry, cwd, fullCommand, framework };
    })
    .filter((entry) => entry.framework !== null);
}
