import { z } from 'zod';

/** Migration/import-only — legacy global sound library from app_settings. */
const LegacySoundAssetSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  source: z.enum(['file', 'youtube']),
  uri: z.string().min(1),
});

export type LegacySoundAsset = z.infer<typeof LegacySoundAssetSchema>;

export function parseLegacySoundLibrary(raw: unknown): LegacySoundAsset[] {
  return z.array(LegacySoundAssetSchema).parse(raw);
}
