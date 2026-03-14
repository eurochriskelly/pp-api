import dbHelper = require('../../lib/db-helper');

type TeamType = 'primary' | 'secondary' | 'combination';

interface TournamentTeam {
  id: number;
  tournamentId: number;
  entrantId: number;
  teamName: string;
  teamType: TeamType;
  squadSizeSubmitted?: number | null;
  createdAt?: string;
  linkedSquadId?: number | null;
  linkedPlayerCount?: number;
}

interface DbConnection {
  query: (
    sql: string,
    values: unknown[],
    callback: (err: Error | null, results: unknown) => void
  ) => void;
}

function tournamentTeamsService(db: DbConnection) {
  const { select, insert, update, delete: dbDelete } = dbHelper(db as any);

  const linkNote = (teamId: number) => `linked:tournament_team:${teamId}`;

  const findLinkedSquad = async (tournamentId: number, teamId: number) => {
    const rows = await select(
      `SELECT id
       FROM squads
       WHERE tournamentId = ? AND notes = ?
       ORDER BY id ASC
       LIMIT 1`,
      [tournamentId, linkNote(teamId)]
    );
    return rows[0]?.id ? Number(rows[0].id) : null;
  };

  const getTeamById = async (tournamentId: number, teamId: number) => {
    const rows = (await select(
      `SELECT id, tournamentId, entrantId, teamName, teamType,
              squadSizeSubmitted, createdAt
       FROM tournament_teams
       WHERE tournamentId = ? AND id = ?`,
      [tournamentId, teamId]
    )) as unknown as TournamentTeam[];

    const row = rows[0] || null;
    if (!row) return null;

    const linkedSquadId = await findLinkedSquad(tournamentId, teamId);
    let linkedPlayerCount = 0;
    if (linkedSquadId) {
      const countRows = await select(
        `SELECT COUNT(*) AS count FROM players WHERE teamId = ?`,
        [linkedSquadId]
      );
      linkedPlayerCount = Number(countRows[0]?.count || 0);
    }

    return {
      ...row,
      linkedSquadId,
      linkedPlayerCount,
    } as TournamentTeam;
  };

  const findOrCreateLinkedSquad = async (team: TournamentTeam) => {
    let squadId = await findLinkedSquad(team.tournamentId, team.id);
    if (squadId) return squadId;

    squadId = await insert(
      `INSERT INTO squads (teamName, teamSheetSubmitted, notes, groupLetter, category, tournamentId)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [team.teamName, true, linkNote(team.id), null, null, team.tournamentId]
    );

    return squadId;
  };

  return {
    listTeams: async (tournamentId: number) => {
      const rows = (await select(
        `SELECT id, tournamentId, entrantId, teamName, teamType,
                squadSizeSubmitted, createdAt
         FROM tournament_teams
         WHERE tournamentId = ?
         ORDER BY id ASC`,
        [tournamentId]
      )) as unknown as TournamentTeam[];

      const withCounts: TournamentTeam[] = [];
      for (const row of rows) {
        const linkedSquadId = await findLinkedSquad(tournamentId, row.id);
        let linkedPlayerCount = 0;
        if (linkedSquadId) {
          const countRows = await select(
            `SELECT COUNT(*) AS count FROM players WHERE teamId = ?`,
            [linkedSquadId]
          );
          linkedPlayerCount = Number(countRows[0]?.count || 0);
        }

        withCounts.push({
          ...row,
          linkedSquadId,
          linkedPlayerCount,
        });
      }

      return withCounts;
    },

    getTeamById: async (tournamentId: number, teamId: number) => {
      return getTeamById(tournamentId, teamId);
    },

    createTeam: async (
      tournamentId: number,
      data: {
        entrantId: number;
        teamName?: string;
        teamType?: TeamType;
        squadSizeSubmitted?: number;
      }
    ) => {
      const id = await insert(
        `INSERT INTO tournament_teams (
          tournamentId, entrantId, teamName, teamType, squadSizeSubmitted
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          tournamentId,
          data.entrantId,
          data.teamName || `Team ${data.entrantId}`,
          data.teamType || 'primary',
          data.squadSizeSubmitted || null,
        ]
      );

      return await getTeamById(tournamentId, id);
    },

    updateTeam: async (
      tournamentId: number,
      teamId: number,
      data: {
        entrantId?: number;
        teamName?: string;
        teamType?: TeamType;
        squadSizeSubmitted?: number;
      }
    ) => {
      const fields: string[] = [];
      const params: Array<string | number | null> = [];

      if (data.entrantId !== undefined) {
        fields.push('entrantId = ?');
        params.push(data.entrantId);
      }
      if (data.teamName !== undefined) {
        fields.push('teamName = ?');
        params.push(data.teamName);
      }
      if (data.teamType !== undefined) {
        fields.push('teamType = ?');
        params.push(data.teamType);
      }
      if (data.squadSizeSubmitted !== undefined) {
        fields.push('squadSizeSubmitted = ?');
        params.push(data.squadSizeSubmitted);
      }

      if (!fields.length) {
        return { id: teamId, tournamentId, message: 'No changes provided' };
      }

      params.push(tournamentId);
      params.push(teamId);

      const affected = await update(
        `UPDATE tournament_teams
         SET ${fields.join(', ')}
         WHERE tournamentId = ? AND id = ?`,
        params
      );

      if (affected === 0) {
        throw new Error('Team not found');
      }

      return await getTeamById(tournamentId, teamId);
    },

    deleteTeam: async (tournamentId: number, teamId: number) => {
      const linkedSquadId = await findLinkedSquad(tournamentId, teamId);
      if (linkedSquadId) {
        await dbDelete(`DELETE FROM players WHERE teamId = ?`, [linkedSquadId]);
        await dbDelete(`DELETE FROM squads WHERE id = ?`, [linkedSquadId]);
      }

      const affected = await dbDelete(
        `DELETE FROM tournament_teams WHERE tournamentId = ? AND id = ?`,
        [tournamentId, teamId]
      );

      if (affected === 0) {
        throw new Error('Team not found');
      }

      return { id: teamId, tournamentId, message: 'Team deleted' };
    },

    createSquad: async (tournamentId: number, teamId: number, squadSize: number) => {
      const team = await getTeamById(tournamentId, teamId);
      if (!team) {
        throw new Error('Team not found');
      }

      await update(
        `UPDATE tournament_teams SET squadSizeSubmitted = ? WHERE tournamentId = ? AND id = ?`,
        [squadSize, tournamentId, teamId]
      );

      const squadId = await findOrCreateLinkedSquad(team);
      const existingRows = await select(
        `SELECT id FROM players WHERE teamId = ? ORDER BY id ASC`,
        [squadId]
      );

      const existingCount = existingRows.length;
      for (let i = existingCount + 1; i <= squadSize; i += 1) {
        await insert(
          `INSERT INTO players (firstName, secondName, teamId)
           VALUES (?, ?, ?)`,
          ['Player', `${i}`, squadId]
        );
      }

      const finalRows = await select(
        `SELECT id, firstName, secondName, teamId FROM players WHERE teamId = ? ORDER BY id ASC`,
        [squadId]
      );

      return {
        tournamentId,
        teamId,
        squadId,
        squadSizeRequested: squadSize,
        players: finalRows,
      };
    },

    assignPlayer: async (
      tournamentId: number,
      fromTeamId: number,
      toTeamId: number,
      playerId: number
    ) => {
      const fromTeam = await getTeamById(tournamentId, fromTeamId);
      const toTeam = await getTeamById(tournamentId, toTeamId);

      if (!fromTeam || !toTeam) {
        throw new Error('Source or target team not found');
      }

      const fromSquadId = await findOrCreateLinkedSquad(fromTeam);
      const toSquadId = await findOrCreateLinkedSquad(toTeam);

      const playerRows = await select(
        `SELECT id FROM players WHERE id = ? AND teamId = ?`,
        [playerId, fromSquadId]
      );
      if (!playerRows.length) {
        throw new Error('Player not found in source team');
      }

      await update(`UPDATE players SET teamId = ? WHERE id = ?`, [toSquadId, playerId]);

      return {
        tournamentId,
        playerId,
        fromTeamId,
        toTeamId,
        fromSquadId,
        toSquadId,
        message: 'Player reassigned',
      };
    },
  };
}

export = tournamentTeamsService;
