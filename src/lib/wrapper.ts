export function GET(path: string): string[] {
  const pathVars = path
    .split('/')
    .filter((x) => x.trim())
    .filter((x) => x.startsWith(':'));
  return pathVars;
}
