#!/usr/bin/env node
import { commands } from './commands';
import { renderCommandHelp, renderHelp } from './help';
import { parseArgs, hasHelpFlag } from './utils';

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const helpTarget =
    parsed.command === 'help' ? parsed.positionals[0] || null : parsed.command;

  if (!parsed.command || hasHelpFlag(parsed)) {
    if (helpTarget && helpTarget !== '--help') {
      const command = commands.find((entry) => entry.name === helpTarget);
      if (command) {
        process.stdout.write(`${renderCommandHelp(command)}\n`);
        return;
      }
    }

    process.stdout.write(`${renderHelp(commands)}\n`);
    return;
  }

  const command = commands.find((entry) => entry.name === parsed.command);
  if (!command) {
    throw new Error(
      `Unknown command '${parsed.command}'. Run 'pp-api-cli --help' for usage.`
    );
  }

  await command.run({
    argv: process.argv.slice(2),
    parsed,
  });
}

main().catch((error: any) => {
  process.stderr.write(`pp-api-cli error: ${error.message}\n`);
  process.exit(1);
});
