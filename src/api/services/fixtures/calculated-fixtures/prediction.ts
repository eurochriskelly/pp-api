import { isFinished, score } from './standings';

// Score margins in unfinished games are unbounded. Only points and a fixed,
// two-team head-to-head result can prove an order before all results are final.
export function predictGroupPosition(
  position: number,
  standings: any[],
  fixtures: any[],
  points: { win: number; draw: number; loss: number }
): string {
  const maxAward = Math.max(points.win, points.draw, points.loss);
  const minAward = Math.min(points.win, points.draw, points.loss);
  const bounds = new Map(
    standings.map((row) => {
      const remaining = fixtures.filter(
        (f) => !isFinished(f) && [f.team1Id, f.team2Id].includes(row.team)
      ).length;
      return [
        row.team,
        {
          min: row.points + remaining * minAward,
          max: row.points + remaining * maxAward,
        },
      ];
    })
  );
  const ahead = (a: any, b: any): boolean => {
    const aBounds = bounds.get(a.team)!;
    const bBounds = bounds.get(b.team)!;
    if (aBounds.min > bBounds.max) return true;
    if (aBounds.min !== bBounds.max) return false;
    const tiePoints = aBounds.min;
    if (
      standings.some(
        (other) =>
          other.team !== a.team &&
          other.team !== b.team &&
          bounds.get(other.team)!.min <= tiePoints &&
          bounds.get(other.team)!.max >= tiePoints
      )
    )
      return false;
    const direct = fixtures.filter(
      (f) =>
        [f.team1Id, f.team2Id].includes(a.team) &&
        [f.team1Id, f.team2Id].includes(b.team)
    );
    if (!direct.length || direct.some((f) => !isFinished(f))) return false;
    let h2hPointDifference = 0;
    let scoreDifference = 0;
    for (const f of direct) {
      const difference =
        score(f, f.team1Id === a.team ? 1 : 2) -
        score(f, f.team1Id === a.team ? 2 : 1);
      const winAward = f.outcome === 'skipped' ? 1 : points.win;
      h2hPointDifference += Math.sign(difference) * (winAward - points.loss);
      scoreDifference += difference;
    }
    return (
      h2hPointDifference > 0 ||
      (h2hPointDifference === 0 && scoreDifference > 0)
    );
  };
  for (const team of standings) {
    const above = standings.filter(
      (other) => other.team !== team.team && ahead(other, team)
    ).length;
    const below = standings.filter(
      (other) => other.team !== team.team && ahead(team, other)
    ).length;
    if (above === position - 1 && above + below === standings.length - 1)
      return team.team;
  }
  return 'PENDING';
}
