/**
 * Single source of truth for the ABF team.
 *
 * Used by:
 *   - /about (renders 4 grids: Founding Members, Core Team, Health Team, Research Team)
 *
 * To swap initials for a real photo: drop a JPG into
 *   public/images/team/<slug>.jpg
 * then set `photo: "/images/team/<slug>.jpg"` on that member here.
 *
 * To wire a LinkedIn URL: set `linkedin: "https://linkedin.com/in/<handle>"`.
 * Without it, the LinkedIn icon renders dimmed/disabled on the card.
 */

export interface TeamMember {
  name: string;
  role: string;
  slug: string;
  linkedin?: string;
  photo?: string;
}

export interface TeamGroup {
  id: "founders" | "core" | "health" | "research";
  title: string;
  blurb: string;
  members: TeamMember[];
}

export const team: TeamGroup[] = [
  {
    id: "founders",
    title: "Directors",
    blurb: "Active Bengaluru Foundation is registered as a Section 8 company. These five members serve as the foundation's directors — the legal stewards on the registration — and are part of the wider team that built ABF.",
    members: [
      { name: "Tabraiz Amman",          role: "Director", slug: "tabraiz-amman" },
      { name: "Syed Tousif Masood",     role: "Director", slug: "syed-tousif-masood" },
      { name: "Syed Salman",            role: "Director", slug: "syed-salman" },
      { name: "Mohammed Irfan Sadiq",   role: "Director", slug: "mohammed-irfan-sadiq" },
      { name: "Tauseef Ahmed",          role: "Director", slug: "tauseef-ahmed" },
    ],
  },
  {
    id: "core",
    title: "Core Team",
    blurb: "ABF runs because of a dedicated group of individuals who give their time, skills, and energy — most of them professionals with full-time careers who choose to spend their evenings and weekends building something for the city they live in.",
    members: [
      { name: "Tanveer Ahmed",                role: "Core Team", slug: "tanveer-ahmed" },
      { name: "Mohammed Ibrahim Akram",       role: "Core Team", slug: "mohammed-ibrahim-akram" },
      { name: "Dr Mohammed Rafiuddin Rashed", role: "Core Team", slug: "mohammed-rafiuddin-rashed" },
      { name: "Dr Sadiq Sheriff",             role: "Core Team", slug: "sadiq-sheriff" },
      { name: "Syed Mehran",                  role: "Core Team", slug: "syed-mehran" },
      { name: "Anas Mahmood",                 role: "Core Team", slug: "anas-mahmood" },
      { name: "Muhammed Mehraj",              role: "Core Team", slug: "muhammed-mehraj" },
      { name: "Nasrullah Sharif",             role: "Core Team", slug: "nasrullah-sharif" },
      { name: "Naveed Irfan Iqbal",           role: "Core Team", slug: "naveed-irfan-iqbal" },
      { name: "Mohammed Ismail",              role: "Core Team", slug: "mohammed-ismail" },
      { name: "Afsar Ahmed",                  role: "Core Team", slug: "afsar-ahmed" },
      { name: "Saifulla Khan",                role: "Core Team", slug: "saifulla-khan" },
      { name: "Sadiq Rahmatullah",            role: "Core Team", slug: "sadiq-rahmatullah" },
    ],
  },
  {
    id: "health",
    title: "Health Team",
    blurb: "The people who power our 24/7 Active Health helpline — on call so families in need are never left without a direction to turn.",
    members: [
      { name: "Mohammed Shahid", role: "Health Team", slug: "mohammed-shahid" },
      { name: "Sanaulla Khan",   role: "Health Team", slug: "sanaulla-khan" },
    ],
  },
  {
    id: "research",
    title: "Research Team",
    blurb: "Working behind the scenes to shape our policy advocacy and minority welfare work with evidence and rigour.",
    members: [
      { name: "Soail Faraz Adoni", role: "Research Team", slug: "soail-faraz-adoni" },
    ],
  },
];

/** Two-letter initials, with honorifics like "Dr" stripped. */
export function initials(name: string): string {
  return name
    .replace(/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Sri\.?|Smt\.?)\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
