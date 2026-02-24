#!/usr/bin/env bun

import { parseArgs } from "util";
import { listCommand } from "./commands/list";
import { killCommand } from "./commands/kill";

const VERSION = "0.1.0";

const HELP = `
  localhorst v${VERSION}
  List and kill local dev servers running on ports 3000–9000.

  Usage:
    localhorst                  List all dev servers
    localhorst list             Same as above
    localhorst kill <port>      Kill the process on that port
    localhorst kill --all       Kill all discovered dev servers
    localhorst kill <port> -f   Force kill (SIGKILL) if SIGTERM isn't enough

  Options:
    -h, --help      Show this help message
    -v, --version   Show version number
    -f, --force     Use SIGKILL instead of SIGTERM
    -a, --all       Kill all discovered dev servers
`;

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
      force: { type: "boolean", short: "f", default: false },
      all: { type: "boolean", short: "a", default: false },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help) {
    console.log(HELP);
    process.exit(0);
  }

  if (values.version) {
    console.log(`localhorst v${VERSION}`);
    process.exit(0);
  }

  const command = positionals[0] ?? "list";

  switch (command) {
    case "list":
      await listCommand();
      break;

    case "kill": {
      const portArg = positionals[1];
      const port = portArg ? parseInt(portArg, 10) : undefined;

      if (portArg && isNaN(port!)) {
        console.error(`  Error: "${portArg}" is not a valid port number.`);
        process.exit(1);
      }

      if (!port && !values.all) {
        console.error(
          "  Error: Please specify a port number or use --all.\n  Usage: localhorst kill <port> or localhorst kill --all",
        );
        process.exit(1);
      }

      await killCommand({
        port,
        all: values.all,
        force: values.force,
      });
      break;
    }

    default:
      console.error(`  Unknown command: "${command}"\n  Run localhorst --help for usage.`);
      process.exit(1);
  }
}

main();
