import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';

const servicesDir = path.resolve('dist/src/api/services');
const mocksDir = path.join(servicesDir, 'mocks');

const serviceNames = [
  'auth',
  'clubs',
  'events',
  'fixtures',
  'general',
  'listings',
  'regions',
  'rulesets',
  'series',
  'teams',
  'tournaments',
  'users',
  'annual-reports',
  'championships',
];

function getMethods(filePath: string): string[] {
  const mod = require(filePath);
  const factory = mod.default || mod;
  const svc = factory({});
  return Object.keys(svc)
    .filter((key) => typeof svc[key] === 'function')
    .sort();
}

describe('mock service parity', () => {
  serviceNames.forEach((name) => {
    it(`${name} mock exposes every real service method`, () => {
      const realFile = path.join(servicesDir, `${name}.js`);
      const mockFile = path.join(mocksDir, `${name}.js`);

      assert.ok(
        fs.existsSync(realFile),
        `Real service file missing: ${realFile}`
      );
      assert.ok(fs.existsSync(mockFile), `Mock service file missing: ${mockFile}`);

      const realMethods = getMethods(realFile);
      const mockMethods = getMethods(mockFile);

      const missing = realMethods.filter((m) => !mockMethods.includes(m));
      const extra = mockMethods.filter((m) => !realMethods.includes(m));

      assert.deepStrictEqual(
        { missing, extra },
        { missing: [], extra: [] },
        `${name} service mock is not in parity with real service`
      );
    });
  });
});
