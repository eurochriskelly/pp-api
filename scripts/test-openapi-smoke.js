#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {};
  for (const token of argv) {
    if (!token.startsWith('--')) continue;
    const [key, value] = token.slice(2).split('=');
    args[key] = value;
  }
  return args;
}

function isPathParameterized(p) {
  return /\{[^}]+\}/.test(p);
}

function shouldTestGetPath(pathname) {
  if (isPathParameterized(pathname)) return false;
  if (pathname === '/api/upload') return false;
  return true;
}

async function requestWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args.base || 'http://localhost:4001';
  const specFile =
    args.spec || path.join(process.cwd(), 'docs/api/openapi.json');
  const timeoutMs = Number(args.timeout || 8000);

  if (!fs.existsSync(specFile)) {
    console.error(`Spec file not found: ${specFile}`);
    process.exit(1);
  }

  const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  const paths = spec.paths || {};

  const testTargets = Object.keys(paths)
    .filter((p) => paths[p] && paths[p].get)
    .filter(shouldTestGetPath)
    .sort();

  if (testTargets.length === 0) {
    console.log('No GET endpoints without path params found for smoke tests.');
    process.exit(0);
  }

  const results = [];

  for (const endpoint of testTargets) {
    const url = `${baseUrl}${endpoint}`;
    try {
      const res = await requestWithTimeout(url, timeoutMs);
      const status = res.status;

      const isFailure = status >= 500 || status === 404;

      results.push({
        endpoint,
        status,
        ok: !isFailure,
      });
    } catch (err) {
      results.push({
        endpoint,
        status: 'ERR',
        ok: false,
        error: err && err.message ? err.message : String(err),
      });
    }
  }

  const failures = results.filter((r) => !r.ok);
  const passes = results.length - failures.length;

  console.log(`OpenAPI smoke tests against ${baseUrl}`);
  console.log(`Endpoints checked: ${results.length}`);
  console.log(`Passed: ${passes}`);
  console.log(`Failed: ${failures.length}`);

  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) {
      if (f.error) {
        console.log(`- GET ${f.endpoint} -> ${f.status} (${f.error})`);
      } else {
        console.log(`- GET ${f.endpoint} -> ${f.status}`);
      }
    }
    process.exit(1);
  }

  console.log(
    'Smoke test passed: no 404/5xx/transport failures detected on tested GET endpoints.'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
