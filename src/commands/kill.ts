import { discoverPorts } from "../lib/ports";
import { enrichProcesses } from "../lib/process-info";
import { success, warn, error } from "../lib/output";

interface KillOptions {
  port?: number;
  all?: boolean;
  force?: boolean;
}

function killProcess(pid: number, force: boolean): boolean {
  try {
    process.kill(pid, force ? "SIGKILL" : "SIGTERM");
    return true;
  } catch (err: any) {
    if (err.code === "ESRCH") {
      // Process already exited
      return false;
    }
    throw err;
  }
}

export async function killCommand(opts: KillOptions): Promise<void> {
  const ports = await discoverPorts();
  const processes = await enrichProcesses(ports);

  if (opts.all) {
    if (processes.length === 0) {
      warn("No dev servers found to kill.");
      return;
    }

    let killed = 0;
    for (const proc of processes) {
      const signal = opts.force ? "SIGKILL" : "SIGTERM";
      if (killProcess(proc.pid, !!opts.force)) {
        success(
          `Killed ${proc.framework} on port ${proc.port} (PID ${proc.pid}) with ${signal}`,
        );
        killed++;
      } else {
        warn(
          `Process on port ${proc.port} (PID ${proc.pid}) already exited.`,
        );
      }
    }

    if (killed === 0) {
      warn("No processes were killed.");
    } else {
      console.log(`\n  Killed ${killed} process${killed === 1 ? "" : "es"}.`);
    }
    return;
  }

  if (opts.port === undefined) {
    error("Please specify a port number or use --all.");
    process.exit(1);
  }

  const target = processes.find((p) => p.port === opts.port);
  if (!target) {
    error(`No process found listening on port ${opts.port}.`);
    process.exit(1);
  }

  const signal = opts.force ? "SIGKILL" : "SIGTERM";
  if (killProcess(target.pid, !!opts.force)) {
    success(
      `Killed ${target.framework} on port ${target.port} (PID ${target.pid}) with ${signal}`,
    );
  } else {
    warn(`Process on port ${target.port} (PID ${target.pid}) already exited.`);
  }
}
