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

const category = (process.argv[2] || 'HURLING').toUpperCase();
const targetsByCategory = {
  HURLING: [
    {
      id: 680021,
      team1Planned: '~group:1/p:1',
      team1Id: 'BRUSSELS A',
      team2Planned: '~group:2/p:2',
      team2Id: 'EINDHOVEN',
    },
    {
      id: 680022,
      team1Planned: '~group:2/p:1',
      team1Id: 'VIKINGS / VIENNA',
      team2Planned: '~group:1/p:2',
      team2Id: 'LUXEMBOURG / STOCK',
    },
    {
      id: 680020,
      team2Planned: '~group:3/p:4',
      team2Id: 'DARMSTADT / MAINZ A',
    },
    {
      id: 680025,
      team2Planned: '~group:3/p:2',
      team2Id: 'DEN HAAG',
    },
    {
      id: 680023,
      team1Planned: '~group:1/p:3',
      team1Id: 'AMSTERDAM A',
    },
  ],
  CAMOGIE: [
    {
      id: 681015,
      team1Planned: '~group:1/p:1',
      team1Id: 'BRUSSELS A',
      team2Planned: '~group:2/p:2',
      team2Id: 'LUXEMBOURG / BRUS B',
    },
    {
      id: 681016,
      team1Planned: '~group:2/p:1',
      team1Id: 'VIKINGS / LEUVEN',
      team2Planned: '~group:1/p:2',
      team2Id: 'AMSTERDAM A',
    },
    {
      id: 681013,
      team1Planned: '~group:1/p:3',
      team1Id: "MAASTRICHT / A'DAM B",
      team2Planned: '~group:2/p:4',
      team2Id: 'AACH / KOLN / DARM / SET',
    },
    {
      id: 681014,
      team1Planned: '~group:2/p:3',
      team1Id: 'EIND / D.HAAG / STOCK',
      team2Planned: '~group:1/p:4',
      team2Id: 'HAMB / BERLIN / PARIS',
    },
  ],
};

const targets = targetsByCategory[category];
if (!targets) {
  throw new Error(`Unsupported category ${category}; use HURLING or CAMOGIE`);
}

function assertTarget(row, target) {
  if (!row || row.category !== category) {
    throw new Error(`Fixture ${target.id} is missing or is not ${category}`);
  }

  for (const side of ['team1', 'team2']) {
    const planned = target[`${side}Planned`];
    if (planned && row[`${side}Planned`] !== planned) {
      throw new Error(
        `Fixture ${target.id} ${side} planned value changed: expected ${planned}, got ${row[`${side}Planned`]}`
      );
    }
  }
}

async function main() {
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
    const ids = targets.map((target) => target.id);
    const [rows] = await connection.query(
      `SELECT id, category, team1Planned, team1Id, team2Planned, team2Id
       FROM fixtures
       WHERE tournamentId = 68 AND category = ? AND id IN (?)
       FOR UPDATE`,
      [category, ids]
    );
    const rowsById = new Map(rows.map((row) => [row.id, row]));

    for (const target of targets) {
      const row = rowsById.get(target.id);
      assertTarget(row, target);
    }

    for (const target of targets) {
      const assignments = [];
      const values = [];
      for (const side of ['team1', 'team2']) {
        if (target[`${side}Id`]) {
          assignments.push(`${side}Id = ?`);
          values.push(target[`${side}Id`]);
        }
      }
      values.push(target.id);
      await connection.query(
        `UPDATE fixtures SET ${assignments.join(', ')} WHERE id = ?`,
        values
      );
    }

    await connection.commit();
    console.log(`Updated ${targets.length} ${category} playoff fixtures.`);
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
