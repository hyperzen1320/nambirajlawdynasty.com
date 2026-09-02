import { Partner } from "@/models/Partner";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function uniquePartnerSlug(name: string): Promise<string> {
  const base = slugify(name) || "chambers";
  let candidate = base;
  let i = 2;
  while (await Partner.findOne({ slug: candidate })) {
    candidate = `${base}-${i++}`;
    if (i > 999) throw new Error("Could not generate a unique slug");
  }
  return candidate;
}
