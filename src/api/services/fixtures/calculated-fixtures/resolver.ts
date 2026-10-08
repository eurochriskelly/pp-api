import { categoryStandings, isFinished, isRealTeam, score } from './standings';
import { predictGroupPosition } from './prediction';

export function createCalculatedResolver(
  fixtures: any[],
  points: any,
  awaitingVerification = false
) {
  const standings = categoryStandings(fixtures, points);
  const groupFixtures = fixtures.filter((f) => f.stage === 'group');
  const allComplete =
    groupFixtures.length > 0 && groupFixtures.every(isFinished);
  const byId = new Map(fixtures.map((f) => [f.id, f]));
  const orderedTeam = (rows: any[], position: number): string => {
    const row = rows[position - 1];
    if (!row) return 'CONTESTED';
    const tied = rows.filter((other) => other.position === row.position);
    return tied.length > 1 ? 'CONTESTED' : row.team;
  };
  const overallTeam = (rows: any[], position: number): string => {
    const row = rows[position - 1];
    if (!row) return 'CONTESTED';
    const same = rows.filter(
      (other) =>
        other.points === row.points &&
        other.scoreDifference === row.scoreDifference &&
        other.scoreFor === row.scoreFor &&
        (other.originalGroupSize !== row.originalGroupSize ||
          other.originalGroupPoints === row.originalGroupPoints)
    );
    return same.length > 1 ? 'CONTESTED' : row.team;
  };
  return (reference: string): string => {
    let match = reference.match(/^~group:(\d+)\/p:(\d+)$/);
    if (match && Number(match[1]) !== 0) {
      const group = Number(match[1]);
      const position = Number(match[2]);
      const rows = standings.byGroup[`GP.${group}`] || [];
      const games = groupFixtures.filter((f) => f.groupNumber === group);
      if (!games.length || !rows.length) return 'CONTESTED';
      if (games.every(isFinished))
        return awaitingVerification ? 'PENDING' : orderedTeam(rows, position);
      return predictGroupPosition(position, rows, games, points);
    }
    match = reference.match(/^~match:(\d+)\/p:([12])$/);
    if (match) {
      const source = byId.get(Number(match[1]));
      if (!source) return 'CONTESTED';
      if (!isFinished(source)) return 'PENDING';
      if (source.stage === 'group' && awaitingVerification) return 'PENDING';
      if (!isRealTeam(source.team1Id) || !isRealTeam(source.team2Id))
        return 'CONTESTED';
      const delta = score(source, 1) - score(source, 2);
      if (delta === 0) return 'CONTESTED';
      const winner = delta > 0 ? source.team1Id : source.team2Id;
      const loser = delta > 0 ? source.team2Id : source.team1Id;
      return match[2] === '1' ? winner : loser;
    }
    match = reference.match(/^~(group|rank|best|worst):(\d+)\/p:(\d+)$/);
    if (match) {
      if (!allComplete || awaitingVerification) return 'PENDING';
      const [, kind, index, place] = match;
      if (kind === 'group' || kind === 'rank')
        return overallTeam(
          standings.allGroups,
          Number(kind === 'rank' ? index : place)
        );
      const candidates =
        Number(place) === 0
          ? standings.allGroups
          : standings.allGroups.filter((row) =>
              Object.values(standings.byGroup).some(
                (rows) => rows[Number(place) - 1]?.team === row.team
              )
            );
      if (
        Number(place) > 0 &&
        Object.values(standings.byGroup).some(
          (rows) => orderedTeam(rows, Number(place)) === 'CONTESTED'
        )
      )
        return 'CONTESTED';
      return overallTeam(
        kind === 'worst' ? [...candidates].reverse() : candidates,
        Number(index)
      );
    }
    return 'CONTESTED';
  };
}
