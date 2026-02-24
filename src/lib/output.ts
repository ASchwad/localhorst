import type { ProcessInfo } from "./process-info";

// ANSI escape codes
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const GRAY = "\x1b[90m";

// Exported ANSI codes for interactive mode
export const ANSI = {
  RESET,
  BOLD,
  DIM,
  CYAN,
  GREEN,
  YELLOW,
  RED,
  GRAY,
  INVERSE: "\x1b[7m",
  CLEAR_SCREEN: "\x1b[2J\x1b[H",
  HIDE_CURSOR: "\x1b[?25l",
  SHOW_CURSOR: "\x1b[?25h",
};

/** Shorten a path by replacing $HOME with ~ */
function shortenPath(path: string): string {
  const home = process.env.HOME;
  if (home && path.startsWith(home)) {
    return "~" + path.slice(home.length);
  }
  return path;
}

/** Pad a string to a given width */
function pad(str: string, width: number): string {
  return str + " ".repeat(Math.max(0, width - str.length));
}

/**
 * Render a table of discovered processes to stdout.
 */
export function renderTable(processes: ProcessInfo[]): void {
  if (processes.length === 0) {
    console.log(
      `\n${DIM}  No dev servers found on ports 3000–9000.${RESET}\n`,
    );
    return;
  }

  // Compute column widths
  const portWidth = Math.max(4, ...processes.map((p) => String(p.port).length));
  const pidWidth = Math.max(3, ...processes.map((p) => String(p.pid).length));
  const fwWidth = Math.max(
    7,
    ...processes.map((p) => (p.framework ?? "").length),
  );
  const dirWidth = Math.max(
    9,
    ...processes.map((p) => shortenPath(p.cwd).length),
  );

  // Header
  const header = `  ${BOLD}${pad("PORT", portWidth)}  ${pad("PID", pidWidth)}  ${pad("PROCESS", fwWidth)}  ${"DIRECTORY"}${RESET}`;
  const divider = `  ${DIM}${pad("─".repeat(portWidth), portWidth)}  ${pad("─".repeat(pidWidth), pidWidth)}  ${pad("─".repeat(fwWidth), fwWidth)}  ${"─".repeat(Math.min(dirWidth, 40))}${RESET}`;

  console.log("");
  console.log(header);
  console.log(divider);

  for (const proc of processes) {
    const port = `${CYAN}${pad(String(proc.port), portWidth)}${RESET}`;
    const pid = `${DIM}${pad(String(proc.pid), pidWidth)}${RESET}`;
    const framework = `${GREEN}${pad(proc.framework ?? "", fwWidth)}${RESET}`;
    const dir = `${GRAY}${shortenPath(proc.cwd)}${RESET}`;
    console.log(`  ${port}  ${pid}  ${framework}  ${dir}`);
  }

  console.log("");
}

/** Print a success message */
export function success(msg: string): void {
  console.log(`${GREEN}  ✓${RESET} ${msg}`);
}

/** Print a warning message */
export function warn(msg: string): void {
  console.log(`${YELLOW}  ⚠${RESET} ${msg}`);
}

/** Print an error message */
export function error(msg: string): void {
  console.log(`${RED}  ✗${RESET} ${msg}`);
}
