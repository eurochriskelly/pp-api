#!/usr/bin/env node
// Dry-run by default. Reuses the championship tables; never guesses contributors.
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '../..');
const args = new Set(process.argv.slice(2));
const environment = (
  process.argv.find((arg) => arg.startsWith('--env=')) || '--env=dev'
).slice(6);
const aliases = {
  dev: 'DEV',
  acceptance: 'TST',
  test: 'TST',
  production: 'PRD',
};
const selected = aliases[environment];
if (!selected) throw new Error('Use --env=dev, acceptance, or production');
if (
  selected === 'PRD' &&
  args.has('--wet') &&
  !args.has('--confirm-production')
) {
  throw new Error('Production requires --wet and --confirm-production');
}
dotenv.config({ path: path.join(root, '.env'), quiet: true });
dotenv.config({
  path: path.join(root, '.env.local'),
  override: true,
  quiet: true,
});
dotenv.config({
  path: path.join(root, '.kamal', `secrets.${selected.toLowerCase()}`),
  override: true,
  quiet: true,
});

const participantSql = `SELECT tournamentId, TRIM(category) AS competition, team1Id AS teamName FROM fixtures
  UNION SELECT tournamentId, TRIM(category), team2Id FROM fixtures`;

const run = async () => {
  const connection = await mysql.createConnection({
    host:
      process.env[`PP_HOSTNAME_DB_${selected}`] ||
      process.env[`PP_HST_${selected}`] ||
      process.env.PP_HST,
    user: process.env[`PP_USR_${selected}`] || process.env.PP_USR,
    password: process.env.PP_PWD,
    database: process.env.PP_DATABASE || 'EuroTourno',
  });
  try {
    const [lock] = await connection.query(
      "SELECT GET_LOCK('competition-team-allocations', 10) AS acquired"
    );
    if (!lock[0].acquired)
      throw new Error('Another allocation migration is running');
    const [tables] = await connection.query(
      'SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema = DATABASE()'
    );
    for (const table of [
      'tournament_competitions',
      'championship_competition_rounds',
      'championship_entrants',
      'tournament_teams',
      'team_entrants',
    ]) {
      if (!tables.some((row) => row.name === table))
        throw new Error(
          `Missing ${table}; apply the championship and recent-schema migrations first`
        );
    }
    const [columns] = await connection.query(
      "SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'tournament_teams'"
    );
    const [indexes] = await connection.query(
      "SELECT DISTINCT INDEX_NAME AS name FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'tournament_teams'"
    );
    const statements = [];
    if (!columns.some((row) => row.name === 'competitionId')) {
      statements.push(
        'ALTER TABLE tournament_teams ADD COLUMN competitionId INT NULL, ADD CONSTRAINT fk_tt_competition FOREIGN KEY (competitionId) REFERENCES tournament_competitions(id) ON DELETE CASCADE'
      );
    } else {
      const [constraints] = await connection.query(
        "SELECT DELETE_RULE AS rule FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'tournament_teams' AND constraint_name = 'fk_tt_competition'"
      );
      if (constraints[0]?.rule !== 'CASCADE') {
        if (constraints.length)
          statements.push(
            'ALTER TABLE tournament_teams DROP FOREIGN KEY fk_tt_competition'
          );
        statements.push(
          'ALTER TABLE tournament_teams ADD CONSTRAINT fk_tt_competition FOREIGN KEY (competitionId) REFERENCES tournament_competitions(id) ON DELETE CASCADE'
        );
      }
    }
    if (!columns.some((row) => row.name === 'teamSuffix'))
      statements.push(
        'ALTER TABLE tournament_teams ADD COLUMN teamSuffix VARCHAR(8) NULL'
      );
    statements.push('ALTER TABLE tournament_teams MODIFY entrantId INT NULL');
    if (indexes.some((row) => row.name === 'uk_tournament_teams_name'))
      statements.push(
        'ALTER TABLE tournament_teams DROP INDEX uk_tournament_teams_name'
      );
    if (!indexes.some((row) => row.name === 'uk_competition_team_name'))
      statements.push(
        'ALTER TABLE tournament_teams ADD UNIQUE KEY uk_competition_team_name (competitionId, teamName)'
      );
    statements.push(
      `INSERT IGNORE INTO tournament_competitions (tournamentId, name) SELECT DISTINCT tournamentId, TRIM(category) FROM fixtures WHERE NULLIF(TRIM(category), '') IS NOT NULL`
    );
    // Only link a legacy row when its name identifies exactly one competition.
    statements.push(`UPDATE tournament_teams t JOIN (
      SELECT p.tournamentId, p.teamName, MIN(c.id) AS competitionId
      FROM (${participantSql}) p JOIN tournament_competitions c ON c.tournamentId = p.tournamentId AND c.name = p.competition
      GROUP BY p.tournamentId, p.teamName HAVING COUNT(DISTINCT c.id) = 1
    ) matches ON matches.tournamentId = t.tournamentId AND matches.teamName = t.teamName
    SET t.competitionId = matches.competitionId WHERE t.competitionId IS NULL`);
    statements.push(`INSERT INTO tournament_teams (tournamentId, competitionId, entrantId, teamName, teamType, teamSuffix)
      SELECT DISTINCT p.tournamentId, c.id, NULL, p.teamName, 'primary',
        CASE WHEN p.teamName NOT LIKE '%/%' AND p.teamName REGEXP ' [AB]$' THEN RIGHT(p.teamName, 1) ELSE NULL END
      FROM (${participantSql}) p JOIN tournament_competitions c ON c.tournamentId = p.tournamentId AND c.name = p.competition
      LEFT JOIN tournament_teams t ON t.competitionId = c.id AND t.teamName = p.teamName
      WHERE t.id IS NULL AND NULLIF(TRIM(p.teamName), '') IS NOT NULL AND p.teamName NOT LIKE '~%'
        AND UPPER(p.teamName) NOT IN ('PENDING', 'CONTESTED', 'BYE', 'TBD')`);
    console.log(
      `${args.has('--wet') ? 'Applying' : 'Previewing'} competition team allocations in ${environment}: ${statements.length} idempotent operations`
    );
    if (args.has('--wet')) {
      for (const sql of statements) await connection.query(sql);
      const [counts] = await connection.query(
        'SELECT COUNT(*) AS teams, SUM(competitionId IS NULL) AS unscopedLegacyTeams FROM tournament_teams'
      );
      console.log(JSON.stringify(counts[0]));
    } else console.log(statements.join(';\n'));
  } finally {
    await connection.query(
      "SELECT RELEASE_LOCK('competition-team-allocations')"
    );
    await connection.end();
  }
};
run().catch((error) => {
  console.error(error.code || error.message);
  process.exitCode = 1;
});
