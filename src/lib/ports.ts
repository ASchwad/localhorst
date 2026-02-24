export interface PortEntry {
  port: number;
  pid: number;
  command: string;
}

/**
 * Parse lsof machine-readable output (-F pcn) into PortEntries.
 *
 * lsof -F outputs fields prefixed by a single letter:
 *   p<pid>   — process ID
 *   c<cmd>   — command name
 *   n<name>  — network name (e.g. *:3000 or [::1]:3000)
 */
function parseLsofOutput(raw: string): PortEntry[] {
  const entries: PortEntry[] = [];
  let currentPid = 0;
  let currentCommand = "";

  for (const line of raw.split("\n")) {
    if (!line) continue;

    const tag = line[0];
    const value = line.slice(1);

    switch (tag) {
      case "p":
        currentPid = parseInt(value, 10);
        break;
      case "c":
        currentCommand = value;
        break;
      case "n": {
        // Extract port from name like "*:3000" or "[::1]:5173"
        const colonIdx = value.lastIndexOf(":");
        if (colonIdx === -1) break;
        const port = parseInt(value.slice(colonIdx + 1), 10);
        if (isNaN(port)) break;
        entries.push({ port, pid: currentPid, command: currentCommand });
        break;
      }
    }
  }

  return entries;
}

/**
 * Discover all TCP listening ports in the given range.
 * Returns deduplicated entries by (pid, port) tuple.
 */
export async function discoverPorts(
  minPort = 3000,
  maxPort = 9000,
): Promise<PortEntry[]> {
  const proc = Bun.spawn(
    ["lsof", "-iTCP", "-sTCP:LISTEN", "-P", "-n", "-F", "pcn"],
    { stdout: "pipe", stderr: "pipe" },
  );

  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0 && !stdout) {
    // lsof returns 1 when no matching files found — that's fine
    return [];
  }

  const all = parseLsofOutput(stdout);

  // Filter to desired port range
  const filtered = all.filter((e) => e.port >= minPort && e.port <= maxPort);

  // Deduplicate by (pid, port) — IPv4/IPv6 can produce duplicates
  const seen = new Set<string>();
  const unique: PortEntry[] = [];
  for (const entry of filtered) {
    const key = `${entry.pid}:${entry.port}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(entry);
    }
  }

  // Sort by port
  unique.sort((a, b) => a.port - b.port);

  return unique;
}
