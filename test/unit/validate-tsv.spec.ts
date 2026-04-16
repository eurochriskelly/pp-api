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

test('TSV validator accepts BEST syntax in knockout stage', () => {
  const tsvWithBest = `TIME\tMATCH\tCATEGORY\tPITCH\tTEAM1\tSTAGE\tTEAM2\tUMPIRES\tDURATION
11:30\tA.01\tCup\tPitch_1\t1ST BEST 2ND\tA.QF1\t2ND BEST 2ND\tRennes\t20`;
  const result = new TSVValidator(
    Buffer.from(tsvWithBest, 'utf8').toString('base64')
  ).validate();

  assert.equal(result.warnings.length, 0);
  assert.equal(result.rows[0].TEAM1.value, '1st BEST 2nd');
  assert.equal(result.rows[0].TEAM2.value, '2nd BEST 2nd');
});

test('TSV validator accepts WORST syntax in knockout stage', () => {
  const tsvWithWorst = `TIME\tMATCH\tCATEGORY\tPITCH\tTEAM1\tSTAGE\tTEAM2\tUMPIRES\tDURATION
11:30\tA.01\tCup\tPitch_1\t1ST WORST 3RD\tA.QF1\t2ND WORST 3RD\tRennes\t20`;
  const result = new TSVValidator(
    Buffer.from(tsvWithWorst, 'utf8').toString('base64')
  ).validate();

  assert.equal(result.warnings.length, 0);
  assert.equal(result.rows[0].TEAM1.value, '1st WORST 3rd');
  assert.equal(result.rows[0].TEAM2.value, '2nd WORST 3rd');
});

test('TSV validator rejects malformed WORST syntax', () => {
  const tsvBadWorst = `TIME\tMATCH\tCATEGORY\tPITCH\tTEAM1\tSTAGE\tTEAM2\tUMPIRES\tDURATION
11:30\tA.01\tCup\tPitch_1\tWORST\tA.QF1\tTeamB\tRennes\t20`;
  const result = new TSVValidator(
    Buffer.from(tsvBadWorst, 'utf8').toString('base64')
  ).validate();

  const team1Warnings = result.warnings.filter(
    (w) =>
      w.column === 'TEAM1' && w.message.includes('WORST needs following pos')
  );
  assert.equal(team1Warnings.length, 1);
});
