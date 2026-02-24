import { discoverPorts } from "../lib/ports";
import { enrichProcesses, type ProcessInfo } from "../lib/process-info";
import { ANSI } from "../lib/output";

interface State {
  processes: ProcessInfo[];
  selectedIndex: number;
  mode: "list" | "actions" | "confirm-kill-all";
  message: string | null;
}

const state: State = {
  processes: [],
  selectedIndex: 0,
  mode: "list",
  message: null,
};

function shortenPath(path: string): string {
  const home = process.env.HOME;
  if (home && path.startsWith(home)) {
    return "~" + path.slice(home.length);
  }
  return path;
}

function pad(str: string, width: number): string {
  return str + " ".repeat(Math.max(0, width - str.length));
}

function render(): void {
  const { RESET, BOLD, DIM, CYAN, GREEN, RED, GRAY, INVERSE, CLEAR_SCREEN } = ANSI;

  let out = CLEAR_SCREEN;

  out += `\n${BOLD}  localhorst${RESET} ${DIM}— interactive mode${RESET}\n\n`;

  if (state.processes.length === 0) {
    out += `${DIM}  No dev servers found on ports 3000–9000.${RESET}\n`;
    out += `\n${DIM}  Press ${RESET}r${DIM} to refresh · ${RESET}q${DIM} to quit${RESET}\n`;
    process.stdout.write(out);
    return;
  }

  // Compute column widths
  const portWidth = Math.max(4, ...state.processes.map((p) => String(p.port).length));
  const pidWidth = Math.max(3, ...state.processes.map((p) => String(p.pid).length));
  const fwWidth = Math.max(7, ...state.processes.map((p) => (p.framework ?? "").length));

  // Header
  out += `  ${BOLD}${pad("PORT", portWidth)}  ${pad("PID", pidWidth)}  ${pad("PROCESS", fwWidth)}  DIRECTORY${RESET}\n`;
  out += `  ${DIM}${pad("─".repeat(portWidth), portWidth)}  ${pad("─".repeat(pidWidth), pidWidth)}  ${pad("─".repeat(fwWidth), fwWidth)}  ${"─".repeat(30)}${RESET}\n`;

  // Rows
  for (let i = 0; i < state.processes.length; i++) {
    const proc = state.processes[i];
    const isSelected = i === state.selectedIndex;

    if (isSelected) {
      const port = pad(String(proc.port), portWidth);
      const pid = pad(String(proc.pid), pidWidth);
      const framework = pad(proc.framework ?? "", fwWidth);
      const dir = shortenPath(proc.cwd);
      out += `${INVERSE}${BOLD}  ${port}  ${pid}  ${framework}  ${dir}  ${RESET}\n`;

      if (state.mode === "actions") {
        out += `${CYAN}    [o]${RESET} Open  ${CYAN}[c]${RESET} VS Code  ${CYAN}[k]${RESET} Kill  ${DIM}[Esc] Back${RESET}\n`;
      }
    } else {
      const port = `${CYAN}${pad(String(proc.port), portWidth)}${RESET}`;
      const pid = `${DIM}${pad(String(proc.pid), pidWidth)}${RESET}`;
      const framework = `${GREEN}${pad(proc.framework ?? "", fwWidth)}${RESET}`;
      const dir = `${GRAY}${shortenPath(proc.cwd)}${RESET}`;
      out += `  ${port}  ${pid}  ${framework}  ${dir}\n`;
    }
  }

  // Confirm kill-all prompt
  if (state.mode === "confirm-kill-all") {
    out += `\n${BOLD}${RED}  Kill all ${state.processes.length} process${state.processes.length === 1 ? "" : "es"}? ${RESET}${CYAN}[y]${RESET} Yes  ${CYAN}[n]${RESET} No\n`;
  }

  // Message area
  if (state.message) {
    out += `\n  ${state.message}\n`;
  }

  // Footer
  out += `\n${DIM}  ↑/↓ navigate · Enter select · K kill all · r refresh · q quit${RESET}\n`;

  process.stdout.write(out);
}

async function refresh(): Promise<void> {
  const ports = await discoverPorts();
  state.processes = await enrichProcesses(ports);
  // Clamp selected index
  if (state.selectedIndex >= state.processes.length) {
    state.selectedIndex = Math.max(0, state.processes.length - 1);
  }
  state.mode = "list";
}

function cleanup(): void {
  process.stdout.write(ANSI.SHOW_CURSOR);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
}

function openInBrowser(port: number): void {
  const url = `http://localhost:${port}`;
  Bun.spawn(["open", url], { stdout: "ignore", stderr: "ignore" });
  state.message = `${ANSI.GREEN}  ✓${ANSI.RESET} Opened ${url} in browser`;
  state.mode = "list";
}

