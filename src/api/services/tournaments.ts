import { v4 as uuidv4 } from 'uuid';
import { II, DD } from '../../lib/logging';
import dbHelper from '../../lib/db-helper';
import { buildReport } from './tournaments/builld-report/index.js';
import { sqlGroupStandings } from '../../lib/queries';
import TSVValidator from './fixtures/validate-tsv';
import { buildFixturesInsertSQL } from './tournaments/import-fixtures.js';
import {
  generateFixturesForCompetition,
} from './tournaments/generate-fixtures.js';

// Helper function to calculate lifecycle status
function calculateLifecycleStatus(dbStatus: string, startDateString: string, endDateString: string | null): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!startDateString) return 'unknown'; // Should have a start date

  const startDate = new Date(startDateString);
  startDate.setHours(0, 0, 0, 0);

  let endDate = null;
  if (endDateString) {
    endDate = new Date(endDateString);
    endDate.setHours(0, 0, 0, 0);
  }

  // Handle 'closed' status first
  if (dbStatus === 'closed') {
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    if (startDate < today && startDate >= threeMonthsAgo) return 'recent';
    if (startDate < threeMonthsAgo) return 'archive';
    return 'past'; // Default for closed if not recent or archive
  }

  // Handle 'new', 'published', 'in-design' (treat as pre-active states)
  if (
    dbStatus === 'new' ||
    dbStatus === 'published' ||
    dbStatus === 'in-design'
  ) {
    if (startDate >= today) return 'upcoming';
    // startDate is in the past
    if (!endDate || endDate >= today) return 'active'; // No end date or end date is in future/today
    return 'past'; // Has an end date in the past
  }

  // Handle 'started' status
  if (dbStatus === 'started') {
    if (!endDate || endDate >= today) return 'active'; // No end date or end date is in future/today
    // If endDate is past, it's over
  }

  // Handle 'on-hold' status
  if (dbStatus === 'on-hold') {
    if (startDate >= today) return 'upcoming';
    if (!endDate || endDate >= today) return 'active';
    // If endDate is past, it's over
  }

  // Fallback logic for any dbStatus not explicitly resulting in 'recent', 'archive', 'upcoming', or 'active' above.
  // Or for statuses like 'published', 'started', 'in-design', 'on-hold' where dates indicate they are finished.
  if (startDate < today && endDate && endDate < today) {
    // Tournament is definitively over (both start and end dates in the past)
    // and wasn't 'closed' (or it would have been handled).
    // This is a key case that previously might have been 'past'.
    return 'archive';
  }

  // General date-based fallbacks if not specifically categorized yet
  if (startDate >= today) return 'upcoming'; // If it's for the future, it's upcoming.
  if (startDate < today && (!endDate || endDate >= today)) return 'active'; // If started and ongoing, it's active.

  // Default for anything else (e.g. startDate is past, and no endDate, but didn't fit 'active' for its dbStatus)
  // This typically means it's an older item.
  return 'archive';
}

const createPitches = async (insert: (query: string, params: any[]) => Promise<any>, tournamentId: number, pitches: any[]) => {
  try {
    const values = pitches.map((pitch) => [
      pitch.pitch,
      pitch.location,
      pitch.type,
      tournamentId,
    ]);
    const result = await insert(
      `INSERT INTO pitches (pitch, location, type, tournamentId) VALUES ?`,
      [values]
    );
    const insertedPitches = pitches.map((pitch, index) => ({
      id: result.insertId + index, // Assuming auto-increment ID
      pitch: pitch.pitch,
      location: pitch.location,
      type: pitch.type,
      tournamentId,
    }));
    return insertedPitches; // Return created pitch objects
  } catch (err: any) {
    throw new Error(
      `Failed to create pitches for tournament ${tournamentId}: ${err.message}`
    );
  }
};

const deleteCards = async (dbDelete: (query: string, params: any[]) => Promise<any>, tournamentId: number) => {
  try {
    const result = await dbDelete(`DELETE FROM cards WHERE tournamentId = ?`, [
      tournamentId,
    ]);
    console.log('res', result);
    return { affectedRows: result.affectedRows };
  } catch (err: any) {
    throw new Error(
      `Failed to delete cards for tournament ${tournamentId}: ${err.message}`
    );
  }
};

