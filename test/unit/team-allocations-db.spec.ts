import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2';
import dotenv from 'dotenv';
import dbHelper from '../../src/lib/db-helper';
import allocationsFactory from '../../src/api/services/team-allocations';

test(
  'development DB: separate competitions, A/B squads, lead changes, and rejected saves are atomic',
  { skip: process.env.PP_ALLOCATION_DB_TEST !== '1' },
  async () => {
    dotenv.config({ quiet: true });
    dotenv.config({ path: '.env.local', override: true, quiet: true });
    dotenv.config({ path: '.kamal/secrets.dev', override: true, quiet: true });
    const pool = mysql.createPool({
      host: process.env.PP_HOSTNAME_DB_DEV || process.env.PP_HST,
      user: process.env.PP_USR_DEV || process.env.PP_USR,
      password: process.env.PP_PWD,
      database: process.env.PP_DATABASE || 'EuroTourno',
    });
    const db = dbHelper(pool);
    const service = allocationsFactory(pool);
    let tournamentId: number, seriesId: number;
    const championships: number[] = [];
    try {
      tournamentId = await db.insert(
        "INSERT INTO tournaments (Title, Date, code) VALUES ('Allocation integration test', '2026-10-08', 'ORG1')"
      );
      seriesId = await db.insert(
        "INSERT INTO series (name) VALUES ('Allocation integration test')"
      );
      for (const name of ['Hurling', 'Camogie'])
        championships.push(
          await db.insert(
            'INSERT INTO championships (seriesId, name, year, numRounds) VALUES (?, ?, 2026, 4)',
            [seriesId, name]
          )
        );
      const competitionIds: number[] = [];
      for (const name of ['HURLING', 'CAMOGIE'])
        competitionIds.push(
          await db.insert(
            'INSERT INTO tournament_competitions (tournamentId, name) VALUES (?, ?)',
            [tournamentId, name]
          )
        );
      const entrantIds: number[] = [];
      for (const name of ['Dublin', 'Wexford', 'Wicklow'])
        entrantIds.push(
          await db.insert(
            "INSERT INTO championship_entrants (championshipId, entrantType, displayName) VALUES (?, 'amalgamation', ?)",
            [championships[0], name]
          )
        );
      const otherEntrant = await db.insert(
        "INSERT INTO championship_entrants (championshipId, entrantType, displayName) VALUES (?, 'amalgamation', 'Other championship')",
        [championships[1]]
      );
      const teamA = await db.insert(
        "INSERT INTO tournament_teams (tournamentId, competitionId, teamName, teamType) VALUES (?, ?, 'Fixture team A', 'primary')",
        [tournamentId, competitionIds[0]]
      );
      const teamB = await db.insert(
        "INSERT INTO tournament_teams (tournamentId, competitionId, teamName, teamType) VALUES (?, ?, 'Fixture team B', 'secondary')",
        [tournamentId, competitionIds[0]]
      );
      await assert.rejects(
        service.save(tournamentId, teamA, {
          allocations: [{ entrantId: entrantIds[0], numPlayers: 8 }],
        }),
        /Link this competition/
      );
      await service.assignRound(tournamentId, competitionIds[0], {
        championshipId: championships[0],
        roundNumber: 1,
      });
      await service.assignRound(tournamentId, competitionIds[1], {
        championshipId: championships[1],
        roundNumber: 2,
      });
      await service.save(tournamentId, teamA, {
        suffix: 'A',
        allocations: entrantIds.map((entrantId, index) => ({
          entrantId,
          numPlayers: [8, 5, 2][index],
        })),
      });
      await service.save(tournamentId, teamB, {
        suffix: 'B',
        allocations: [{ entrantId: entrantIds[0], numPlayers: 7 }],
      });
      const read = () => service.list(tournamentId);
      const result = await read();
      const competition = result.competitions.find(
        (row) => row.id === competitionIds[0]
      );
      assert.equal(
        competition.teams[0].displayName,
        'Dublin / Wexford / Wicklow A'
      );
      assert.equal(competition.teams[0].totalPlayers, 15);
      assert.equal(competition.teams[1].displayName, 'Dublin B');
      assert.equal(
        result.competitions.find((row) => row.id === competitionIds[1])
          .entrants[0].id,
        otherEntrant
      );
      await assert.rejects(
        service.save(tournamentId, teamA, {
          allocations: [{ entrantId: otherEntrant, numPlayers: 8 }],
        }),
        /this championship/
      );
      await assert.rejects(
        service.save(tournamentId + 1, teamA, { allocations: [] }),
        /Team not found/
      );
      assert.deepEqual(await read(), result);
      await assert.rejects(
        service.assignRound(tournamentId, competitionIds[0], {
          championshipId: championships[1],
          roundNumber: 1,
        }),
        /Clear team allocations/
      );
      await service.save(tournamentId, teamA, {
        allocations: [
          { entrantId: entrantIds[0], numPlayers: 5 },
          { entrantId: entrantIds[1], numPlayers: 8 },
        ],
      });
      const [parent] = await db.select(
        'SELECT entrantId, squadSizeSubmitted, teamName FROM tournament_teams WHERE id = ?',
        [teamA]
      );
      assert.equal(parent.entrantId, entrantIds[1]);
      assert.equal(parent.squadSizeSubmitted, null);
      assert.equal(parent.teamName, 'Fixture team A');
      await service.save(tournamentId, teamA, { allocations: [] });
      const [cleared] = await db.select(
        'SELECT entrantId, squadSizeSubmitted FROM tournament_teams WHERE id = ?',
        [teamA]
      );
      assert.equal(cleared.entrantId, null);
      assert.equal(cleared.squadSizeSubmitted, null);
    } finally {
      if (tournamentId)
        await db.delete('DELETE FROM tournament_teams WHERE tournamentId = ?', [
          tournamentId,
        ]);
      if (tournamentId)
        await db.delete('DELETE FROM tournaments WHERE id = ?', [tournamentId]);
      for (const id of championships)
        await db.delete('DELETE FROM championships WHERE id = ?', [id]);
      if (seriesId)
        await db.delete('DELETE FROM series WHERE id = ?', [seriesId]);
      await new Promise<void>((resolve, reject) =>
        pool.end((err) => (err ? reject(err) : resolve()))
      );
    }
  }
);