function openInVSCode(cwd: string): void {
  if (!cwd) {
    state.message = `${ANSI.YELLOW}  ⚠${ANSI.RESET} No working directory found for this process`;
    state.mode = "list";
    return;
  }
  Bun.spawn(["code", cwd], { stdout: "ignore", stderr: "ignore" });
  state.message = `${ANSI.GREEN}  ✓${ANSI.RESET} Opened ${shortenPath(cwd)} in VS Code`;
  state.mode = "list";
}

function killProcess(proc: ProcessInfo): void {
  try {
    process.kill(proc.pid, "SIGTERM");
    state.message = `${ANSI.GREEN}  ✓${ANSI.RESET} Killed ${proc.framework} on port ${proc.port} (PID ${proc.pid})`;
  } catch (err: any) {
    if (err.code === "ESRCH") {
      state.message = `${ANSI.YELLOW}  ⚠${ANSI.RESET} Process on port ${proc.port} already exited`;
    } else if (err.code === "EPERM") {
      state.message = `${ANSI.RED}  ✗${ANSI.RESET} Permission denied killing PID ${proc.pid}. Try sudo.`;
    } else {
      state.message = `${ANSI.RED}  ✗${ANSI.RESET} Failed to kill PID ${proc.pid}: ${err.message}`;
    }
  }
}

function killAllProcesses(): void {
  let killed = 0;
  let failed = 0;
  for (const proc of state.processes) {
    try {
      process.kill(proc.pid, "SIGTERM");
      killed++;
    } catch {
      failed++;
    }
  }
  if (failed > 0) {
    state.message = `${ANSI.GREEN}  ✓${ANSI.RESET} Killed ${killed} process${killed === 1 ? "" : "es"}, ${ANSI.YELLOW}${failed} failed${ANSI.RESET}`;
  } else {
    state.message = `${ANSI.GREEN}  ✓${ANSI.RESET} Killed all ${killed} process${killed === 1 ? "" : "es"}`;
  }
}

async function handleKey(key: Buffer): Promise<boolean> {
  const seq = key.toString();

  // Ctrl+C — always exit
  if (seq === "\x03") return false;

  if (state.mode === "confirm-kill-all") {
    switch (seq) {
      case "y":
      case "Y":
        killAllProcesses();
        await refresh();
        render();
        return true;
      case "n":
      case "N":
      case "\x1b": // Escape
        state.mode = "list";
        state.message = null;
        render();
        return true;
      default:
        return true;
    }
  }

  if (state.mode === "actions") {
    const selected = state.processes[state.selectedIndex];

    switch (seq) {
      case "o":
        openInBrowser(selected.port);
        render();
        return true;
      case "c":
        openInVSCode(selected.cwd);
        render();
        return true;
      case "k":
        killProcess(selected);
        await refresh();
        render();
        return true;
      case "\x1b": // Escape
        state.mode = "list";
        state.message = null;
        render();
        return true;
      default:
        return true;
    }
  }

  // List mode
  switch (seq) {
    case "q":
      return false;

    case "\x1b[A": // Up arrow
      if (state.processes.length > 0) {
        state.selectedIndex = Math.max(0, state.selectedIndex - 1);
        state.message = null;
        render();
      }
      return true;

    case "\x1b[B": // Down arrow
      if (state.processes.length > 0) {
        state.selectedIndex = Math.min(state.processes.length - 1, state.selectedIndex + 1);
        state.message = null;
        render();
      }
      return true;

    case "\r": // Enter
      if (state.processes.length > 0) {
        state.mode = "actions";
        state.message = null;
        render();
      }
      return true;

    case "K":
      if (state.processes.length > 0) {
        state.mode = "confirm-kill-all";
        state.message = null;
        render();
      }
      return true;

    case "r":
      state.message = `${ANSI.DIM}  Refreshing...${ANSI.RESET}`;
      render();
      await refresh();
      state.message = null;
      render();
      return true;

    default:
      return true;
  }
}

export async function interactiveCommand(): Promise<void> {
  if (!process.stdin.isTTY) {
    console.error("  Interactive mode requires a TTY. Use `localhorst list` for non-interactive output.");
    process.exit(1);
  }

  // Initialize
  await refresh();

  // Set up terminal
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write(ANSI.HIDE_CURSOR);

  // Initial render
  render();

  // Handle cleanup on exit
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });

  // Keypress loop
  for await (const chunk of process.stdin) {
    const shouldContinue = await handleKey(chunk as Buffer);
    if (!shouldContinue) {
      cleanup();
      process.exit(0);
    }
  }
}
