import { calculateStandings } from '../../tournaments/build-report/utils/standingsCalculation';
import { calculateAggregateMatchScore } from '../../../../lib/match-score';

export function isFinished(fixture: any): boolean {
  return (
    ['played', 'skipped'].includes(fixture.outcome) &&
    ['goals1', 'points1', 'goals2', 'points2'].every(
      (field) => fixture[field] != null
    )
  );
}

export function isRealTeam(team: string): boolean {
  return (
    !!team && !team.startsWith('~') && !['PENDING', 'CONTESTED'].includes(team)
  );
}

export function score(fixture: any, side: number): number {
  return calculateAggregateMatchScore({
    goals: fixture[`goals${side}`],
    points: fixture[`points${side}`],
    goalsExtra: fixture[`goals${side}Extra`],
    pointsExtra: fixture[`points${side}Extra`],
    goalsPenalties: fixture[`goals${side}Penalties`],
  });
}

export function categoryStandings(fixtures: any[], points: any) {
  const groups = new Map<number, Set<string>>();
  const groupFixtures = fixtures.filter((f) => f.stage === 'group');
  for (const fixture of groupFixtures) {
    if (!groups.has(fixture.groupNumber))
      groups.set(fixture.groupNumber, new Set());
    for (const team of [fixture.team1Id, fixture.team2Id]) {
      if (isRealTeam(team)) groups.get(fixture.groupNumber)!.add(team);
    }
  }
  const transformed = groupFixtures.map((fixture) => {
    const finished = isFinished(fixture);
    const total1 = finished ? score(fixture, 1) : null;
    const total2 = finished ? score(fixture, 2) : null;
    const status = !finished
      ? 'contender'
      : total1 === total2
        ? 'draw'
        : total1 > total2
          ? 'won'
          : 'lost';
    return {
      pool: fixture.groupNumber,
      outcome: fixture.outcome,
      team1: { name: fixture.team1Id, total: total1, status },
      team2: {
        name: fixture.team2Id,
        total: total2,
        status: status === 'won' ? 'lost' : status === 'lost' ? 'won' : status,
      },
    };
  });
  return calculateStandings(
    { stage: { group: transformed as any } },
    [...groups].map(([group, teams]) => ({ group, teams: [...teams] })),
    points
  );
}
