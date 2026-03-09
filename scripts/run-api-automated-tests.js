#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const AUTOMATED_DIR = path.join(ROOT, 'tests', 'api', 'automated');
const STEPS_DIR = path.join(AUTOMATED_DIR, 'steps');
const ARTIFACTS_ROOT = path.join(AUTOMATED_DIR, 'artifacts');
const COMMON_ENV_PATH = path.join(AUTOMATED_DIR, 'common.env');
const SUITE_PATH = path.join(AUTOMATED_DIR, 'suite.txt');

function readEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const idx = line.indexOf('=');
    if (idx <= 0) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    out[key] = value;
  }

  return out;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function substituteString(input, vars) {
  if (typeof input !== 'string') return input;

  return input.replace(/\$\{?([A-Z0-9_]+)\}?/g, (_, varName) => {
    if (vars[varName] === undefined || vars[varName] === null) {
      return '';
    }
    return String(vars[varName]);
  });
}

function substituteDeep(value, vars) {
  if (typeof value === 'string') return substituteString(value, vars);
  if (Array.isArray(value)) return value.map((v) => substituteDeep(v, vars));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = substituteDeep(v, vars);
    }
    return out;
  }
  return value;
}

function getByPath(obj, pathExpr) {
  if (!pathExpr) return undefined;
  const parts = pathExpr.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (/^\d+$/.test(part)) {
      current = current[Number(part)];
    } else {
      current = current[part];
    }
  }
  return current;
}

