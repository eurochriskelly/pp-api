import { z } from 'zod';

export const competitionSettingsSchema = z
  .array(
    z.object({
      category: z.string().trim().min(1).max(255),
      winPoints: z.number().int().nonnegative(),
      drawPoints: z.number().int().nonnegative(),
      losePoints: z.number().int().nonnegative(),
      verifyGroupStages: z.boolean(),
    })
  )
  .superRefine((settings, ctx) => {
    const categories = settings.map((s) => s.category.toUpperCase());
    if (new Set(categories).size !== categories.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Duplicate competition category',
      });
    }
  });

export type CompetitionSettings = z.infer<typeof competitionSettingsSchema>;

export function getCompetitionSettings(
  tournament: any,
  categories: string[] = []
): CompetitionSettings {
  const stored =
    typeof tournament.competitionSettings === 'string'
      ? JSON.parse(tournament.competitionSettings)
      : tournament.competitionSettings;
  const settings: CompetitionSettings = stored || [];
  const result = [...settings];
  for (const category of categories) {
    if (
      !result.some((s) => s.category.toUpperCase() === category.toUpperCase())
    ) {
      result.push({
        category,
        winPoints: Number(tournament.pointsForWin ?? 2),
        drawPoints: Number(tournament.pointsForDraw ?? 1),
        losePoints: Number(tournament.pointsForLoss ?? 0),
        verifyGroupStages: Boolean(tournament.verifyGroupStages),
      });
    }
  }
  return result;
}

export function competitionRules(tournament: any, category: string) {
  const setting = getCompetitionSettings(tournament, [category]).find(
    (s) => s.category.toUpperCase() === category.toUpperCase()
  )!;
  return {
    points: {
      win: setting.winPoints,
      draw: setting.drawPoints,
      loss: setting.losePoints,
    },
    verifyGroupStages: setting.verifyGroupStages,
  };
}

export const tournamentDetailsSchema = z.object({
  region: z.string().max(255).optional(),
  title: z.string().trim().min(1).max(255).optional(),
  date: z.string().date().optional(),
  endDate: z.string().date().nullable().optional(),
  location: z.string().max(255).optional(),
  lat: z.number().finite().min(-90).max(90).nullable().optional(),
  lon: z.number().finite().min(-180).max(180).nullable().optional(),
  codeOrganizer: z
    .string()
    .regex(/^[a-z0-9]{4}$/i)
    .optional(),
  codeCoordinator: z
    .string()
    .regex(/^[a-z0-9]{4}$/i)
    .optional(),
  codeReferee: z
    .string()
    .regex(/^[a-z0-9]{4}$/i)
    .optional(),
  codeTeam: z
    .string()
    .regex(/^[a-z0-9]{4}$/i)
    .optional(),
  winPoints: z.number().int().nonnegative().optional(),
  drawPoints: z.number().int().nonnegative().optional(),
  lossPoints: z.number().int().nonnegative().optional(),
  verifyGroupStages: z.boolean().optional(),
  competitionSettings: competitionSettingsSchema.optional(),
});

export function settingsSignature(settings: CompetitionSettings): string {
  return JSON.stringify(
    settings
      .map((s) => [
        s.category.toUpperCase(),
        s.winPoints,
        s.drawPoints,
        s.losePoints,
        s.verifyGroupStages,
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  );
}
