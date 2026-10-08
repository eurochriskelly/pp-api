import { competitionRules } from '../../tournaments/competition-settings';
import { createHash } from 'crypto';
import dbHelper from '../../../../lib/db-helper';
import { createCalculatedResolver } from './resolver';
import { isFinished } from './standings';

export interface RefreshOptions {
  category?: string;
  mode?: 'resolve' | 'pending' | 'contested';
  approveGroups?: boolean;
}

type Operations = Pick<ReturnType<typeof dbHelper>, 'select' | 'update'>;

export async function refreshCalculatedFixtures(
  ops: Operations,
  tournamentId: number,
  options: RefreshOptions = {}
) {
  const [tournament] = await ops.select(
    'SELECT * FROM tournaments WHERE id = ? FOR UPDATE',
    [tournamentId]
  );
  if (!tournament)
    throw Object.assign(new Error('Tournament not found'), { statusCode: 404 });
  const fixtures = await ops.select(
    `SELECT * FROM fixtures WHERE tournamentId = ?${options.category ? ' AND category = ?' : ''} ORDER BY id FOR UPDATE`,
    options.category ? [tournamentId, options.category] : [tournamentId]
  );
  if (options.category && !fixtures.length) {
    throw Object.assign(new Error('Category not found'), { statusCode: 404 });
  }
  const storedHashes = tournament.groupStageVerificationHashes;
  const hashes =
    typeof storedHashes === 'string'
      ? JSON.parse(storedHashes)
      : { ...((storedHashes as any) || {}) };
  const changes: Array<{
    fixtureId: number;
    field: string;
    previous: unknown;
    value: string;
  }> = [];
  const skippedFixtureIds: number[] = [];
  let verificationChanged = false;
  for (const category of new Set(fixtures.map((f) => String(f.category)))) {
    const { points, verifyGroupStages } = competitionRules(
      tournament,
      category
    );
    const categoryFixtures = fixtures.filter((f) => f.category === category);
    const groups = categoryFixtures.filter((f) => f.stage === 'group');
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          points,
          groups: groups.map((f) => [
            f.id,
            f.groupNumber,
            f.team1Id,
            f.team2Id,
            f.outcome,
            f.goals1,
            f.points1,
            f.goals2,
            f.points2,
            f.goals1Extra,
            f.points1Extra,
            f.goals1Penalties,
            f.goals2Extra,
            f.points2Extra,
            f.goals2Penalties,
          ]),
        })
      )
      .digest('hex');
    if (
      options.approveGroups &&
      options.mode !== 'pending' &&
      options.mode !== 'contested' &&
      groups.length &&
      groups.every(isFinished)
    ) {
      hashes[category] = hash;
      verificationChanged = true;
    } else if (options.mode === 'pending' || options.mode === 'contested') {
      delete hashes[category];
      verificationChanged = true;
    }
    const resolve = createCalculatedResolver(
      categoryFixtures,
      points,
      verifyGroupStages && hashes[category] !== hash
    );
    for (const fixture of categoryFixtures.filter((f) => f.stage !== 'group')) {
      // Never rewrite participants or umpires of a match already in play.
      if (
        fixture.started ||
        fixture.ended ||
        ['played', 'skipped', 'in-progress'].includes(String(fixture.outcome))
      ) {
        skippedFixtureIds.push(Number(fixture.id));
        continue;
      }
      for (const side of ['team1', 'team2', 'umpireTeam']) {
        const reference = fixture[`${side}Planned`];
        if (typeof reference !== 'string' || !reference.startsWith('~'))
          continue;
        const value =
          options.mode === 'pending'
            ? 'PENDING'
            : options.mode === 'contested'
              ? 'CONTESTED'
              : resolve(reference);
        const field = `${side}Id`;
        if (fixture[field] === value) continue;
        await ops.update(
          `UPDATE fixtures SET ${field} = ? WHERE id = ? AND tournamentId = ?`,
          [value, fixture.id, tournamentId]
        );
        changes.push({
          fixtureId: Number(fixture.id),
          field,
          previous: fixture[field],
          value,
        });
      }
    }
  }
  if (verificationChanged)
    await ops.update(
      'UPDATE tournaments SET groupStageVerificationHashes = ? WHERE id = ?',
      [JSON.stringify(hashes), tournamentId]
    );
  return { tournamentId, changes, skippedFixtureIds };
}

export default (db: any) => {
  const { transaction } = dbHelper(db);
  return {
    refresh: (id: number, options: RefreshOptions = {}) =>
      transaction((tx) => refreshCalculatedFixtures(tx, id, options)),
  };
};
