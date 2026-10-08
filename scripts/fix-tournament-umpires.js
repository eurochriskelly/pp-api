#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

const root = path.resolve(__dirname, '..');
const env = {
  ...dotenv.parse(fs.readFileSync(path.join(root, '.env'))),
  ...dotenv.parse(fs.readFileSync(path.join(root, '.kamal/secrets.prd'))),
};

const tournamentId = Number(process.argv[2] || 68);
const category = (process.argv[3] || 'HURLING').toUpperCase();

function fixtureWinner(fixture, position) {
  if (fixture.outcome !== 'played') return null;
  const team = position === 1 ? fixture.team1 : fixture.team2;
  const opponent = position === 1 ? fixture.team2 : fixture.team1;
  if (
    !team?.name ||
    !opponent?.name ||
    team.total == null ||
    opponent.total == null
  ) {
    return null;
  }
  if (team.total <= opponent.total) return null;
  return team.name;
}

function resolveReference(reference, report, fixtureById, standings) {
  if (!reference || !reference.startsWith('~')) return reference || null;

  const groupMatch = reference.match(/^~group:(\d+)\/p:(\d+)$/);
  if (groupMatch) {
    const rows = standings.byGroup?.[`GP.${groupMatch[1]}`] || [];
    return rows[Number(groupMatch[2]) - 1]?.team || null;
  }

  const matchMatch = reference.match(/^~match:(\d+)\/p:([12])$/);
  if (matchMatch) {
    return fixtureWinner(
      fixtureById.get(Number(matchMatch[1])),
      Number(matchMatch[2])
    );
  }

  return null;
}

async function fetchReport() {
  const url = `https://live.pitchperfect.eu.com/api/tournaments/${tournamentId}/report`;
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to fetch report: HTTP ${response.status}`);
  const payload = await response.json();
  const report = payload.data;
  const categoryReport = report.categories.find(
    (candidate) => candidate.category.toUpperCase() === category
  );
  if (!categoryReport) throw new Error(`Category ${category} was not found`);
  return categoryReport;
}

async function main() {
  const categoryReport = await fetchReport();
  const allFixtures = [
    ...categoryReport.fixtures.stage.group,
    ...categoryReport.fixtures.stage.knockouts,
  ];
  const fixtureById = new Map(
    allFixtures.map((fixture) => [fixture.matchId, fixture])
  );
  const expected = categoryReport.fixtures.stage.knockouts
    .map((fixture) => ({
      id: fixture.matchId,
      planned: fixture.planned.umpireTeam,
      umpireTeamId: resolveReference(
        fixture.planned.umpireTeam,
        categoryReport,
        fixtureById,
        categoryReport.standings
      ),
    }))
    .filter(
      (fixture) => fixture.umpireTeamId && !fixture.umpireTeamId.startsWith('~')
    );

  const connection = await mysql.createConnection({
    host: process.env.PP_DB_HOST || env.PP_HOSTNAME_DB_PRD,
    port: Number(process.env.PP_DB_PORT || 3306),
    user: env.PP_USR_PRD,
    password: env.PP_PWD,
    database: env.PP_DATABASE,
    charset: 'utf8mb4',
  });

  try {
    await connection.beginTransaction();
    let updated = 0;
    for (const target of expected) {
      const [rows] = await connection.query(
        `SELECT id, category, umpireTeamPlanned, umpireTeamId
         FROM fixtures
         WHERE id = ? AND tournamentId = ?
         FOR UPDATE`,
        [target.id, tournamentId]
      );
      const row = rows[0];
      if (!row || row.category !== category) {
        throw new Error(
          `Fixture ${target.id} is missing or is not ${category}`
        );
      }
      if (row.umpireTeamPlanned !== target.planned) {
        throw new Error(`Fixture ${target.id} umpire placeholder changed`);
      }
      if (row.umpireTeamId !== target.umpireTeamId) {
        await connection.query(
          'UPDATE fixtures SET umpireTeamId = ? WHERE id = ? AND tournamentId = ?',
          [target.umpireTeamId, target.id, tournamentId]
        );
        console.log(
          `${target.id}: ${row.umpireTeamId} -> ${target.umpireTeamId}`
        );
        updated += 1;
      }
    }
    await connection.commit();
    console.log(`Updated ${updated} ${category} umpire assignment(s).`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