function loadStepFiles() {
  if (!fs.existsSync(STEPS_DIR)) {
    throw new Error(`Missing steps directory: ${STEPS_DIR}`);
  }
  let stepFiles = [];

  if (fs.existsSync(SUITE_PATH)) {
    stepFiles = fs
      .readFileSync(SUITE_PATH, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
  } else {
    stepFiles = fs
      .readdirSync(STEPS_DIR)
      .filter((f) => f.endsWith('.posting.yaml'))
      .sort();
  }

  return stepFiles.map((f) => {
    const abs = path.join(STEPS_DIR, f);
    if (!fs.existsSync(abs)) {
      throw new Error(`Step file listed but not found: ${abs}`);
    }
    const doc = yaml.load(fs.readFileSync(abs, 'utf8'));
    return {
      file: f,
      abs,
      doc: doc || {},
    };
  });
}

function normalizeHeaders(stepDoc, vars) {
  const headers = {};
  if (!stepDoc.headers) return headers;

  if (Array.isArray(stepDoc.headers)) {
    for (const h of stepDoc.headers) {
      if (!h || !h.name) continue;
      headers[h.name] = substituteString(String(h.value || ''), vars);
    }
    return headers;
  }

  for (const [k, v] of Object.entries(stepDoc.headers)) {
    headers[k] = substituteString(String(v), vars);
  }

  return headers;
}

function normalizeRequest(stepDoc, vars) {
  const req = stepDoc.request || {};
  const method = (stepDoc.method || req.method || 'GET').toUpperCase();

  const rawPath =
    stepDoc.path || req.path || stepDoc.url || req.url || stepDoc.endpoint;
  if (!rawPath) {
    throw new Error('Step missing path/url');
  }

  const baseUrl = vars.BASE_URL || 'http://localhost:4001';
  const substitutedPath = substituteString(rawPath, vars);
  const url = substitutedPath.startsWith('http')
    ? substitutedPath
    : `${baseUrl}${substitutedPath}`;

  const headers = normalizeHeaders(stepDoc, vars);

  let body;
  if (stepDoc.body && stepDoc.body.file) {
    const rawFilePath = substituteString(stepDoc.body.file, vars);
    const absFilePath = path.isAbsolute(rawFilePath)
      ? rawFilePath
      : path.join(ROOT, rawFilePath);
    body = fs.readFileSync(absFilePath);
    const bodyType = stepDoc.body.content_type;
    if (bodyType && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = bodyType;
    }
  } else if (stepDoc.body && stepDoc.body.content !== undefined) {
    body = substituteString(stepDoc.body.content, vars);
    const bodyType = stepDoc.body.content_type;
    if (bodyType && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = bodyType;
    }
  } else if (req.body !== undefined || stepDoc.body !== undefined) {
    const bodyObj = req.body !== undefined ? req.body : stepDoc.body;
    const substituted = substituteDeep(bodyObj, vars);
    body =
      typeof substituted === 'string'
        ? substituted
        : JSON.stringify(substituted);
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  return { method, url, headers, body };
}

function evaluateExpectations(stepDoc, response, responseJson, vars) {
  const expect = stepDoc.expect || {};
  const rawExpectedStatus = expect.status || stepDoc.expectStatus || 200;
  const expectedStatuses = Array.isArray(rawExpectedStatus)
    ? rawExpectedStatus.map((s) => Number(s))
    : [Number(rawExpectedStatus)];

  const errors = [];
  if (!expectedStatuses.includes(response.status)) {
    errors.push(
      `Expected HTTP ${expectedStatuses.join(' or ')} but got ${response.status}`
    );
  }

  const jsonChecks = Array.isArray(expect.json) ? expect.json : [];
  for (const check of jsonChecks) {
    const actual = getByPath(responseJson, check.path);
    if (Object.prototype.hasOwnProperty.call(check, 'equals')) {
      const expected = substituteDeep(check.equals, vars);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        errors.push(
          `JSON check failed at '${check.path}': expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
        );
      }
    }
    if (check.exists === true && actual === undefined) {
      errors.push(
        `JSON check failed at '${check.path}': expected value to exist`
      );
    }
  }

  return errors;
}

function applyCaptures(stepDoc, responseJson, vars) {
  const capture = stepDoc.capture || {};
  for (const [name, jsonPath] of Object.entries(capture)) {
    const val = getByPath(responseJson, jsonPath);
    if (val !== undefined && val !== null) {
      vars[name] = val;
    }
  }
}

async function executeStep(step, vars, artifactDir) {
  const startedAt = new Date().toISOString();
  const stepName = step.doc.name || step.file;

  const request = normalizeRequest(step.doc, vars);
  const reqArtifact = {
    step: stepName,
    file: step.file,
    request,
    startedAt,
  };

  const safeBase = step.file.replace(/\.posting\.yaml$/, '');
  const reqPath = path.join(artifactDir, `${safeBase}.request.json`);
  fs.writeFileSync(reqPath, JSON.stringify(reqArtifact, null, 2) + '\n');

  let response;
  let responseText = '';
  let responseJson = null;

  try {
    response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    responseText = await response.text();
    try {
      responseJson = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseJson = null;
    }
  } catch (err) {
    return {
      ok: false,
      step,
      errors: [`Request error: ${err.message || String(err)}`],
      response: null,
      responseText,
      responseJson,
    };
  }

  const errors = evaluateExpectations(step.doc, response, responseJson, vars);
  if (!errors.length) {
    applyCaptures(step.doc, responseJson, vars);
  }

  const resArtifact = {
    step: stepName,
    file: step.file,
    status: response.status,
    ok: errors.length === 0,
    errors,
    responseHeaders: Object.fromEntries(response.headers.entries()),
    responseText,
    responseJson,
    finishedAt: new Date().toISOString(),
  };
  const resPath = path.join(artifactDir, `${safeBase}.response.json`);
  fs.writeFileSync(resPath, JSON.stringify(resArtifact, null, 2) + '\n');

  return {
    ok: errors.length === 0,
    step,
    errors,
    response,
    responseText,
    responseJson,
  };
}

async function runSteps(label, steps, vars, artifactDir, stopOnFailure) {
  const results = [];
  for (const step of steps) {
    const requiredVars = Array.isArray(step.doc.whenVars)
      ? step.doc.whenVars
      : [];
    const missingVars = requiredVars.filter((name) => !vars[name]);
    if (missingVars.length) {
      console.log(
        `- ${label}: ${step.file} ... SKIPPED (missing vars: ${missingVars.join(', ')})`
      );
      results.push({
        ok: true,
        skipped: true,
        step,
        errors: [],
      });
      continue;
    }

    process.stdout.write(`- ${label}: ${step.file} ... `);
    const result = await executeStep(step, vars, artifactDir);
    results.push(result);
    if (result.ok) {
      console.log('OK');
    } else {
      console.log('FAILED');
      for (const err of result.errors) {
        console.log(`  ${err}`);
      }
      if (stopOnFailure) {
        break;
      }
    }
  }
  return results;
}

function boolFromEnv(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
}

function buildResourceSummary(vars) {
  const resources = [];

  if (vars.USER_ID) resources.push(`created user: ${vars.USER_ID}`);
  if (vars.TOURNAMENT_ID)
    resources.push(`created tournament: ${vars.TOURNAMENT_ID}`);
  if (vars.SQUAD_A_ID) resources.push(`created squad A: ${vars.SQUAD_A_ID}`);
  if (vars.SQUAD_B_ID) resources.push(`created squad B: ${vars.SQUAD_B_ID}`);
  if (vars.SQUAD_C_ID) resources.push(`created squad C: ${vars.SQUAD_C_ID}`);
  if (vars.SQUAD_D_ID) resources.push(`created squad D: ${vars.SQUAD_D_ID}`);
  if (vars.TEAMSHEET_SQUAD_ID)
    resources.push(`teamsheet squad: ${vars.TEAMSHEET_SQUAD_ID}`);
  if (vars.TEAMSHEET_PLAYERS_CREATED !== undefined)
    resources.push(
      `teamsheet players created: ${vars.TEAMSHEET_PLAYERS_CREATED}`
    );
  if (vars.FIXTURE_1_ID)
    resources.push(`loaded fixture 1: ${vars.FIXTURE_1_ID}`);
  if (vars.FIXTURE_2_ID)
    resources.push(`loaded fixture 2: ${vars.FIXTURE_2_ID}`);
  if (vars.CARD_ID) resources.push(`created card: ${vars.CARD_ID}`);

  return resources;
}

async function main() {
  fs.mkdirSync(ARTIFACTS_ROOT, { recursive: true });

  const vars = {
    ...readEnvFile(COMMON_ENV_PATH),
    ...process.env,
  };

  vars.RUN_ID =
    vars.RUN_ID || `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  vars.BASE_URL = vars.BASE_URL || 'http://localhost:4001';
  vars.TEST_EMAIL =
    vars.TEST_EMAIL || `api.automated+${vars.RUN_ID}@example.test`;
  vars.TEST_NAME = vars.TEST_NAME || `API Automated ${vars.RUN_ID}`;
  vars.TEST_PASSWORD = vars.TEST_PASSWORD || 'pp-test-pass-123';

  const allSteps = loadStepFiles();
  const setupSteps = allSteps.filter(
    (s) => (s.doc.phase || 'setup') === 'setup'
  );
  const cleanupSteps = allSteps
    .filter((s) => s.doc.phase === 'cleanup')
    .sort((a, b) => a.file.localeCompare(b.file));

  const artifactDir = path.join(ARTIFACTS_ROOT, stamp());
  fs.mkdirSync(artifactDir, { recursive: true });

  fs.writeFileSync(
    path.join(artifactDir, 'resolved-vars.json'),
    JSON.stringify(vars, null, 2) + '\n'
  );

  console.log(`API automated tests`);
  console.log(`Base URL: ${vars.BASE_URL}`);
  console.log(`Artifacts: ${artifactDir}`);
  console.log(`Setup steps: ${setupSteps.length}`);
  console.log(`Cleanup steps: ${cleanupSteps.length}`);

  const cleanupEnabled = boolFromEnv('CLEANUP', false);

  const setupResults = await runSteps(
    'setup',
    setupSteps,
    vars,
    artifactDir,
    true
  );
  const setupFailed = setupResults.some((r) => !r.ok);

  let cleanupResults = [];
  if (cleanupEnabled) {
    console.log('Running cleanup steps...');
    cleanupResults = await runSteps(
      'cleanup',
      cleanupSteps,
      vars,
      artifactDir,
      false
    );
  } else {
    console.log(
      'Cleanup disabled. Set CLEANUP=true to remove created test data.'
    );
  }

  const cleanupFailed = cleanupResults.some((r) => !r.ok);

  const summary = {
    setupTotal: setupResults.length,
    setupPassed: setupResults.filter((r) => r.ok && !r.skipped).length,
    setupSkipped: setupResults.filter((r) => r.skipped).length,
    setupFailed: setupResults.filter((r) => !r.ok).length,
    cleanupEnabled,
    cleanupTotal: cleanupResults.length,
    cleanupPassed: cleanupResults.filter((r) => r.ok && !r.skipped).length,
    cleanupSkipped: cleanupResults.filter((r) => r.skipped).length,
    cleanupFailed: cleanupResults.filter((r) => !r.ok).length,
    artifactDir,
    status: setupFailed || cleanupFailed ? 'FAILED' : 'PASSED',
  };

  fs.writeFileSync(
    path.join(artifactDir, 'summary.json'),
    JSON.stringify(summary, null, 2) + '\n'
  );

  const resourceSummary = buildResourceSummary(vars);
  fs.writeFileSync(
    path.join(artifactDir, 'resources.json'),
    JSON.stringify({ resources: resourceSummary }, null, 2) + '\n'
  );

  console.log('\nTest summary');
  console.log(`- status: ${summary.status}`);
  console.log(`- setup: ${summary.setupPassed}/${summary.setupTotal} passed`);
  console.log(`- setup skipped: ${summary.setupSkipped}`);
  if (cleanupEnabled) {
    console.log(
      `- cleanup: ${summary.cleanupPassed}/${summary.cleanupTotal} passed`
    );
    console.log(`- cleanup skipped: ${summary.cleanupSkipped}`);
  }
  console.log(`- artifacts: ${artifactDir}`);
  if (resourceSummary.length > 0) {
    console.log('- resources:');
    for (const line of resourceSummary) {
      console.log(`  - ${line}`);
    }
  } else {
    console.log('- resources: none captured');
  }

  if (setupFailed || cleanupFailed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
