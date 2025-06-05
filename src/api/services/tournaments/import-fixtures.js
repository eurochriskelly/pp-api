/**
 * fixtures-sql.js
 *
 * ❶ `rowsToFixtures(rows, tournamentId, startDate)`  
 *     – converts the validated “import-format” rows to plain JS fixture objects.
 *
 * ❷ `buildFixturesInsertSQL(rows, tournamentId, startDate)`  
 *     – returns one multi-line INSERT statement you can run in a single commit.
 *
 * No DB calls, no HTTP, no validation: this module only transforms data and
 * produces SQL text.
 */

/* ───────────── helpers ───────────── */

const matchNo = s => +s.split('.').pop();                     // "M.12" → 12
const ord = n => {
  const suff = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suff[(v - 20) % 10] || suff[v] || suff[0]}`;
};
const pad     = t => t.padStart(5, '0');
/* ───────────────────── team conversion ───────────────────── */
function convertTeam(str, isGroupStage, categories, currentCategory, tournamentId) {
  if (!str || isGroupStage || str.includes('~')) return str;   // nothing to do

  // normalise, remove optional " IN " to unify patterns
  const upper = str.trim().toUpperCase().replace(/\s+IN\s+/g, ' ');

  /* 1. “3RD GP.1” → ~group:1/p:3 */
  let m = upper.match(/^(\d+)\s*(?:ST|ND|RD|TH)\s+GP\.(\d+)$/);
  if (m) return `~group:${+m[2]}/p:${+m[1]}`;

  /* 2. “3RD BEST 2ND”, “BEST 1ST” → ~best:x/p:y  (missing ordinal = 1) */
  m = upper.match(/^(?:\s*(\d+)\s*(?:ST|ND|RD|TH)\s+)?BEST\s+(\d+)\s*(?:ST|ND|RD|TH)$/);
  if (m) {
    const bestIdx = m[1] ? +m[1] : 1;
    return `~best:${bestIdx}/p:${+m[2]}`;
  }

  /* 3. “4TH GPS” → ~rank:4/p:0 */
  m = upper.match(/^(\d+)\s*(?:ST|ND|RD|TH)\s+GPS$/);
  if (m) return `~rank:${+m[1]}/p:0`;

  /* 4. “WINNER M.11” / “LOSER M.11” → ~match:<fullId>/p:1|2 */
  m = upper.match(/^(WINNER|LOSER)\s+[A-Z]+\.(\d+)$/);
  if (m) {
    const isWinner   = m[1] === 'WINNER';
    const refMatchNo = +m[2];
    const tOffset    = +tournamentId * 10_000;
    const cOffset    = categories.indexOf(currentCategory) * 1_000;
    const fullId     = tOffset + cOffset + refMatchNo;
    return `~match:${fullId}/p:${isWinner ? 1 : 2}`;
  }

  return str;                                 // unmatched → unchanged
}

/** SQL-escape a value (primitive only).  null/undefined → NULL (unquoted) */
function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return v;
  return `'${String(v).replace(/'/g, "''")}'`;
}

/* ───────── rows → fixtures ───────── */

function rowsToFixtures(rows, tournamentId, startDate) {
  const categories = [...new Set(rows.map(r => r.CATEGORY))];
  const tOffset    = +tournamentId * 10_000;

  return rows.map(r => {
    const cOffset = categories.indexOf(r.CATEGORY) * 1_000;
    const id      = tOffset + cOffset + matchNo(r.MATCH);

    // ─────────── stage / groupNumber conversion ───────────
    let stageRaw = r.STAGE.trim();
    let stage, groupNumber;

    if (stageRaw.startsWith('GP')) {
      // pool play
      const [, g] = stageRaw.split('.');
      stage        = 'group';
      groupNumber  = +g;
    } else {
      const [bracket, part] = stageRaw.split('.');
      const b = bracket.toLowerCase();            // cup | shd | plt

      const level = (() => {
        if (part === 'FIN') return 'finals';
        if (part === 'P/O') return 'playoffs'; // Handle P/O
        const m = part.match(/^(SF|QF|EF)(\d)$/);
        if (m) return { SF: 'semis', QF: 'quarters', EF: 'eights' }[m[1]];
        const pos = part.match(/^(\d+)\/(\d+)$/);
        if (pos) return `${ord(+pos[1])}${ord(+pos[2])}`;
        return part.toLowerCase();      // fallback, should not happen
      })();

      stage = `${b}_${level}`;

      // groupNumber
      if (/^(SF|QF|EF)\d$/.test(part)) {
        groupNumber = +part.slice(-1);   // SF2 → 2, etc.
      } else { // Covers FIN, P/O, and positional playoffs like 3/4
        groupNumber = 1;
      }
    }

    // scheduled ISO with space for SQL DATETIME
    const iso   = `${startDate}T${pad(r.TIME)}:00.000Z`;
    const sched = new Date(iso).toISOString().slice(0, 19).replace('T', ' ');

    const isGroupStage = stage === 'group';

    const team1  = convertTeam(r.TEAM1,   isGroupStage, categories, r.CATEGORY, tournamentId);
    const team2  = convertTeam(r.TEAM2,   isGroupStage, categories, r.CATEGORY, tournamentId);
    const umpire = convertTeam(r.UMPIRES, isGroupStage, categories, r.CATEGORY, tournamentId);

    return {
      id,
      tournamentId,
      category    : r.CATEGORY,
      groupNumber,
      stage,
      pitch       : r.PITCH,

      pitchPlanned     : r.PITCH,
      scheduled        : sched,
      scheduledPlanned : sched,
      started          : null,

      team1Planned : team1, 
      team1Id      : team1,
      goals1       : null,
      points1      : null,

      team2Planned : team2,
      team2Id      : team2,
      goals2       : null,
      points2      : null,

      umpireTeamPlanned : umpire,
      umpireTeamId      : umpire,

      outcome : 'not played'
    };
  });
}

/* ────── fixtures → SQL text ────── */

function buildFixturesInsertSQL(rows, tournamentId, startDate) {
  const fixtures = rowsToFixtures(rows, tournamentId, startDate);
  const cols = [
    'id','tournamentId','category','groupNumber',
    'stage','pitch','pitchPlanned','scheduled','scheduledPlanned','started',
    'team1Planned','team1Id','goals1','points1',
    'team2Planned','team2Id','goals2','points2',
    'umpireTeamPlanned','umpireTeamId','outcome'
  ];
  const valuesLines = fixtures.map(f => `  (${[
    esc(f.id), esc(f.tournamentId), esc(f.category), esc(f.groupNumber),
    esc(f.stage), esc(f.pitch), esc(f.pitchPlanned),
    esc(f.scheduled), esc(f.scheduledPlanned), esc(f.started),
    esc(f.team1Planned), esc(f.team1Id), esc(f.goals1), esc(f.points1),
    esc(f.team2Planned), esc(f.team2Id), esc(f.goals2), esc(f.points2),
    esc(f.umpireTeamPlanned), esc(f.umpireTeamId), esc(f.outcome)
  ].join(', ')})`).join(',\n');

  return `INSERT INTO fixtures (${cols.join(', ')}) VALUES\n${valuesLines};`;
}

/* ─────────── exports ─────────── */

module.exports = {
  rowsToFixtures,
  buildFixturesInsertSQL
};
