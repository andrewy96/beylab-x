import type { Profile } from "./supabase";

type PublicProfileName = Pick<Profile, "display_name" | "handle">;

export function profileDisplayName(
  profile: PublicProfileName | null | undefined,
  fallback = "?"
) {
  const displayName = profile?.display_name?.trim();
  return displayName || profile?.handle || fallback;
}
