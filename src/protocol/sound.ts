import { z } from 'zod';

/**
 * User-provided audio referenced by habit config (`soundId`).
 * URIs are device-local — share the library metadata, not the audio bytes.
 */
export const SoundAssetSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  source: z.enum(['file', 'youtube']),
  uri: z.string().min(1),
});

export type SoundAsset = z.infer<typeof SoundAssetSchema>;

export const SoundLibrarySchema = z.array(SoundAssetSchema);

export function parseSoundLibrary(raw: unknown): SoundAsset[] {
  return SoundLibrarySchema.parse(raw);
}
