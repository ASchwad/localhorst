import { discoverPorts } from "../lib/ports";
import { enrichProcesses } from "../lib/process-info";
import { renderTable, error } from "../lib/output";

export async function listCommand(): Promise<void> {
  try {
    const ports = await discoverPorts();
    const processes = await enrichProcesses(ports);
    renderTable(processes);
  } catch (err) {
    if (err instanceof Error && err.message.includes("EACCES")) {
      error("Permission denied. Try running with sudo.");
    } else {
      error(`Failed to list processes: ${err}`);
    }
    process.exit(1);
  }
}
