/**
 * Single source of truth for media coverage.
 *
 * Used by:
 *   - /media (the press archive page)
 *   - EntryLayout (renders an "In the media" block on each project/relief
 *     detail page, filtering by `topic`)
 */

export interface Article {
  outlet: string;
  date: string;
  headline: string;
  topic: string;
  url: string;
  kind?: "video";
}

export const articles: Article[] = [
  // --- 2025: Mission NoDropOut + Baazigar ---
  { outlet: "India Now", date: "Jun 2025", headline: "Baazigar Awards Celebrates Students Who Beat the Odds", topic: "Mission NoDropOut", url: "https://indianow.me/2025/06/22/baazigar-awards-celebrates-underprivileged-students-who-beat-the-odds/" },
  { outlet: "The Indian Express", date: "May 2025", headline: "From failure to future: Bengaluru NGO helps hundreds of schoolchildren clear supplementary exams", topic: "Mission NoDropOut", url: "https://indianexpress.com/article/cities/bangalore/bengaluru-ngo-schoolchildren-clear-supplementary-exams-10088463/" },
  { outlet: "The New Indian Express", date: "May 2025", headline: "Now 'Mission NoDropOut' to tackle low SSLC pass rates in Karnataka", topic: "Mission NoDropOut", url: "https://www.newindianexpress.com/states/karnataka/2025/May/11/now-mission-nodropout-to-tackle-low-sslc-pass-rates-in-karnataka" },
  { outlet: "The Times of India", date: "May 2025", headline: "Remedial classes help Bengaluru's SSLC students prepare for supplementary exams", topic: "Mission NoDropOut", url: "https://timesofindia.indiatimes.com/city/bengaluru/remedial-classes-help-bengalurus-sslc-students-prepare-for-supplementary-exams/articleshow/121118830.cms" },
  { outlet: "Deccan Herald", date: "May 2025", headline: "Free preparatory classes for SSLC supplementary exams", topic: "Mission NoDropOut", url: "https://www.deccanherald.com/india/karnataka/bengaluru/free-preparatory-classes-for-sslc-supplementary-exams-3543110" },

  // --- 2025: BangaloreSehri (Ramadan) ---
  { outlet: "YouTube", date: "Mar 2025", headline: "No One Sleeps Hungry at Sehri: How Active Bengaluru Volunteers Feed Thousands", topic: "BangaloreSehri", url: "https://www.youtube.com/watch?v=MmJEi-fQiSo", kind: "video" },
  { outlet: "Bangalore Mirror", date: "Mar 2025", headline: "BangaloreSehri Connects Thousands to free Sehri", topic: "BangaloreSehri", url: "https://bangaloremirror.indiatimes.com/bangalore/others/bangaloresehri-connects-thousands-to-free-sehri/articleshow/128092639.cms" },
  { outlet: "The Hindu", date: "Mar 2025", headline: "Online sehri service for hostel, PG residents in Bengaluru during Ramzan", topic: "BangaloreSehri", url: "https://www.thehindu.com/news/national/karnataka/online-sehri-service-for-hostel-pg-residents-in-bengaluru-during-ramzan/article69262395.ece" },
  { outlet: "Klive News", date: "Mar 2025", headline: "Looking for Sehri? in Bangalore", topic: "BangaloreSehri", url: "https://klive.news/2025/03/01/57861/" },

  // --- 2024-25: Active Health (Syrian patient story) ---
  { outlet: "The Hindu", date: "Jan 2025", headline: "Doctors use translation tools to bridge language barrier to treat Syrian patients at Jayadeva Institute", topic: "Active Health", url: "https://www.thehindu.com/news/national/karnataka/doctors-use-translation-tools-to-bridge-language-barrier-to-treat-syrian-patients-at-jayadeva-institute/article70596545.ece" },
  { outlet: "News First Prime", date: "Dec 2024", headline: "Jayadeva Hospital performs free life-saving heart surgery on Syrian woman", topic: "Active Health", url: "https://newsfirstprime.com/bengaluru/jayadeva-hospital-performs-free-life-saving-heart-surgery-on-syrian-woman-11082442" },
  { outlet: "The Times of India", date: "Dec 2024", headline: "When Tech Capital Bengaluru Chose Compassion and Saved Syrian Woman's Life", topic: "Active Health", url: "https://timesofindia.indiatimes.com/city/bengaluru/when-tech-capital-bengaluru-chose-compassion-and-saved-syrian-womans-life/articleshow/127948063.cms" },

  // --- 2024: Winter Relief ---
  { outlet: "The Times of India", date: "Dec 2024", headline: "They Provide Blankets to the Homeless", topic: "Winter Relief", url: "https://timesofindia.indiatimes.com/city/bengaluru/they-provide-blankets-to-the-homeless/articleshow/116649724.cms" },

  // --- 2024: Drug Use video ---
  { outlet: "YouTube", date: "2024", headline: "Drug Use in Slums — interview with Syed Mehran & Akshita Mehta", topic: "Raah-E-Nijat", url: "https://www.youtube.com/watch?v=0m3Zf4aI87s", kind: "video" },

  // --- Apr 2024: Project ZAM ZAM + Voter Helpline ---
  { outlet: "YouTube", date: "Apr 2024", headline: "Active Bengaluru Foundation Ki Janib Se Appreciable Kaam Ki Buniyad", topic: "Project ZAM ZAM", url: "https://www.youtube.com/watch?v=fAiNNPQfrAw", kind: "video" },
  { outlet: "The New Indian Express", date: "Apr 2024", headline: "NGO supplies 50,000l of water in tanks to slums in North Bengaluru", topic: "Project ZAM ZAM", url: "https://www.newindianexpress.com/states/karnataka/2024/Apr/23/ngo-supplies-50000l-of-water-in-tanks-to-slums-in-north-bengaluru" },
  { outlet: "Inshorts", date: "Apr 2024", headline: "'Active Bengaluru' Provides Water Relief to Slum Residents", topic: "Project ZAM ZAM", url: "https://inshorts.com/en/news/active-bengaluru-provides-water-relief-to-slum-residents-1713887533712" },
  { outlet: "Bangalore Mirror", date: "Apr 2024", headline: "Race to Lok Sabha: Citizens' group sets up 24×7 call centres", topic: "Voter Helpline", url: "https://bangaloremirror.indiatimes.com/bangalore/others/race-to-lok-sabha-hoteliers-applaud-as-food-for-voters-plan-gets-go-ahead/articleshow/109541697.cms" },

  // --- Dec 2023: Tuticorin Floods relief ---
  { outlet: "Bangalore Mirror", date: "Dec 2023", headline: "Collective effort of compassion and relief from B'luru to Tuticorin", topic: "Tuticorin Floods", url: "https://bangaloremirror.indiatimes.com/bangalore/others/collective-effort-of-compassion-and-relief-from-bengaluru-to-tuticorin/articleshow/106273813.cms" },
  { outlet: "The New Indian Express", date: "Dec 2023", headline: "Volunteers from Bengaluru bring a smile to the ones affected by Tuticorin Flood", topic: "Tuticorin Floods", url: "" },
];

/**
 * Maps a project/relief content slug to its `topic` string in `articles`.
 * Used by EntryLayout to render an "In the media" block on detail pages.
 */
const TOPIC_BY_SLUG: Record<string, string> = {
  // Projects
  "active-health": "Active Health",
  "bangalore-sehri": "BangaloreSehri",
  "raah-e-nijat": "Raah-E-Nijat",
  // Relief campaigns
  "project-zam-zam": "Project ZAM ZAM",
  "voter-helpline": "Voter Helpline",
  "voter-enrollment": "Voter Helpline",
  "tuticorin-floods": "Tuticorin Floods",
  "mission-nodropout": "Mission NoDropOut",
};

/** Fetch articles for a given project/relief slug. Empty list if no mapping or no matches. */
export function articlesForSlug(slug: string): Article[] {
  const topic = TOPIC_BY_SLUG[slug];
  if (!topic) return [];
  return articles.filter((a) => a.topic === topic && a.url);
}
