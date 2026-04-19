export interface MatchScoreInput {
  goals?: number | null;
  points?: number | null;
  goalsExtra?: number | null;
  pointsExtra?: number | null;
  goalsPenalties?: number | null;
}

function numberOrZero(value: number | null | undefined): number {
  return Number(value) || 0;
}

function phaseScore(
  goals: number | null | undefined,
  points: number | null | undefined
): number {
  return numberOrZero(goals) * 3 + numberOrZero(points);
}

export function calculateAggregateMatchScore(
  score: MatchScoreInput
): number {
  return (
    phaseScore(score.goals, score.points) +
    phaseScore(score.goalsExtra, score.pointsExtra) +
    numberOrZero(score.goalsPenalties)
  );
}

export default calculateAggregateMatchScore;
