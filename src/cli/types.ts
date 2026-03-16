export interface ParsedArgs {
  command: string | null;
  positionals: string[];
  options: Record<string, string | boolean | string[]>;
}

export interface CommandContext {
  argv: string[];
  parsed: ParsedArgs;
}

export interface CommandDefinition {
  name: string;
  summary: string;
  usage: string;
  run: (context: CommandContext) => Promise<void>;
}
