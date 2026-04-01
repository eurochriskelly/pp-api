import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TSVValidator } from '../../src/api/services/fixtures/validate-tsv';

const tsv = `TIME\tMATCH\tCATEGORY\tPITCH\tTEAM1\tSTAGE\tTEAM2\tUMPIRES\tDURATION
11:30\tA.07\tDivision1\tPitch_1\tNantes\tGp.3\tChouettes Gallèses\tRennes\t20`;

function getImportedTeamName(tsvEncoded: string): string {
  const result = new TSVValidator(tsvEncoded, {
    restGapMultiplier: 1,
  }).validate();

  return result.rows[0].TEAM2.value as string;
}

test('TSV validator preserves accented characters for UTF-8 uploads', () => {
  const tsvEncoded = Buffer.from(tsv, 'utf8').toString('base64');

  assert.equal(getImportedTeamName(tsvEncoded), 'CHOUETTES GALLÈSES');
});

test('TSV validator preserves accented characters for Windows-1252 uploads', () => {
  const tsvEncoded = Buffer.from(tsv, 'latin1').toString('base64');

  assert.equal(getImportedTeamName(tsvEncoded), 'CHOUETTES GALLÈSES');
});

test('TSV validator preserves accented characters for UTF-16LE uploads', () => {
  const utf16LeBuffer = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from(tsv, 'utf16le'),
  ]);
  const tsvEncoded = utf16LeBuffer.toString('base64');

  assert.equal(getImportedTeamName(tsvEncoded), 'CHOUETTES GALLÈSES');
});
