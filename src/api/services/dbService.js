const { promisify } = require("util");
const { mysqlCurrentTime } = require("../../lib/utils");
const { calculateRankings, sqlGroupStandings } = require('../../lib/queries');
const winAward = 3;

module.exports = (db) => {
  const query = promisify(db.query).bind(db);
 
  async function processStageCompletion(fixtureId) {
    console.log(`Processing stage completion for grouo [${fixtureId}]`);
    const selQuery = `SELECT tournamentId, stage, groupNumber, category FROM fixtures WHERE id = ?`;
    const data = await query(selQuery, [fixtureId]);
    if (!data.length) return false;
    const { tournamentId, stage, groupNumber, category } = data[0];
    const completedQuery = `
      SELECT count(*) as remaining FROM fixtures WHERE 
        tournamentId = ? and 
        stage = ? and 
        groupNumber = ? and 
        category = ? and 
        goals1 is null
    `;
    const completedData = await query(completedQuery, [tournamentId, stage, groupNumber, category]);
    const remainingMatchesInStage = +completedData[0].remaining;
    if (!remainingMatchesInStage) {
      console.log(`Stage [${stage}] has been completed ... Updating calculated teams`);
      const qGroupStandings = `
         SELECT * FROM ${sqlGroupStandings(winAward)} WHERE 
         tournamentId = ? and 
         grp = ? and 
         category = ?
      `;
      const groupStandings = await query(qGroupStandings, [tournamentId, groupNumber, category]);
      let numPositions;
      if (stage === "group") {
          const qNumPositions = `
            SELECT count(*) as numPositions FROM v_fixture_information WHERE 
              tournamentId = ? and 
              stage = ? and 
              groupNumber = ? and 
              category = ?
          `;
          const numData = await query(qNumPositions, [tournamentId, stage, groupNumber, category]);
          numPositions = numData[0].numPositions || 0;
      } else {
          numPositions = 2;
      }
      const range = [...Array(numPositions).keys()];
      let totalUpdated = 0;
      for (const position of range) {
          const placeHolder = `~${stage}:${groupNumber}/p:${position + 1}`;
          const newValue = groupStandings[position]?.team;
          const updateFixture = async (t) => {
              const parts = placeHolder.split('&');
              let cat = category, ph = placeHolder;
              if (parts.length === 2) {
                  ph = parts[0];
                  cat = parts[1];
              }
              const sql = `
                UPDATE fixtures SET ${t}Id = ? 
                WHERE ${t}Planned = ? and tournamentId = ? and category = ?
              `;
               const res = await query(sql, [newValue, ph, tournamentId, cat]);
               return res.affectedRows || 0;
          };
          const team1Updated = await updateFixture("team1");
          const team2Updated = await updateFixture("team2");
          const umpireUpdated = await updateFixture("umpireTeam");
          totalUpdated += team1Updated + team2Updated + umpireUpdated;
      }
      console.log(`Stage [${stage}] has been completed for Group [${groupNumber}] in category [${category}]. Total fixtures updated: ${totalUpdated}.`);
      return true;
    }
    console.log(`Stage [${stage}/${groupNumber}] for [${category}] has [${remainingMatchesInStage}] remaining matches.`);
    return false;
  }

  async function processSameRankOnGroupCompletion(tournamentId, category) {
    console.log(`Processing same rank in category [${category}] for tournament [${tournamentId}]`);
    let q = `
        SELECT count(*) as count FROM fixtures 
        WHERE tournamentId = ? and 
          category = ? and started is null and ( 
          team1Id like '~rankgrp:%' or 
          team2Id like '~rankgrp:%' or 
          umpireTeamId like '~rankgrp:%'
        )
    `;
    const rankData = await query(q, [tournamentId, category]);
    const rankgrpRemaining = +(rankData[0].count) > 0;
    q = `
      SELECT count(*) as count FROM fixtures
      WHERE tournamentId = ? and 
        category = ? and stage = 'group' and
        goals1 is null
    `;
    const groupData = await query(q, [tournamentId, category]);
    const groupGamesFinished = +(groupData[0].count) === 0;
    if (rankgrpRemaining && groupGamesFinished) {
      const rankings = await calculateRankings(tournamentId, category, query);
      q = `
        SELECT distinct team1Id FROM (
          SELECT team1Id FROM fixtures WHERE tournamentId = ? and category = ? and team1Id like '~rankgrp:%'
          UNION
          SELECT team2Id FROM fixtures WHERE tournamentId = ? and category = ? and team2Id like '~rankgrp:%'
          UNION
          SELECT umpireTeamId FROM fixtures WHERE tournamentId = ? and category = ? and umpireTeamId like '~rankgrp:%'
        ) x
      `;
      const replaceData = await query(q, [tournamentId, category, tournamentId, category, tournamentId, category]);
      const replaceList = replaceData.map(x => x.team1Id);
      for (const r of replaceList) {
          const parts = r.split("/");
          const place = +parts[0].split(":").pop();
          const position = +parts[1].split(":").pop();
          const item = rankings.filter((x) => x.place === place)[position - 1];
          const updateQueryFn = async (t, placeHolder, team) => {
            const sql = `
                  UPDATE fixtures
                  SET ${t}Id = ?
                  WHERE ${t}Planned = ? and tournamentId = ? and category = ?
              `;
            return await query(sql, [team, placeHolder, tournamentId, category]);
          };
          const res1 = await updateQueryFn("team1", r, item.team);
          const res2 = await updateQueryFn("team2", r, item.team);
          const res3 = await updateQueryFn("umpireTeam", r, item.team);
          totalUpdated += (res1.affectedRows || 0) + (res2.affectedRows || 0) + (res3.affectedRows || 0);
      }
      console.log(`Same rank group update complete for category [${category}]. Total placeholders updated: ${totalUpdated}.`);
    }
    return { rankgrpRemaining, groupGamesFinished };
  }

  async function processAnyMatchDependentFixtures(teamInfo) {
    const { name, position, matchId, category, tournamentId } = teamInfo;
    const placeHolder = `~match:${matchId}/p:${position}`;
    const qAnyMatchWinner = (t) => {
        const parts = placeHolder.split('&');
        let cat = category, ph = placeHolder;
        if (parts.length === 2) {
            ph = parts[0];
            cat = parts[1];
        }
        return `
          UPDATE fixtures 
          SET ${t}Id = ?
          WHERE ${t}Planned = ? and tournamentId = ? and category = ?
        `;
    }
    const res1 = await query(qAnyMatchWinner("team1"), [name, placeHolder, tournamentId, category]);
    const res2 = await query(qAnyMatchWinner("team2"), [name, placeHolder, tournamentId, category]);
    const res3 = await query(qAnyMatchWinner("umpireTeam"), [name, placeHolder, tournamentId, category]);
    const totalUpdated = (res1.affectedRows || 0) + (res2.affectedRows || 0) + (res3.affectedRows || 0);
    console.log(`Updated match dependent fixtures for team [${name}] in match [${matchId}]. Total records updated: ${totalUpdated}.`);
  }

  return {
    // Tournament CRUD (New)
    createTournament: async ({ title, date, location, lat, lon, eventUuid}) => {
      const result = await query(
        `INSERT INTO tournaments (Title, Date, Location, Lat, Lon, eventUuid) VALUES (?, ?, ?, ?, ?, ?)`,
        [title, date, location, lat, lon, eventUuid]
      );
      return result.insertId;
    },

    getTournaments: async () => {
      console.log('geting tournaments')
      return await query(`SELECT Id, Date, Title, Location, eventUuid FROM tournaments`);
    },

    getTournament: async (id, uuid) => {
      let tournamentRows;
      if (uuid) {
        console.log(`Getting tournaments by uuid [${uuid}]`);
        tournamentRows = await query(`SELECT id, Date, Title, Location, eventUuid, code FROM tournaments WHERE eventUuid = ?`, [uuid]);
      } else {
        tournamentRows = await query(`SELECT id, Date, Title, Location, eventUuid, code FROM tournaments WHERE Id = ?`, [id]);
      }
      if (!tournamentRows) return null
      if (!tournamentRows?.length) return null;
      const tournament = tournamentRows.shift();
      const tId = id || tournament.id; // if we had to get the tournament from it's uuid, use this instead
      const q = `SELECT category, grp, team FROM ${sqlGroupStandings(winAward)} WHERE tournamentId = ?`
      const [groups, pitches] = await Promise.all([
        query(`SELECT category, grp, team FROM ${sqlGroupStandings(winAward)} WHERE tournamentId = ?`, [tId]),
        query(`SELECT id, pitch, location FROM pitches WHERE tournamentId = ?`, [tId]),
      ]);
      tournament.groups = groups;
      tournament.pitches = pitches;
      tournament.categories = [...new Set(groups.map(g => g.category))];
      return tournament;
    },

    updateTournament: async (id, { title, date, location, lat, lon }) => {
      await query(
        `UPDATE tournaments SET Title = ?, Date = ?, Location = ?, Lat = ?, Lon = ? WHERE id = ?`,
        [title, date, location, lat, lon, id]
      );
    },

    deleteTournament: async (id) => {
      await query(`DELETE FROM tournaments WHERE id = ?`, [id]);
    },

    resetTournament: async (id) => {
      await query(
        `UPDATE fixtures SET 
          started = NULL, 
          ended = NULL, 
          scheduled = scheduledPlanned, 
          pitch = pitchPlanned, 
          team1Id = team1Planned,
          team2Id = team2Planned,
          umpireTeamId = umpireTeamPlanned,
          goals1 = NULL, 
          points1 = NULL, 
          goals2 = NULL, 
          points2 = NULL, 
          outcome = 'not played' 
          WHERE tournamentId = ?
        `,
        [id]
      );
    },

    // Tournament Methods (Original + Updates)
    getTournamentGroups: async (id) => {
      return await query(`SELECT DISTINCT category FROM fixtures WHERE tournamentId = ?`, [id]);
    },

    getTournamentResults: async (id, category) => {
      return await query(
        `SELECT * FROM v_match_results WHERE tournamentId = ? AND category = ?`,
        [id, category]
      );
    },

    getTournamentCategories: async (id) => {
      const rows = await query(`SELECT * FROM v_categories WHERE tournamentId = ?`, [id]);
      return rows.map(row => ({
        ...row,
        brackets: row.brackets.split(",").map(x => x.trim())
      }));
    },

    getFixture: async (fixtureId) => {
      const query = `SELECT * FROM fixtures WHERE id = ${db.escape(fixtureId)}`;
      return new Promise((resolve, reject) => {
        db.query(query, (err, results) => {
          if (err) return reject(err);
          resolve(results[0]);
        });
      });
    },

    getStartedMatchCount: async (id) => {
      const result = await query(
        `SELECT COUNT(*) as count FROM v_fixture_information WHERE tournamentId = ? AND goals1 IS NOT NULL`,
        [id]
      );
      return result[0].count;
    },

    getRecentMatches: async (id) => {
      return await query(
        `SELECT id, DATE_FORMAT(DATE_ADD(started, INTERVAL 2 HOUR), '%H:%i') as start, pitch, 
          groupNumber as grp, stage, category as competition, team1, 
          CONCAT(goals1, '-', LPAD(points1, 2, '0'), ' (', LPAD(IF(goals1 IS NOT NULL AND points1 IS NOT NULL, goals1 * 3 + points1, 'N/A'), 2, '0'), ')') AS score1, 
                team2, CONCAT(goals2, '-', LPAD(points2, 2, '0'), ' (', LPAD(IF(goals2 IS NOT NULL AND points2 IS NOT NULL, goals2 * 3 + points2, 'N/A'), 2, '0'), ')') AS score2, umpireTeam 
         FROM v_fixture_information 
         WHERE tournamentId = ? AND started IS NOT NULL 
         ORDER BY started DESC 
         LIMIT 12`,
        [id]
      );
    },

    getGroupFixtures: async (id) => {
      return await query(
        `SELECT id, category, groupNumber AS g, pitch, scheduledTime, team1, goals1, points1, team2, goals2, points2, umpireTeam, 
                IF(started IS NULL, 'false', 'true') AS started 
         FROM v_fixture_information 
         WHERE tournamentId = ? AND stage = 'group' 
         ORDER BY category, scheduledTime`,
        [id]
      );
    },

    getGroupStandings: async (id) => {
      const groups = await query(
        `SELECT DISTINCT grp as gnum, category FROM ${sqlGroupStandings(winAward)} WHERE tournamentId = ?`,
        [id]
      );
      const standings = {};
      for (const { gnum, category } of groups) {
        const rows = await query(
          `SELECT category, grp, team, tournamentId, MatchesPlayed, Wins, Draws, Losses, PointsFrom, PointsDifference, TotalPoints 
           FROM ${sqlGroupStandings(winAward)} 
           WHERE tournamentId = ? AND category = ? AND grp LIKE ? 
           ORDER BY TotalPoints DESC, PointsDifference DESC, PointsFrom DESC`,
          [id, category, gnum]
        );
        standings[category] = standings[category] || {};
        standings[category][gnum] = rows;
      }
      return standings;
    },

    getKnockoutFixtures: async (id) => {
      return await query(
        `SELECT id, category, stage, pitch, scheduledTime, team1, goals1, points1, team2, goals2, points2, umpireTeam, outcome,
                IF(started IS NULL, 'false', 'true') AS started 
         FROM v_fixture_information 
         WHERE tournamentId = ? AND stage != 'group' 
         ORDER BY category, scheduledTime`,
        [id]
      );
    },

    getFinalsResults: async (id) => {
      return await query(
        `SELECT category, REPLACE(stage, '_finals', '') AS division, team1, goals1, points1, team2, goals2, points2, outcome,
                CASE WHEN (goals1 * 3 + points1) > (goals2 * 3 + points2) THEN team1 
                     WHEN (goals1 * 3 + points1) < (goals2 * 3 + points2) THEN team2 
                     ELSE 'Draw' END AS winner 
         FROM v_fixture_information 
         WHERE tournamentId = ? AND stage LIKE '%finals' 
         ORDER BY category`,
        [id]
      );
    },

    getAllMatches: async (id) => {
      return await query(
        `SELECT id, category, groupNumber AS grp, stage, pitch, scheduledTime, 
                team1, goals1, points1, team2, goals2, points2, umpireTeam as umpireTeam, 
                IF(started IS NULL, 'false', 'true') AS started 
         FROM v_fixture_information 
         WHERE tournamentId = ? 
         ORDER BY scheduledTime, id`,
        [id]
      );
    },

    // Squads CRUD (Updated from teams)
    createSquad: async (tournamentId, { teamName, groupLetter, category, teamSheetSubmitted, notes }) => {
      const result = await query(
        `INSERT INTO squads (teamName, groupLetter, category, teamSheetSubmitted, notes, tournamentId) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [teamName, groupLetter, category, teamSheetSubmitted || false, notes, tournamentId]
      );
      return result.insertId;
    },

    getSquads: async (tournamentId) => {
      return await query(`SELECT * FROM squads WHERE tournamentId = ?`, [tournamentId]);
    },

    getSquad: async (tournamentId, id) => {
      const rows = await query(`SELECT * FROM squads WHERE tournamentId = ? AND id = ?`, [tournamentId, id]);
      return rows[0] || null;
    },

    updateSquad: async (id, { teamName, groupLetter, category, teamSheetSubmitted, notes }) => {
      await query(
        `UPDATE squads SET teamName = ?, groupLetter = ?, category = ?, teamSheetSubmitted = ?, notes = ? WHERE id = ?`,
        [teamName, groupLetter, category, teamSheetSubmitted || false, notes, id]
      );
    },

    deleteSquad: async (id) => {
      await query(`DELETE FROM squads WHERE id = ?`, [id]);
    },

    // Players CRUD (New)
    createPlayer: async (squadId, { firstName, secondName, dateOfBirth, foirreannId }) => {
      const result = await query(
        `INSERT INTO players (firstName, secondName, dateOfBirth, foirreannId, teamId) 
         VALUES (?, ?, ?, ?, ?)`,
        [firstName, secondName, dateOfBirth, foirreannId, squadId]
      );
      return result.insertId;
    },

    getPlayers: async (squadId) => {
      return await query(`SELECT * FROM players WHERE teamId = ?`, [squadId]);
    },

    getPlayer: async (id) => {
      const rows = await query(`SELECT * FROM players WHERE id = ?`, [id]);
      return rows[0] || null;
    },

    updatePlayer: async (id, { firstName, secondName, dateOfBirth, foirreannId }) => {
      await query(
        `UPDATE players SET firstName = ?, secondName = ?, dateOfBirth = ?, foirreannId = ? WHERE id = ?`,
        [firstName, secondName, dateOfBirth, foirreannId, id]
      );
    },

    deletePlayer: async (id) => {
      await query(`DELETE FROM players WHERE id = ?`, [id]);
    },

    // Fixtures (Original + Schema Updates)
    getFixturesByPitch: async (tournamentId, pitch) => {
      let where = `WHERE tournamentId = ?`;
      if (pitch) where += ` AND pitch = ?`;
      return await query(`SELECT * FROM v_fixture_information ${where}`, pitch ? [tournamentId, pitch] : [tournamentId]);
    },

    getNextFixtures: async (tournamentId) => {
      const rows = (t) => `
        vfi.tournamentId,
        vfi.category, 
        vfi.pitch,
        vfi.scheduledTime, vfi.startedTime,
        vfi.groupNumber AS grp, vfi.team1, vfi.team2, vfi.umpireTeam, 
        vfi.goals1, vfi.points1, vfi.goals2, vfi.points2, 
        vfi.id AS matchId,
        '${t}' AS isType,
      `

      const q = `
        WITH RankedFixtures AS (
            SELECT ${rows('ranked')}
                ROW_NUMBER() OVER (
                    PARTITION BY vfi.category 
                    ORDER BY vfi.scheduledTime
                ) AS rn
            FROM (select * from v_fixture_information where tournamentId=${tournamentId}) vfi
            WHERE vfi.played = 0
        ),

        RecentPlayedFixtures AS (
            SELECT ${rows('recent')}
                ROW_NUMBER() OVER (
                    PARTITION BY vfi.category 
                    ORDER BY vfi.startedTime DESC
                ) AS rn
            FROM (select * from v_fixture_information where tournamentId=${tournamentId}) vfi
            WHERE vfi.played = 1
        )

        SELECT * FROM RankedFixtures WHERE rn <= 3
        UNION ALL
        SELECT * FROM RecentPlayedFixtures WHERE rn = 1

        ORDER BY scheduledTime, matchId;
      `
      return await query(q, [tournamentId]);
    },

    rewindLatestFixture: async (tournamentId) => {
      const latest = await query(
        `SELECT id, category, stage FROM fixtures WHERE tournamentId = ? AND started IS NOT NULL ORDER BY started DESC LIMIT 1`,
        [tournamentId]
      );
      if (!latest.length) return null;
      const { id } = latest[0];
      await query(
        `UPDATE fixtures SET goals1 = NULL, points1 = NULL, goals2 = NULL, points2 = NULL, started = NULL WHERE id = ?`,
        [id]
      );
      return latest[0];
    },

    startFixture: async (id) => {
      const mysqlTimestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
      return await query(
        `UPDATE fixtures SET started = ? WHERE id = ?`,
        [mysqlTimestamp, id]
      );
    },

    updateScore: async (id, team1, team2, tournamentId) => {
      console.log('Settings scrs ......', team1, team2)
      console.log(`Settings score for fixture [${id}], Team1 [${team1.name}] vs Team2 [${team2.name}] with scores ${team1.goals}-${team1.points} and ${team2.goals}-${team2.points}`);
      const t = mysqlCurrentTime();
      await query(
        `UPDATE fixtures SET goals1 = ?, points1 = ?, goals2 = ?, points2 = ?, ended = ? WHERE id = ?`,
        [team1.goals, team1.points, team2.goals, team2.points, t, id]
      );
      const team1Score = team1.goals * 3 + team1.points;
      const team2Score = team2.goals * 3 + team2.points;
      await processStageCompletion(id);
      await processSameRankOnGroupCompletion(tournamentId, team1.category);
      await processAnyMatchDependentFixtures({
        name: team1.name,
        category: team1.category,
        position: team1Score > team2Score ? 1 : 2,
        matchId: id,
        tournamentId,
      });
      await processAnyMatchDependentFixtures({
        name: team2.name,
        category: team2.category,
        position: team1Score > team2Score ? 2 : 1,
        matchId: id,
        tournamentId,
      });
    },

    cardPlayers: async (tournamentId, fixtureId, cards) => {
      const values = cards.map(c => 
        `(${tournamentId}, ${fixtureId}, ${c.playerId}, '${c.cardColor}')`
      ).join(",");
      return await query(
        `INSERT INTO cards (tournamentId, fixtureId, playerId, cardColor) VALUES ${values}`
      );
    },

    getCardedPlayers: async (tournamentId) => {
      return await query(
        `SELECT c.playerId, p.firstName, p.secondName, c.team, c.cardColor 
         FROM cards c 
         JOIN players p ON c.playerId = p.id 
         WHERE c.tournamentId = ? 
         ORDER BY c.team, p.firstName`,
        [tournamentId]
      );
    },

    getMatchesByPitch: async (tournamentId) => {
      return await query(
        `SELECT id, pitch, stage, scheduledTime, category, team1, goals1, points1, team2, goals2, points2, umpireTeam, 
                IF(started IS NULL, 'false', 'true') AS started 
         FROM v_fixture_information 
         WHERE tournamentId = ? 
         ORDER BY pitch, scheduledTime`,
        [tournamentId]
      );
    },

    // General (Original)
    listPitches: async (tournamentId) => {
      const pitchEvents = await query(
        `SELECT * FROM v_pitch_events WHERE tournamentId = ?`,
        [tournamentId]
      );
      if (pitchEvents.length) return pitchEvents;
      return await query(`SELECT * FROM pitches WHERE tournamentId = ?`, [tournamentId]);
    },

    listStandings: async (tournamentId, category) => {
      const extra = category ? ` AND category = ?` : "";
      const params = category ? [tournamentId, category] : [tournamentId];
      const [groups, standings] = await Promise.all([
        query(`SELECT DISTINCT category FROM ${sqlGroupStandings(winAward)} WHERE tournamentId = ? ${extra}`, params),
        query(`SELECT * FROM ${sqlGroupStandings(winAward)} WHERE tournamentId = ? ${extra}`, params)
      ]);
      return { groups: groups.map(g => g.category), data: standings };
    },

    // Regions (Original)
    listRegions: async () => {
      const rows = await query(
        `SELECT DISTINCT CASE WHEN subregion IS NOT NULL AND subregion <> '' 
         THEN CONCAT(region, '%', subregion) ELSE region END AS formatted_region 
         FROM clubs`
      );
      return rows.map(x => x.formatted_region);
    },

    listRegionInfo: async (region, { sex, sport, level }) => {
      const { region: reg, subregion } = splitRegion(region);
      let constraints = [`region = ?`];
      const params = [reg];
      if (subregion) {
        constraints.push(`subregion = ?`);
        params.push(subregion);
      }
      if (sex) constraints.push(sex === "male" ? `category IN ('gaa', 'hurling')` : `category IN ('lgfa', 'camogie')`);
      if (sport) {
        const sportMap = {
          hurling: `'hurling', 'camogie', 'youthhurling'`,
          football: `'gaa', 'lgfa', 'youthfootball'`,
          handball: `'handball'`,
          rounders: `'rounders'`,
        };
        if (sportMap[sport]) constraints.push(`category IN (${sportMap[sport]})`);
      }
      if (level) constraints.push(level === "youth" ? `category IN ('youthhurling', 'youthfootball')` : `category IN ('gaa', 'lgfa', 'hurling', 'camogie', 'handball', 'rounders')`);
      const rows = await query(
        `SELECT * FROM v_club_teams WHERE ${constraints.join(" AND ")}`,
        params
      );
      return { header: { count: rows.length, region: reg, subregion }, data: rows };
    },

    deleteFixtures: async (tournamentId) => {
      try {
        console.log('Deleting cards')
        await query(`DELETE FROM cards WHERE tournamentId = ?`, [tournamentId]);
        console.log('Deleting fixtures')
        const result = await query(
          `DELETE FROM fixtures WHERE tournamentId = ?`,
          [tournamentId]
        );
        return { affectedRows: result.affectedRows }; // Return count of deleted rows
      } catch (err) {
        throw new Error(`Failed to delete fixtures for tournament ${tournamentId}: ${err.message}`);
      }
    },

    // Delete all pitches for a tournament
    deletePitches: async (tournamentId) => {
      try {
        const result = await query(
          `DELETE FROM pitches WHERE tournamentId = ?`,
          [tournamentId]
        );
        return { affectedRows: result.affectedRows };
      } catch (err) {
        throw new Error(`Failed to delete pitches for tournament ${tournamentId}: ${err.message}`);
      }
    },

    // Delete all cards for a tournament
    deleteCards: async (tournamentId) => {
      console.log('this is failing ...')
      try {
        const result = await query(
          `DELETE FROM cards WHERE tournamentId = ?`,
          [tournamentId]
        );
        console.log('res', result)
        return { affectedRows: result.affectedRows };
      } catch (err) {
        throw new Error(`Failed to delete cards for tournament ${tournamentId}: ${err.message}`);
      }
    },

    // Create multiple pitches for a tournament
    createPitches: async (tournamentId, pitches) => {
      try {
        const values = pitches.map(pitch => [
          pitch.pitch,
          pitch.location,
          pitch.type,
          tournamentId
        ]);
        const result = await query(
          `INSERT INTO pitches (pitch, location, type, tournamentId) VALUES ?`,
          [values] // Bulk insert with array of arrays
        );
        const insertedPitches = pitches.map((pitch, index) => ({
          id: result.insertId + index, // Assuming auto-increment ID
          pitch: pitch.pitch,
          location: pitch.location,
          type: pitch.type,
          tournamentId
        }));
        return insertedPitches; // Return created pitch objects
      } catch (err) {
        throw new Error(`Failed to create pitches for tournament ${tournamentId}: ${err.message}`);
      }
    },

    // Create multiple fixtures for a tournament
    createFixtures: async (tournamentId, fixtures) => {
      console.log(JSON.stringify(fixtures[0], null, 2))
      try {
        const values = fixtures.map(fixture => {
          let schedTimestamp;
          try {
            schedTimestamp = new Date(fixture.scheduled).toISOString().slice(0, 19).replace("T", " ");
          } catch(e) {
            schedTimestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
          }
          return [
            fixture.id,
            fixture.tournamentId,
            fixture.category,
            fixture.groupNumber,
            fixture.stage,
            fixture.pitch, fixture.pitch,   // planned / actual
            schedTimestamp, schedTimestamp, // planned / actual
            fixture.started,
            fixture.team1Planned,
            fixture.team1Id,
            fixture.goals1,
            fixture.points1,
            fixture.team2Planned,
            fixture.team2Id,
            fixture.goals2,
            fixture.points2,
            fixture.umpireTeamPlanned,
            fixture.umpireTeamId,
            'not played'
          ]
        });
        const result = await query(
          `INSERT INTO fixtures (
              id, tournamentId, category, groupNumber, 
              stage, pitch, pitchPlanned, scheduled, scheduledPlanned, started, 
              team1Planned, team1Id, goals1, points1, 
              team2Planned, team2Id, goals2, points2, 
              umpireTeamPlanned, umpireTeamId, outcome) VALUES ?`,
          [values]
        );
        const insertedFixtures = fixtures.map((fixture, index) => ({
          ...fixture,
          id: fixture.id
        }));
        return insertedFixtures;
      } catch (err) {
        console.log(err)
        throw new Error(`Failed to create fixtures for tournament ${tournamentId}: ${err.message}`);
      }
    },

    reschedule: async ({ tournamentId, fixtureId, relativeFixtureId, placement = 'before' }) => {
      console.log('Now running reschedule...', { tournamentId, fixtureId, relativeFixtureId, placement });
      
      // Fetch the relative fixture's scheduled time and pitch
      const relQuery = "SELECT scheduled, pitch FROM fixtures WHERE id = ? AND tournamentId = ?";
      const relData = await query(relQuery, [relativeFixtureId, tournamentId]);
      if (!relData.length) {
        throw new Error(`Relative fixture ${relativeFixtureId} not found`);
      }
      const { scheduled, pitch } = relData[0];
      
      // Calculate new scheduled time: 5 minutes before or after the relative fixture
      const relDate = new Date(scheduled);
      if (placement === 'before') {
        relDate.setMinutes(relDate.getMinutes() - 5);
      } else if (placement === 'after') {
        relDate.setMinutes(relDate.getMinutes() + 5);
      } else {
        throw new Error(`Invalid placement value: ${placement}`);
      }
      const newScheduled = relDate.toISOString().slice(0, 19).replace("T", " ");
      
      // Update only the fixture being modified
      const updateQuery = "UPDATE fixtures SET scheduled = ?, pitch = ? WHERE id = ? AND tournamentId = ?";
      console.log('running', updateQuery)
      console.log*('values', newScheduled, pitch, fixtureId, tournamentId);
      await query(updateQuery, [newScheduled, pitch, fixtureId, tournamentId]);
      
      return { fixtureId, newScheduled, pitch };
    }
  }

};

function splitRegion(rIn) {
  const parts = rIn.split('%');
  return { region: parts[0], subregion: parts.length > 1 ? parts[1] : null };
}