const deleteFixtures = async (dbDelete: (query: string, params?: any[]) => Promise<any>, tournamentId: number) => {
  try {
    await dbDelete(`DELETE FROM cards WHERE tournamentId = ?`, [tournamentId]);
    const result = await dbDelete(
      `DELETE FROM fixtures WHERE tournamentId = ?`,
      [tournamentId]
    );
    return { affectedRows: result.affectedRows }; // Return count of deleted rows
  } catch (err: any) {
    throw new Error(
      `Failed to delete fixtures for tournament ${tournamentId}: ${err.message}`
    );
  }
};

const deletePitches = async (dbDelete: (query: string, params: any[]) => Promise<any>, tournamentId: number) => {
  try {
    console.log('deleting pitches from tournament ', tournamentId);
    const result = await dbDelete(
      `DELETE FROM pitches WHERE tournamentId = ?`,
      [tournamentId]
    );
    return { affectedRows: result.affectedRows };
  } catch (err: any) {
    throw new Error(
      `Failed to delete pitches for tournament ${tournamentId}: ${err.message}`
    );
  }
};


export default (db: any) => {
  const { select, insert, update, delete: dbDelete } = dbHelper(db);
  const winAward = 2;
  return {
    codeCheck: async (tournamentId: number, code: string, role: string) => {
      const roleCodeMap: { [key: string]: string } = {
        organizer: 'code',
        coordinator: 'codeCoordinator',
        referee: 'codeReferee',
        coach: 'codeTeam',
      };

      if (!roleCodeMap[role]) {
        throw new Error(`Invalid role: ${role}`);
      }

      const [row] = await select(
        `SELECT ${roleCodeMap[role]} AS roleCode FROM tournaments WHERE id = ?`,
        [tournamentId]
      );

      DD(
        `Checking code for role ${role} in tournament ${tournamentId}: expected ${row?.roleCode}, got ${code}`
      );
      if (
        !row ||
        (row.roleCode &&
          code &&
          row.roleCode.toLowerCase() !== code.toLowerCase())
      ) {
        throw new Error('Invalid code for the specified role.');
      }

      return true;
    },

    validateTsv: (tsvEncoded: string) =>
      new TSVValidator(tsvEncoded, { restGapMultiplier: 1 }).validate(),

    getTournamentReport: (tournamentId: number, category?: string) => {
      return {
        tournamentId,
        category,
        abc: '123',
      };
    },
    buildTournamentReport: async (tournamentId: number, category?: string) => {
      // Log to verify the category is being received
      DD(`Building report for tournament ${tournamentId}, category: ${category || 'all'}`);
      const res = await buildReport(tournamentId, select, category);
      return res;
    },
    // Create multiple fixtures for a tournament
    createFixtures: async (tournamentId: number, fixtureRows: any[]) => {
      DD(`Creating fixtures for tournament with id ${tournamentId}`);
      try {
        const pitches = fixtureRows.map((row) => {
          return {
            pitch: row.PITCH,
            location: null,
            type: 'grass',
            tournamentId,
          };
        });
        const sql = buildFixturesInsertSQL(
          fixtureRows,
          tournamentId,
          '2025-01-01'
        );
        await deleteCards(dbDelete, tournamentId);
        await deletePitches(dbDelete, tournamentId);
        await deleteFixtures(dbDelete, tournamentId);
        await createPitches(insert, tournamentId, pitches);
        await insert(sql, []);
        return {};
      } catch (err: any) {
        console.log(err);
        throw new Error(
          `Failed to create fixtures for tournament ${tournamentId}: ${err.message}`
        );
      }
    },

    // Create multiple pitches for a tournament
    createPitches: (pitches: any[], tournamentId: number) => createPitches(insert, tournamentId, pitches),

    // Players CRUD (New)
    createPlayer: async (
      squadId: number,
      { firstName, secondName, dateOfBirth, foirreannId }: { firstName: string, secondName: string, dateOfBirth: string, foirreannId: string }
    ) => {
      const result = await insert(
        `INSERT INTO players (firstName, secondName, dateOfBirth, foirreannId, teamId) 
         VALUES (?, ?, ?, ?, ?)`, 
        [firstName, secondName, dateOfBirth, foirreannId, squadId]
      );
      return result.insertId;
    },

    getPlayers: async (squadId: number) => {
      return await select(`SELECT * FROM players WHERE teamId = ?`, [squadId]);
    },

    getPlayer: async (id: number) => {
      const rows = await select(`SELECT * FROM players WHERE id = ?`, [id]);
      return rows[0] || null;
    },

    updatePlayer: async (
      id: number,
      { firstName, secondName, dateOfBirth, foirreannId }: { firstName: string, secondName: string, dateOfBirth: string, foirreannId: string }
    ) => {
      await update(
        `UPDATE players SET firstName = ?, secondName = ?, dateOfBirth = ?, foirreannId = ? WHERE id = ?`,
        [firstName, secondName, dateOfBirth, foirreannId, id]
      );
    },

    createTournament: async (
      userId: number,
      {
        region,
        title,
        date,
        location,
        lat,
        lon,
        codeOrganizer,
        winPoints = 3,
        drawPoints = 1,
        lossPoints = 0,
      }: { region: string, title: string, date: string, location: string, lat: number, lon: number, codeOrganizer: string, winPoints?: number, drawPoints?: number, lossPoints?: number }
    ) => {
      const eventUuid = uuidv4();
      await insert(
        `INSERT INTO tournaments (
           region, Title, Date, Location, Lat, Lon, eventUuid, code,
           pointsForWin, pointsForDraw, pointsForLoss
         ) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        [
          region,
          title,
          date,
          location,
          lat,
          lon,
          eventUuid,
          codeOrganizer,
          winPoints,
          drawPoints,
          lossPoints,
        ]
      );
      const [newTournament] = await select(
        `SELECT * FROM tournaments WHERE eventUuid = ?`,
        [eventUuid]
      );
      if (!newTournament) {
        throw new Error('Failed to retrieve the newly created tournament.');
      }
      const newTournamentId = newTournament.id;
      await insert(
        `INSERT INTO sec_roles (UserId, RoleName, tournamentId) VALUES (?, ?, ?)`, 
        [userId, 'organizer', newTournamentId]
      );
      return newTournament;
    },

    updateTournament: async (
      id: number,
      {
        region, title, date, 
        location, lat, lon, 
        codeOrganizer,
        winPoints = 3, drawPoints = 1, lossPoints = 0,
      }: 
      { 
        region: string, title: string, date: string, 
        location: string, lat: number, lon: number, 
        codeOrganizer: string, 
        winPoints?: number, drawPoints?: number, lossPoints?: number 
      }
    ) => {
      await update(
        `UPDATE tournaments 
         SET Region = ?, Title = ?, Date = ?, Location = ?, Lat = ?, Lon = ?, 
         code = ?, pointsForWin = ?, pointsForDraw = ?, pointsForLoss = ? 
         WHERE id = ?`, 
        [
          region,
          title,
          date,
          location,
          lat,
          lon,
          codeOrganizer,
          winPoints,
          drawPoints,
          lossPoints,
          id,
        ]
      );
      const [updatedTournament] = await select(
        `SELECT * FROM tournaments WHERE id = ?`,
        [id]
      );
      if (!updatedTournament) {
        throw new Error('Failed to retrieve the newly created tournament.');
      }
      return updatedTournament;
    },

    getTournaments: async (status: string, userId: number, role: string) => {
      DD(
        `Getting tournaments with status=[${status}], userId=[${userId}], role=[${role}]`
      );

      let cond = [];
      let params: (string | number)[] = [];

      if (status.toLowerCase() != 'all') {
        const statuses = status.split(',') || [];
        cond.push(`t.status IN (${statuses.map(() => '?').join(',')})`);
        params.push(...statuses);
      }

      if (userId && role) {
        cond.push(`sr.UserId = ? AND sr.RoleName = ?`);
        params.push(userId, role);
      }

      const whereClause = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

      const sql = `
        SELECT DISTINCT 
          t.Id, t.Date, t.endDate, t.Title, t.Location, t.region, t.season, t.eventUuid, t.status, t.code 
        FROM tournaments t
        ${userId && role ? 'JOIN sec_roles sr ON t.Id = sr.tournamentId' : ''}
        ${whereClause}
        ORDER BY t.Date DESC`;

      const tournaments = await select(sql, params);
      return tournaments.map((t: any) => {
        const lifecycleStatus = calculateLifecycleStatus(
          t.status,
          t.Date,
          t.endDate
        );
        return {
          ...t,
          Date: t.Date ? new Date(t.Date).toISOString().split('T')[0] : null,
          endDate: t.endDate
            ? new Date(t.endDate).toISOString().split('T')[0]
            : null,
          lifecycleStatus: lifecycleStatus,
        };
      });
    },

    // Squads CRUD (Updated from teams)
    createSquad: async (
      tournamentId: number,
      { teamName, groupLetter, category, teamSheetSubmitted, notes }: { teamName: string, groupLetter: string, category: string, teamSheetSubmitted: boolean, notes: string }
    ) => {
      const result = await insert(
        `INSERT INTO squads (teamName, groupLetter, category, teamSheetSubmitted, notes, tournamentId) 
         VALUES (?, ?, ?, ?, ?, ?)`, 
        [
          teamName,
          groupLetter,
          category,
          teamSheetSubmitted || false,
          notes,
          tournamentId,
        ]
      );
      return result.insertId;
    },

    deleteCards: (tournamentId: number) => deleteCards(dbDelete, tournamentId),
    deleteFixtures: (tournamentId: number) => deleteFixtures(dbDelete, tournamentId),
    deletePitches: (tournamentId: number) => deletePitches(dbDelete, tournamentId),

    deletePlayer: async (id: number) => {
      await dbDelete(`DELETE FROM players WHERE id = ?`, [id]);
    },

    deleteSquad: async (id: number) => {
      await dbDelete(`DELETE FROM squads WHERE id = ?`, [id]);
    },

    deleteTournament: async (id: number) => {
      await dbDelete(`DELETE FROM tournaments WHERE id = ?`, [id]);
    },

    generateFixtures: async (competition: any) => {
      // The logic is synchronous, but we wrap in async to be consistent with other service methods.
      return Promise.resolve(generateFixturesForCompetition(competition));
    },

    getAllMatches: async (id: number) => {
      return await select(
        `SELECT id, category, groupNumber AS grp, stage, pitch, scheduledTime, 
                team1, goals1, points1, team2, goals2, points2, umpireTeam as umpireTeam, 
                IF(started IS NULL, 'false', 'true') AS started 
         FROM v_fixture_information 
         WHERE tournamentId = ? 
         ORDER BY scheduledTime, id`,
        [id]
      );
    },

    getCardedPlayers: async (tournamentId: number) => {
      return await select(
        `SELECT c.playerId, p.firstName, p.secondName, c.team, c.cardColor 
         FROM cards c 
         JOIN players p ON c.playerId = p.id 
         WHERE c.tournamentId = ? 
         ORDER BY c.team, p.firstName`,
        [tournamentId]
      );
    },

    getFinalsResults: async (id: number) => {
      return await select(
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
    getGroupFixtures: async (id: number) => {
      return await select(
        `SELECT id, category, groupNumber AS g, pitch, scheduledTime, team1, goals1, points1, team2, goals2, points2, umpireTeam, 
                IF(started IS NULL, 'false', 'true') AS started 
         FROM v_fixture_information 
         WHERE tournamentId = ? AND stage = 'group' 
         ORDER BY category, scheduledTime`,
        [id]
      );
    },

    getGroupStandings: async (id: number) => {
      const groups = await select(
        `SELECT DISTINCT grp as gnum, category FROM ${sqlGroupStandings(winAward)} WHERE tournamentId = ?`,
        [id]
      );
      const standings: { [key: string]: { [key: string]: any[] } } = {};
      for (const { gnum, category } of groups) {
        const rows = await select(
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
    getKnockoutFixtures: async (id: number) => {
      return await select(
        `SELECT id, category, stage, pitch, scheduledTime, team1, goals1, points1, team2, goals2, points2, umpireTeam, outcome,
                IF(started IS NULL, 'false', 'true') AS started 
         FROM v_fixture_information 
         WHERE tournamentId = ? AND stage != 'group' 
         ORDER BY category, scheduledTime`,
        [id]
      );
    },
    getMatchesByPitch: async (tournamentId: number) => {
      return await select(
        `SELECT id, pitch, stage, scheduledTime, category, team1, goals1, points1, team2, goals2, points2, umpireTeam, 
                IF(started IS NULL, 'false', 'true') AS started 
         FROM v_fixture_information 
         WHERE tournamentId = ? 
         ORDER BY pitch, scheduledTime`,
        [tournamentId]
      );
    },

    resetTournament: async (id: number) => {
      await update(
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
         WHERE tournamentId = ?`,
        [id]
      );
    },

    getRecentMatches: async (tournamentId: number) => {
      return await select(
        `SELECT id, DATE_FORMAT(DATE_ADD(started, INTERVAL 2 HOUR), '%H:%i') as start, pitch, 
          groupNumber as grp, stage, category as competition, team1, 
          CONCAT(goals1, '-', LPAD(points1, 2, '0'), ' (', LPAD(IF(goals1 IS NOT NULL AND points1 IS NOT NULL, goals1 * 3 + points1, 'N/A'), 2, '0'), ')') AS score1, 
          team2, CONCAT(goals2, '-', LPAD(points2, 2, '0'), ' (', LPAD(IF(goals2 IS NOT NULL AND points2 IS NOT NULL, goals2 * 3 + points2, 'N/A'), 2, '0'), ')') AS score2, umpireTeam 
         FROM v_fixture_information 
         WHERE tournamentId = ? AND started IS NOT NULL 
         ORDER BY started DESC 
         LIMIT 12`,
        [tournamentId]
      );
    },

    getStartedMatchCount: async (tournamentId: number) => {
      const [result] = await select(
        `SELECT COUNT(*) as count 
         FROM v_fixture_information 
         WHERE tournamentId = ? AND goals1 IS NOT NULL`,
        [tournamentId]
      );
      return result.count;
    },

    getSquad: async (tournamentId: number, id: number) => {
      const rows = await select(
        `SELECT * FROM squads WHERE tournamentId = ? AND id = ?`,
        [tournamentId, id]
      );
      return rows[0] || null;
    },

    getSquads: async (tournamentId: number) => {
      return await select(`SELECT * FROM squads WHERE tournamentId = ?`, [
        tournamentId,
      ]);
    },
    getTournamentOverview: async (tournamentId: number) => {
      // Get all fixtures for the tournament
      const fixtures = await select(
        `SELECT * FROM fixtures WHERE tournamentId = ? ORDER BY scheduled`,
        [tournamentId]
      );
      
      // Get tournament details
      const [tournament] = await select(
        `SELECT * FROM tournaments WHERE id = ?`,
        [tournamentId]
      );
      
      if (!tournament) {
        throw new Error('Tournament not found');
      }
      
      const stages: any = {};
      const catTeams = new Map();
      
      // Process each fixture to build the overview
      for (const fixture of fixtures) {
        const category = fixture.category?.toUpperCase() || '';
        const stage = fixture.stage?.toUpperCase() || '';
        // Get the last 2 digits of the match ID
        const matchNumber = fixture.id % 100;
        const matchId = `M.${matchNumber.toString().padStart(2, '0')}`;
        const team1 = fixture.team1Id || '';
        const team2 = fixture.team2Id || '';
        const umpires = fixture.umpireTeamId || '';
        
        // Initialize category if not present
        if (!stages[category]) {
          stages[category] = {
            'Group Stage': {},
            'Knockout Stage': {},
          };
        }
        
        // Process stage - check if it's a group stage (starts with 'GP' or 'GROUP')
        // Handle different possible stage formats
        let isGroupStage = false;
        let groupNum = '';
        
        if (stage.startsWith('GP.')) {
          isGroupStage = true;
          groupNum = stage.split('.')[1];
        } else if (stage.startsWith('GROUP')) {
          isGroupStage = true;
          // Handle 'GROUP X' format
          const groupMatch = /GROUP\s*(\d+)/i.exec(stage);
          if (groupMatch) {
            groupNum = groupMatch[1];
          }
        }
        
        if (isGroupStage && groupNum) {
          const groupName = `Gp.${groupNum}`;
          const groupStage = stages[category]['Group Stage'];
          
          if (!groupStage[groupName]) {
            groupStage[groupName] = {
              size: 0,
              matchesCount: 0,
              matches: [],
            };
          }
          
          // Add match to group as an object
          const matchObj = {
            id: matchId,
            team1,
            team2,
            umpires
          };
          
          groupStage[groupName].matches.push(matchObj);
          groupStage[groupName].matchesCount++;
          
          // Track teams for size calculation
          if (!catTeams.has(category)) {
            catTeams.set(category, new Map());
          }
          const categoryTeams = catTeams.get(category);
          if (categoryTeams) {
            const groupNumInt = parseInt(groupNum, 10);
            if (!categoryTeams.has(groupNumInt)) {
              categoryTeams.set(groupNumInt, new Set());
            }
            const groupTeams = categoryTeams.get(groupNumInt);
            if (groupTeams) {
              if (team1) groupTeams.add(team1.toUpperCase());
              if (team2) groupTeams.add(team2.toUpperCase());
            }
          }
        } else {
          // Knockout stage
          // Split stage into bracket and code
          const stageParts = stage.split('.');
          if (stageParts.length >= 2) {
            const bracket = stageParts[0];
            const stageCode = stageParts[1];
            const knockoutStage = stages[category]['Knockout Stage'];
            
            if (!knockoutStage[bracket]) {
              knockoutStage[bracket] = {
                matches: [],
              };
            }
            
            // Add match to knockout stage as an object
            const matchObj = {
              id: matchId,
              stage: stageCode,
              team1,
              team2,
              umpires
            };
            
            knockoutStage[bracket].matches.push(matchObj);
          } else {
            // Handle cases where stage doesn't split into two parts
            // Add to a default bracket
            const knockoutStage = stages[category]['Knockout Stage'];
            const bracket = 'DEFAULT';
            
            if (!knockoutStage[bracket]) {
              knockoutStage[bracket] = {
                matches: [],
              };
            }
            
            const matchObj = {
              id: matchId,
              stage: stage,
              team1,
              team2,
              umpires
            };
            
            knockoutStage[bracket].matches.push(matchObj);
          }
        }
      }
      
      // Calculate sizes for groups
      for (const category in stages) {
        const groupStage = stages[category]['Group Stage'];
        for (const groupName in groupStage) {
          const groupNum = parseInt(groupName.split('.')[1], 10);
          const teams = catTeams.get(category)?.get(groupNum) || new Set();
          groupStage[groupName].size = teams.size;
        }
      }
      
      return stages;
    },

    getTournament: async (id: number, uuid: string) => {
      let tournamentRows;
      const baseQueryFields = `id, Date, endDate, Title, Location, region, season, eventUuid, status, code, Lat, Lon`;
      if (uuid) {
        DD(`Getting tournament by uuid [${uuid}]`);
        tournamentRows = await select(
          `SELECT ${baseQueryFields} FROM tournaments WHERE eventUuid = ?`,
          [uuid]
        );
      } else {
        tournamentRows = await select(
          `SELECT ${baseQueryFields} FROM tournaments WHERE Id = ?`,
          [id]
        );
      }
      if (!tournamentRows || tournamentRows.length === 0) return null;

      const tournamentData = tournamentRows.shift();

      const lifecycleStatus = calculateLifecycleStatus(
        tournamentData.status,
        tournamentData.Date,
        tournamentData.endDate
      );

      const tId = tournamentData.id;
      const [groups, pitchesData] = await Promise.all([
        select(
          `SELECT category, grp, team FROM ${sqlGroupStandings(winAward)} WHERE tournamentId = ?`,
          [tId]
        ),
        select(
          `SELECT id, pitch, location FROM pitches WHERE tournamentId = ?`,
          [tId]
        ),
      ]);

      return {
        ...tournamentData,
        Date: tournamentData.Date
          ? new Date(tournamentData.Date).toISOString().split('T')[0]
          : null,
        endDate: tournamentData.endDate
          ? new Date(tournamentData.endDate).toISOString().split('T')[0]
          : null,
        lifecycleStatus: lifecycleStatus,
        groups: groups,
        pitches: pitchesData,
        categories: [...new Set(groups.map((g: any) => g.category))],
      };
    },

    getTournamentCategories: async (id: number) => {
      const rows = await select(
        `SELECT * FROM v_categories WHERE tournamentId = ?`,
        [id]
      );
      return rows.map((row: any) => ({
        ...row,
        brackets: row.brackets.split(',').map((x: string) => x.trim()),
      }));
    },

    getTournamentsByStatus: async (requestedStatusString: string, userId: number, region: string) => {
      const requestedStatuses = requestedStatusString
        ? requestedStatusString.split(',')
        : [];
      if (requestedStatuses.length === 0 && !region) {
        // if no status and no region, return empty
        return [];
      }

      const sqlParams: (string | number)[] = [];
      const sqlFilterConditions: string[] = [];

      requestedStatuses.forEach((status) => {
        switch (status.toLowerCase()) {
          case 'upcoming':
            sqlFilterConditions.push(
              `((t.status = 'new' OR t.status = 'published') AND t.Date >= CURDATE())`
            );
            break;
          case 'active':
            sqlFilterConditions.push(`(
              (t.status = 'new' AND t.Date < CURDATE()) OR
              ( (t.status = 'published' OR t.status = 'started') AND
                t.Date <= CURDATE() AND (t.endDate IS NULL OR t.endDate >= CURDATE()) )
            )`);
            break;
          case 'past':
            sqlFilterConditions.push(
              `(t.status = 'closed' OR (t.status = 'published' AND t.endDate IS NOT NULL AND t.endDate < CURDATE()))`
            );
            break;
          case 'recent':
            sqlFilterConditions.push(
              `(t.status = 'closed' AND t.Date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) AND t.Date < CURDATE())`
            );
            break;
          case 'archive':
            sqlFilterConditions.push(
              `(t.status = 'closed' AND t.Date < DATE_SUB(CURDATE(), INTERVAL 3 MONTH))`
            );
            break;
          default:
            console.log(`Unknown status request to fn:getTournamentsByStatus: ${status}`)
        }
      });

      // If only region is provided, sqlFilterConditions might be empty, which is fine.
      // The WHERE clause will be constructed based on what's available.

      let userAssociatedField = '';
      if (userId) {
        userAssociatedField =
          ', (EXISTS(SELECT 1 FROM sec_roles sr WHERE sr.UserId = ? AND sr.tournamentId = t.id)) AS user_associated_flag';
        sqlParams.push(userId);
      }

      const query = `
        SELECT
            t.id, t.Title, t.region, t.Location, t.Date, t.endDate, t.status AS db_status,
            t.season, t.sport AS db_sport, t.eventUuid, t.Lat, t.Lon
            ${userAssociatedField}
        FROM tournaments t
        WHERE 
      `;

      const whereClauses = [];
      if (sqlFilterConditions.length > 0) {
        whereClauses.push(`(${sqlFilterConditions.join(' OR ')})`);
      }

      if (region) {
        whereClauses.push(`LOWER(t.region) = LOWER(?)`);
        sqlParams.push(region);
      }

      if (whereClauses.length === 0) {
        // This case should ideally not be hit if we check for empty statuses and no region earlier,
        // but as a safeguard, prevent querying without any WHERE conditions if not intended.
        // However, if the intent is to allow fetching all tournaments if no status/region is given,
        // this block might need adjustment. For now, assuming at least one filter is desired.
        // Given the initial check, this means if region is provided, it will be the sole filter.
        // If neither status nor region, we return [] early.
        // If only status, that's the filter.
        // If both, they are ANDed.
        if (requestedStatuses.length === 0 && !region) return []; // Should have been caught earlier
      }

      const finalQuery =
        query + whereClauses.join(' AND ') + ` ORDER BY t.Date DESC`;

      const dbRows = await select(finalQuery, sqlParams);

      return dbRows.map((row: any) => {
        const lifecycleStatus = calculateLifecycleStatus(
          row.db_status,
          row.Date,
          row.endDate
        );

        let sportMapped;
        if (row.db_sport === 'Gaelic Football') sportMapped = 'gaelic-football';
        else if (row.db_sport === 'Hurling') sportMapped = 'hurling'; // Assuming 'Hurling' is how it's stored

        return {
          id: String(row.id),
          title: row.Title,
          region: row.region,
          location: row.Location,
          startDate: row.Date
            ? new Date(row.Date).toISOString().split('T')[0]
            : null,
          endDate: row.endDate
            ? new Date(row.endDate).toISOString().split('T')[0]
            : null,
          status: row.db_status, // Original database status
          lifecycleStatus: lifecycleStatus, // Calculated lifecycle status from helper
          season: row.season ? String(row.season) : null,
          sport: sportMapped,
          uuid: row.eventUuid,
          description: undefined, // Not in DB table
          isUserAssociated: userId ? Boolean(row.user_associated_flag) : null,
          latitude: row.Lat,
          longitude: row.Lon,
        };
      });
    },

    getTournamentsSummary: async () => {
      const query = `
        SELECT
            t.region,
            SUM(CASE
                WHEN (t.status = 'new' AND t.Date < CURDATE()) OR
                     ( (t.status = 'published' OR t.status = 'started') AND
                       t.Date <= CURDATE() AND (t.endDate IS NULL OR t.endDate >= CURDATE()) )
                THEN 1 ELSE 0 END
            ) AS active_count,
            SUM(CASE
                WHEN (t.status = 'new' OR t.status = 'published') AND t.Date >= CURDATE()
                THEN 1 ELSE 0 END
            ) AS upcoming_count,
            SUM(CASE
                WHEN t.status = 'closed' AND t.Date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH) AND t.Date < CURDATE()
                THEN 1 ELSE 0 END
            ) AS recent_count,
            SUM(CASE
                WHEN t.status = 'closed' AND t.Date < DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
                THEN 1 ELSE 0 END
            ) AS archive_count
        FROM tournaments t
        WHERE t.region IS NOT NULL AND t.region != ''
        GROUP BY t.region
        ORDER BY t.region;
      `;
      const dbRows = await select(query, []);
      return dbRows.map((row: any) => ({
        region: row.region,
        active: parseInt(row.active_count, 10),
        upcoming: parseInt(row.upcoming_count, 10),
        recent: parseInt(row.recent_count, 10),
        archive: parseInt(row.archive_count, 10),
      }));
    },

    getFilters: async (tournamentId: number, queryRole: string, queryCategory: string) => {
      II(
        `Fetching filters for tournament [${tournamentId}], role [${queryRole}], category [${queryCategory || 'N/A'}]`
      );

      // 1. Fetch Competition choices
      const compChoicesData = await select(
        'SELECT DISTINCT(category) AS choice FROM fixtures WHERE tournamentId=? ORDER BY choice',
        [tournamentId]
      );
      const competitionChoices = compChoicesData.map((r: any) => r.choice);

      // 2. Fetch Pitch choices
      const pitchChoicesData = await select(
        "SELECT DISTINCT(pitchPlanned) AS choice FROM fixtures WHERE tournamentId=? AND pitchPlanned IS NOT NULL AND TRIM(pitchPlanned) != '' ORDER BY choice",
        [tournamentId]
      );
      const pitchChoices = pitchChoicesData.map((r: any) => r.choice);

      // 3. Fetch Team choices (only if queryCategory is provided)
      let teamChoices: string[] = [];
      if (queryCategory) {
        const teamSQL = `
          SELECT team_name AS choice FROM (
              SELECT DISTINCT f.team1Planned AS team_name
              FROM fixtures f
              WHERE f.tournamentId = ? AND f.category = ? AND f.stage = 'group'
                AND f.team1Planned IS NOT NULL AND TRIM(f.team1Planned) <> '' AND f.team1Planned NOT LIKE '~%'
              UNION
              SELECT DISTINCT f.team2Planned AS team_name
              FROM fixtures f
              WHERE f.tournamentId = ? AND f.category = ? AND f.stage = 'group'
                AND f.team2Planned IS NOT NULL AND TRIM(f.team2Planned) <> '' AND f.team2Planned NOT LIKE '~%'
          ) AS combined_teams
          WHERE team_name IS NOT NULL AND TRIM(team_name) <> ''
          ORDER BY choice;
        `;
        const teamParams = [
          tournamentId,
          queryCategory,
          tournamentId,
          queryCategory,
        ];
        const teamChoicesData = await select(teamSQL, teamParams);
        teamChoices = teamChoicesData.map((r: any) => r.choice);
      }

      // 4. Referee choices (TODO: Define source for referee choices from DB)
      const refereeChoices: string[] = [];

      const allFilterDefinitions = {
        competition: {
          icon: 'CompIcon',
          category: 'Competition',
          choices: competitionChoices,
          allowMultiselect: true,
          selected: null,
          default: competitionChoices.length > 0 ? competitionChoices[0] : null,
        },
        pitches: {
          icon: 'PitchIcon',
          category: 'Pitches',
          choices: pitchChoices,
          selected: [],
          allowMultiselect: true,
          default: null,
        },
        teams: {
          icon: 'TeamIcon',
          category: 'Teams',
          choices: teamChoices,
          selected: [],
          allowMultiselect: true,
          default: null,
        },
        referee: {
          icon: 'RefIcon',
          category: 'Referee',
          choices: refereeChoices,
          selected: null,
          allowMultiselect: false,
          default: null,
        },
      };

      const roleFilterKeysMap: { [key: string]: string[] } = {
        organizer: ['competition', 'pitches', 'referee'],
        referee: ['competition', 'pitches', 'referee'],
        coach: ['competition', 'teams'],
        coordinator: ['pitches'],
      };

      const roleFilterKeys = roleFilterKeysMap[queryRole];

      if (!roleFilterKeys) {
        II(`Unknown role [${queryRole}] for filters, returning empty array.`);
        return [];
      }

      return roleFilterKeys.map((key) => allFilterDefinitions[key as keyof typeof allFilterDefinitions]);
    },

    updateSquad: async (
      id: number,
      { teamName, groupLetter, category, teamSheetSubmitted, notes }: { teamName: string, groupLetter: string, category: string, teamSheetSubmitted: boolean, notes: string }
    ) => {
      await update(
        `UPDATE squads SET teamName = ?, groupLetter = ?, category = ?, teamSheetSubmitted = ?, notes = ? WHERE id = ?`,
        [
          teamName,
          groupLetter,
          category,
          teamSheetSubmitted || false,
          notes,
          id,
        ]
      );
    },
  };
};
