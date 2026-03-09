/**
 * fixtures-sql.ts
 *
 * Converts the validated "import-format" rows to plain JS fixture objects.
 * Returns one multi-line INSERT statement you can run in a single commit.
 */

export interface TsvRow {
  TIME: string;
  MATCH: string;
  CATEGORY: string;
  PITCH: string;
  TEAM1: string;
  STAGE: string;
  TEAM2: string;
  UMPIRES: string;
  DURATION: string | number;
}

export interface Fixture {
  id: number;
  tournamentId: number;
  category: string;
  groupNumber: number;
  stage: string;
  pitch: string;
  pitchPlanned: string;
  scheduled: string;
  scheduledPlanned: string;
  started: null;
  team1Planned: string;
  team1Id: string;
  goals1: null;
  points1: null;
  team2Planned: string;
  team2Id: string;
  goals2: null;
  points2: null;
  umpireTeamPlanned: string;
  umpireTeamId: string;
  durationPlanned: number;
  outcome: string;
}

const matchNo = (s: string): number => +s.split('.').pop()!;

const ord = (n: number): string => {
  const suff = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suff[(v - 20) % 10] || suff[v] || suff[0]}`;
};

const pad = (t: string): string => t.padStart(5, '0');

function convertTeam(
  str: string,
  isGroupStage: boolean,
  categories: string[],
  currentCategory: string,
  tournamentId: number
): string {
  if (!str || isGroupStage || str.includes('~')) return str;

  const upper = str
    .trim()
    .toUpperCase()
    .replace(/\s+IN\s+/g, ' ');

  let m = upper.match(/^(\d+)\s*(?:ST|ND|RD|TH)\s+GP\.(\d+)$/);
  if (m) return `~group:${+m[2]}/p:${+m[1]}`;

  m = upper.match(
    /^(?:\s*(\d+)\s*(?:ST|ND|RD|TH)\s+)?BEST\s+(\d+)\s*(?:ST|ND|RD|TH)$/
  );
  if (m) {
    const bestIdx = m[1] ? +m[1] : 1;
    return `~best:${bestIdx}/p:${+m[2]}`;
  }

  m = upper.match(/^(\d+)\s*(?:ST|ND|RD|TH)\s+GPS$/);
  if (m) return `~rank:${+m[1]}/p:0`;

  m = upper.match(/^(WINNER|LOSER)\s+[A-Z]+\.(\d+)$/);
  if (m) {
    const isWinner = m[1] === 'WINNER';
    const refMatchNo = +m[2];
    const tOffset = +tournamentId * 10_000;
    const cOffset = categories.indexOf(currentCategory) * 1_000;
    const fullId = tOffset + cOffset + refMatchNo;
    return `~match:${fullId}/p:${isWinner ? 1 : 2}`;
  }

  return str;
}

function esc(v: unknown): string | number {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return v;
  return `'${String(v).replace(/'/g, "''")}'`;
}

function rowsToFixtures(
  rows: TsvRow[],
  tournamentId: number,
  startDate: string
): Fixture[] {
  const categories = [...new Set(rows.map((r) => r.CATEGORY))];
  const tOffset = +tournamentId * 10_000;

  return rows.map((r) => {
    const cOffset = categories.indexOf(r.CATEGORY) * 1_000;
    const id = tOffset + cOffset + matchNo(r.MATCH);

    let stageRaw = r.STAGE.trim().toUpperCase();
    let stage: string;
    let groupNumber: number;

    if (stageRaw.startsWith('GP')) {
      const [, g] = stageRaw.split('.');
      stage = 'group';
      groupNumber = +g;
    } else {
      const [bracket, part] = stageRaw.split('.');
      const b = bracket.toLowerCase();

      const level = (() => {
        if (part === 'FIN') return 'finals';
        if (part === 'P/O') return 'playoffs';
        const m = part.match(/^(SF|QF|EF)(\d)$/);
        if (m) return { SF: 'semis', QF: 'quarters', EF: 'eights' }[m[1]];
        const pos = part.match(/^(\d+)\/(\d+)$/);
        if (pos) return `${ord(+pos[1])}${ord(+pos[2])}`;
        return part.toLowerCase();
      })();

      stage = `${b}_${level}`;

      if (/^(SF|QF|EF)\d$/.test(part)) {
        groupNumber = +part.slice(-1);
      } else {
        groupNumber = 1;
      }
    }

    const iso = `${startDate}T${pad(r.TIME)}:00.000Z`;
    const sched = new Date(iso).toISOString().slice(0, 19).replace('T', ' ');

    const isGroupStage = stage === 'group';
    const duration = r.DURATION ? parseInt(r.DURATION as string, 10) : 20;

    const team1 = convertTeam(
      r.TEAM1,
      isGroupStage,
      categories,
      r.CATEGORY,
      tournamentId
    );
    const team2 = convertTeam(
      r.TEAM2,
      isGroupStage,
      categories,
      r.CATEGORY,
      tournamentId
    );
    const umpire = convertTeam(
      r.UMPIRES,
      isGroupStage,
      categories,
      r.CATEGORY,
      tournamentId
    );

    return {
      id,
      tournamentId,
      category: r.CATEGORY,
      groupNumber,
      stage,
      pitch: r.PITCH,
      pitchPlanned: r.PITCH,
      scheduled: sched,
      scheduledPlanned: sched,
      started: null,
      team1Planned: team1,
      team1Id: team1,
      goals1: null,
      points1: null,
      team2Planned: team2,
      team2Id: team2,
      goals2: null,
      points2: null,
      umpireTeamPlanned: umpire,
      umpireTeamId: umpire,
      durationPlanned: duration,
      outcome: 'not played',
    };
  });
}

function buildFixturesInsertSQL(
  rows: TsvRow[],
  tournamentId: number,
  startDate: string
): string {
  const fixtures = rowsToFixtures(rows, tournamentId, startDate);
  const cols = [
    'id',
    'tournamentId',
    'category',
    'groupNumber',
    'stage',
    'pitch',
    'pitchPlanned',
    'scheduled',
    'scheduledPlanned',
    'started',
    'team1Planned',
    'team1Id',
    'goals1',
    'points1',
    'team2Planned',
    'team2Id',
    'goals2',
    'points2',
    'umpireTeamPlanned',
    'umpireTeamId',
    'durationPlanned',
    'outcome',
  ];
  const valuesLines = fixtures
    .map(
      (f) =>
        `  (${[
          esc(f.id),
          esc(f.tournamentId),
          esc(f.category),
          esc(f.groupNumber),
          esc(f.stage),
          esc(f.pitch),
          esc(f.pitchPlanned),
          esc(f.scheduled),
          esc(f.scheduledPlanned),
          esc(f.started),
          esc(f.team1Planned),
          esc(f.team1Id),
          esc(f.goals1),
          esc(f.points1),
          esc(f.team2Planned),
          esc(f.team2Id),
          esc(f.goals2),
          esc(f.points2),
          esc(f.umpireTeamPlanned),
          esc(f.umpireTeamId),
          esc(f.durationPlanned),
          esc(f.outcome),
        ].join(', ')})`
    )
    .join(',\n');

  return `INSERT INTO fixtures (${cols.join(', ')}) VALUES\n${valuesLines};`;
}

export { rowsToFixtures, buildFixturesInsertSQL };
export default { rowsToFixtures, buildFixturesInsertSQL };
