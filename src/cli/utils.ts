import fs from 'fs';
import path from 'path';
import { ParsedArgs } from './types';

export function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  const options: Record<string, string | boolean | string[]> = {};
  const positionals: string[] = [];
  let command: string | null = null;

  while (args.length > 0) {
    const token = args.shift() as string;

    if (!command && !token.startsWith('-')) {
      command = token;
      continue;
    }

    if (token.startsWith('--')) {
      const [rawKey, inlineValue] = token.slice(2).split('=');
      const key = rawKey.trim();
      const nextValue =
        inlineValue !== undefined
          ? inlineValue
          : args[0] && !args[0].startsWith('-')
            ? (args.shift() as string)
            : true;
      assignOption(options, key, nextValue);
      continue;
    }

    if (token.startsWith('-') && token.length > 1) {
      token
        .slice(1)
        .split('')
        .forEach((key) => assignOption(options, key, true));
      continue;
    }

    positionals.push(token);
  }

  return { command, positionals, options };
}

function assignOption(
  target: Record<string, string | boolean | string[]>,
  key: string,
  value: string | boolean
) {
  const current = target[key];
  if (current === undefined) {
    target[key] = value;
    return;
  }

  if (Array.isArray(current)) {
    current.push(String(value));
    return;
  }

  target[key] = [String(current), String(value)];
}

export function hasHelpFlag(parsed: ParsedArgs): boolean {
  return (
    parsed.command === 'help' ||
    parsed.options.help === true ||
    parsed.options.h === true
  );
}

export function getStringOption(
  parsed: ParsedArgs,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = parsed.options[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }
  return undefined;
}

export function getBooleanOption(parsed: ParsedArgs, ...keys: string[]): boolean {
  return keys.some((key) => parsed.options[key] === true);
}

export function getRepeatedStringOption(
  parsed: ParsedArgs,
  ...keys: string[]
): string[] {
  const values: string[] = [];
  keys.forEach((key) => {
    const value = parsed.options[key];
    if (typeof value === 'string') {
      values.push(value);
    } else if (Array.isArray(value)) {
      values.push(...value);
    }
  });
  return values;
}

export function parseKeyValueEntries(entries: string[]): Record<string, string> {
  return entries.reduce((acc, entry) => {
    const separatorIndex = entry.indexOf('=');
    if (separatorIndex === -1) {
      throw new Error(`Expected key=value entry, received '${entry}'.`);
    }

    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();
    if (!key) {
      throw new Error(`Expected key=value entry, received '${entry}'.`);
    }

    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
}

export function resolveApiBaseUrl(parsed: ParsedArgs): string {
  const explicit = getStringOption(parsed, 'base-url', 'baseUrl');
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }

  const port = process.env.PP_PORT_API || process.env.PORT || '4001';
  return `http://localhost:${port}`;
}

export function printJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function projectRoot(): string {
  return process.cwd();
}

export function readJsonInput(raw: string): unknown {
  if (raw.startsWith('@')) {
    const filePath = path.resolve(projectRoot(), raw.slice(1));
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  return JSON.parse(raw);
}
