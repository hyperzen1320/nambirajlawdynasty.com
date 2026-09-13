// next/image refuses (throws, in fact) remote hosts that next.config.ts doesn't
// allow. Site files and Supabase Storage are allowed and get optimised; any
// other https URL an editor pastes is rendered unoptimised rather than
// breaking the page.

const SUPABASE_STORAGE = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i;

export function imageProps(src: string): { src: string; unoptimized: boolean } {
  const optimisable = (src.startsWith("/") && !src.startsWith("//")) || SUPABASE_STORAGE.test(src);
  return { src, unoptimized: !optimisable };
}
