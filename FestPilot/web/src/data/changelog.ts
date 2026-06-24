/**
 * The app's single source of truth for its version + human changelog (shown on the About screen).
 *
 * Every meaningful release adds ONE entry at the TOP of `CHANGELOG`, and bumps `APP_VERSION` to match.
 * Two audiences per entry:
 *   • `whatsNew` — plain language for festival-goers: what changed *for them*, benefit-first, no jargon.
 *   • `howToTest` — for the maker (Julio): where to look / how to see the change. Kept light, never deeply
 *     technical; if something is purely internal it's described by the visible effect, not the mechanism.
 * Keep both lists short (2–4 bullets). Newest first.
 */

export const APP_VERSION = "0.6.0";
export const CREATOR = "Julio Corcini";
export const APP_TAGLINE = "Your festival, planned and together.";
export const APP_ABOUT =
  "FestPilot is your festival companion. Pick every artist you don't want to miss, turn those picks into a " +
  "clash-free personal timetable, and stay together with your squad — a shared plan, a live stage map, " +
  "walking-time awareness, and meeting points for when you get separated.";

export interface ReleaseNote {
  version: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Short theme of the release. */
  title: string;
  /** Material Symbols glyph for the entry. */
  icon: string;
  /** Plain-language, benefit-first bullets for users. */
  whatsNew: string[];
  /** How the maker can see/verify the change in the app (light on jargon). */
  howToTest: string[];
}

export const CHANGELOG: ReleaseNote[] = [
  {
    version: "0.6.0",
    date: "2026-06-24",
    title: "Meeting points come alive",
    icon: "flag",
    whatsNew: [
      "Open a meeting point to see everyone converging on it — who's on the way, who's arrived, and a live walking ETA for squadmates sharing their location.",
      "Tap to set your status: On my way · I'm here · Can't make it.",
      "When everyone makes it, you get an \"everyone's here\" moment. The creator can close it or call it off.",
      "Old points fade on their own so the squad screen stays clean.",
    ],
    howToTest: [
      "Squad → open an active meeting point card → mark \"On my way\", then \"I'm here\".",
      "With a second member also \"here\", the screen flips to the reunion (\"the squad's back together\").",
      "As the creator, use \"Cancel meeting point\" / \"Close point\" and confirm it leaves the squad home.",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-06-23",
    title: "\"Come to me\" meeting points",
    icon: "where_to_vote",
    whatsNew: [
      "Drop an exact spot for the squad to regroup — pick it on the map, use your current location, or choose a stage.",
      "Add a name, a time (now / in 15 / 30 / 60 min) and a note, then send it to the squad.",
      "Everyone sees the spot with a friendly landmark like \"between Freedom & CORE\".",
    ],
    howToTest: [
      "Squad → \"Set a meeting point\" → drop a pin or \"My spot\" → \"Use this spot\".",
      "Add a name → \"Send to squad\" → the active point appears on the squad home.",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-06-22",
    title: "Find your squad on the map",
    icon: "share_location",
    whatsNew: [
      "See where your squad is on the festival map — shown by stage, never your exact dot, so it stays private.",
      "Choose how you share: stage only, precise for 60 minutes, or ghost (hidden).",
      "Can't find someone? Ping them to ask where they are, or nudge them to turn sharing on.",
      "One master switch pauses all sharing instantly.",
    ],
    howToTest: [
      "Squad → \"Where's the squad\" → allow location → you appear at a stage with squadmates.",
      "Try the sharing-mode picker (stage / precise / ghost) and a Ping or Nudge.",
      "Settings → Location & privacy → flip the master switch and confirm you disappear.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-06-21",
    title: "Plan together as a squad",
    icon: "diversity_3",
    whatsNew: [
      "Create a squad and invite friends with a link or QR code.",
      "Share your locked plan to see one combined squad timetable — where everyone wants to be, block by block.",
      "A pinned squad board for quick notes like \"meet at gate 3 at 18h\".",
    ],
    howToTest: [
      "Squad → Create → invite link/QR; join from a second browser.",
      "Lock a plan → \"Share my plan\" → open the squad plan overview and a block's detail.",
      "Post, pin and remove a note on the squad board.",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-06-20",
    title: "Plan your day",
    icon: "event_available",
    whatsNew: [
      "Swipe through the lineup to quickly favorite the artists you love.",
      "A full timetable grid, plus a lock-in flow that resolves clashes into a conflict-free \"My Plan\".",
      "\"Now & Next\" tells you what's on and when to leave, accounting for walking time.",
      "Stage-to-stage walking routes — and everything keeps working offline on site.",
    ],
    howToTest: [
      "Onboarding → swipe to favorite a few artists → see them in the Lineup.",
      "Timetable → lock a clashing pick → the resolver builds a clash-free My Plan.",
      "Home shows \"Leave in / Doors in\"; open a walking route; turn airplane mode on and the map/lineup still load.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-06-19",
    title: "Foundation: lineup + map",
    icon: "festival",
    whatsNew: [
      "The live Tomorrowland Belgium 2026 lineup, kept up to date automatically.",
      "A beautiful, true-to-life festival map with day and night looks.",
    ],
    howToTest: [
      "Open the app → the lineup loads from the live source.",
      "Open the Map → stages sit on the real terrain; toggle day/night.",
    ],
  },
];
