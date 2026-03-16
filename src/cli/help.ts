import { CommandDefinition } from './types';

export function renderHelp(commands: CommandDefinition[]): string {
  const commandLines = commands
    .map((command) => `  ${command.name.padEnd(10)} ${command.summary}`)
    .join('\n');

  return [
    'pp-api-cli',
    '',
    'Usage:',
    '  pp-api-cli <command> [options]',
    '  pp-api-cli --help',
    '',
    'Commands:',
    commandLines,
    '',
    'Examples:',
    '  pp-api-cli serve --port 4010 --mock',
    '  pp-api-cli health --base-url http://localhost:4010',
    '  pp-api-cli routes --method GET --contains tournament',
    '  pp-api-cli request --path /api/system/mode',
    '',
    'Run `pp-api-cli <command> --help` for command-specific usage.',
  ].join('\n');
}

export function renderCommandHelp(command: CommandDefinition): string {
  return [
    `pp-api-cli ${command.name}`,
    '',
    command.summary,
    '',
    'Usage:',
    `  ${command.usage}`,
  ].join('\n');
}
