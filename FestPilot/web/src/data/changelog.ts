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

export const APP_VERSION = "0.21.1";
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
    version: "0.21.1",
    date: "2026-06-26",
    title: "Haptics only on real taps",
    icon: "do_not_touch",
    whatsNew: [
      "Fixed: scrolling the Timetable or Lineup no longer buzzes. Haptics now fire only on a genuine tap — never when you drag or scroll your finger over the cards.",
    ],
    howToTest: [
      "With haptics ON, scroll up and down the Timetable and Lineup — it should stay silent while scrolling.",
      "Tapping a card, heart, chip or tab still gives its little buzz.",
    ],
  },
  {
    version: "0.21.0",
    date: "2026-06-26",
    title: "Buttons that press back",
    icon: "touch_app",
    whatsNew: [
      "Every button, chip and tab now gently presses in when you tap it — paired with the buzz from last update, taps feel physical instead of flat.",
      "Hearts give a quick squeeze when you favorite, and the bottom tabs dip as you switch — small touches that make the whole app feel alive.",
      "Taps register instantly: we removed the old half-second delay phones add, so controls respond the moment you touch them.",
      "Respectful of your settings: if your phone is set to 'reduce motion', the press effect quietly turns itself off.",
    ],
    howToTest: [
      "Open Timetable and press-and-hold any button (Lock in, a day chip, a heart, the Now/Timetable tabs) — it should visibly shrink while held and spring back on release.",
      "The heart gives the biggest squeeze; the bottom tabs dip noticeably; CTAs press in subtly.",
      "Turn on 'Reduce Motion' in your phone's accessibility settings — the shrink effect disappears (taps still buzz).",
    ],
  },
  {
    version: "0.20.0",
    date: "2026-06-26",
    title: "Feels like a real app — haptics",
    icon: "vibration",
    whatsNew: [
      "FestPilot now answers your touch: a subtle buzz confirms taps, a little 'pick' when you favorite an artist, a satisfying pulse when you lock in a clash, and a firmer one when you send an 'I'm lost' alert.",
      "On by default, easy to turn off: Settings → Appearance → Haptic feedback (it gives a quick buzz so you feel what you chose).",
      "Honest about limits: iPhones don't give web apps vibration, so it stays silent there — every action still has its visual cue.",
    ],
    howToTest: [
      "On Android / the installed app: favorite an artist, lock in a clash, tap around — you feel short, distinct buzzes; the 'I'm lost' broadcast gives a stronger one.",
      "Settings → Appearance → Haptic feedback: turn it off → taps go silent; turn it on → you get a confirmation buzz.",
      "On iPhone the toggle shows an honest 'not supported' note instead of pretending.",
    ],
  },
  {
    version: "0.19.0",
    date: "2026-06-26",
    title: "Always the latest — auto-updates",
    icon: "system_update",
    whatsNew: [
      "FestPilot now keeps itself current: when a new version goes live, the installed app notices on its own and slides in a gold 'New version available' bar — one tap and you're on the latest.",
      "It checks quietly in the background — when you reopen the app, when your signal comes back, and every so often while it's open — so you're never stuck on a stale build during the festival.",
      "In a hurry or think you're behind? Settings → Offline & install now has a 'Force update' that pulls the freshest build right away.",
    ],
    howToTest: [
      "After this release ships, reopen the installed app once a newer build is published → a gold bar appears at the top; 'Update' reloads straight into the new version, 'Dismiss' hides it until next time.",
      "Settings → Offline & install → 'Check for updates' still reports your version; tap 'Force update' below it to reload into the freshest build on demand.",
      "Switch away from the app and back (or toggle airplane mode off) → it silently re-checks; with a new build live, the bar shows up on its own.",
    ],
  },
  {
    version: "0.18.0",
    date: "2026-06-26",
    title: "The Squad screen, answered at a glance",
    icon: "diversity_3",
    whatsNew: [
      "Your Squad screen now answers the big questions without a tap: 'Where is everyone' groups your squad by stage with their faces, so you can see the crowd's split at a glance — and 'Ping all' nudges anyone who's gone quiet.",
      "Active meeting points are front and centre with a live compass: the real distance and direction to the spot, plus a one-tap 'Go' to walk there.",
      "Your pinned board rides along too — the latest notes are right there, with 'Add note' a tap away.",
      "Everything else you rely on stays put: the squad switcher, the safety banner, the shared plan, 'I'm lost', members and invite.",
    ],
    howToTest: [
      "Open Squad with a few squadmates sharing → 'Where is everyone' clusters them by stage (your stage reads '· with you'); tap it to open the live map.",
      "With an active meeting point, the card shows '120 m · NE' style distance + a compass arrow → 'Go' opens turn-free navigation (allow location).",
      "The board preview shows your latest pins → 'Add note' jumps to the board; empty squads get calm 'nothing yet' prompts instead of blank cards.",
      "Top-right is now invite (person_add); Settings still lives under the avatar menu on Now & Next.",
    ],
  },
  {
    version: "0.17.0",
    date: "2026-06-26",
    title: "Your weekend, your zoom, instant artist cards",
    icon: "tune",
    whatsNew: [
      "The Lineup now respects the weekend you picked: you only see the artists, days and set times for your weekend — favorite someone and you won't get the other weekend's slot by mistake.",
      "Changed your mind? Settings → Festival & weekend lets you switch your weekend (or days) anytime, and the whole app re-scopes instantly.",
      "Tapping an artist is instant now: the photo you already saw stays put (no reload) and the screen behind it no longer jumps.",
      "Pinch to zoom — spread two fingers on the timetable to zoom in, or on the lineup to resize the artist grid.",
      "Clearer timetable controls: the hour-lines button finally looks like what it does.",
    ],
    howToTest: [
      "Pick a single weekend in onboarding (or Settings → Festival & weekend) → the Lineup days, favorites and an artist's set times only show that weekend.",
      "Settings → Festival & weekend → switch W1 / W2 / Both and toggle days → the Lineup and timetable follow immediately.",
      "Tap an artist already visible on a card → the sheet opens with the same photo instantly and the background stays still.",
      "On a touch screen, pinch the Timetable (zoom in/out) and the Lineup (2–4 columns).",
    ],
  },
  {
    version: "0.15.0",
    date: "2026-06-25",
    title: "Tap any artist — photos, set times & socials",
    icon: "person_pin",
    whatsNew: [
      "Tap any artist — on Now, the timetable, the lineup, or your plan — to see exactly where and when they play, with their photo and links to Instagram, Spotify, SoundCloud and more.",
      "Artist photos now load reliably and stay put: the right face under the right name even on a flaky festival signal, and your favorites' photos keep working offline.",
      "Picking artists on the first run is fixed on iPhone/Safari — every artist's name stays fully visible while you choose.",
    ],
    howToTest: [
      "Tap an artist card anywhere (Now, Timetable, Lineup, My Plan) → a sheet shows their photo, every set (where + when), and social links; the heart and the ⋮ menu still work on their own without opening the sheet.",
      "Scroll the lineup fast on a slow connection → each photo settles on the correct artist (no wrong-photo flash); turn on airplane mode → favorited artists keep their photos.",
      "On an iPhone, run onboarding artist selection → each name is always fully visible.",
    ],
  },
  {
    version: "0.14.0",
    date: "2026-06-24",
    title: "More festivals, mapped for real",
    icon: "map",
    whatsNew: [
      "New festivals, done right: behind the scenes the team can now add a festival straight from its official lineup page — nothing typed by hand — so each new event arrives with its real, automatically-updated lineup.",
      "Every festival can get a true-to-life map: the team pins each stage on the venue illustration by its real-world spot, so 'where's my squad' and the walking times line up with the actual ground.",
    ],
    howToTest: [
      "/admin → Festivals → 'Add festival' → paste an official lineup page URL → it imports the lineup live (and shows an honest error if a page can't be resolved — it never invents data).",
      "/admin → a festival's 'Map' action → set/upload a base image, drop 3+ control points with their real lng/lat → 'Fit affine' (watch the pixel error), then place each stage and 'Save map'.",
      "Per-festival 'Re-import from source' refreshes one festival; 'Re-import all' refreshes every registered one; 'Edit' renames or fixes a timezone.",
    ],
  },
  {
    version: "0.13.0",
    date: "2026-06-24",
    title: "Behind the scenes: a real control room",
    icon: "tune",
    whatsNew: [
      "Behind the scenes, FestPilot now has a proper back-office: the team can add festivals, check that each lineup and timetable looks healthy, and keep an eye on how the app is doing — so what you see stays accurate and reliable.",
      "A live test room lets us rehearse the 'find your squad' map with stand-in members before a real festival, so presence and meeting points just work on the day.",
      "Honest by design: usage and storage are watched against the free limits, and nothing you see in the app is ever faked test data.",
    ],
    howToTest: [
      "Open /admin with the operator token: Festivals overview, Lineup & timetable health, Data sources, Suggestions, Metrics & runway, and the Test console.",
      "Metrics & runway shows real users (country + last-seen) and how close R2/Workers are to the free tier; exact platform figures are marked 'locked' until an analytics token is connected — never invented.",
      "Test console → add a synthetic member, drop them on a stage, and watch them appear live in your own 'Where's everyone'; Purge clears every test entity.",
      "End users see no change beyond a small 'test' badge that only appears next to synthetic members during a live test.",
    ],
  },
  {
    version: "0.12.0",
    date: "2026-06-24",
    title: "Your language, installable, always fresh",
    icon: "translate",
    whatsNew: [
      "FestPilot speaks your language: switch between English and Português in Settings → Appearance and the whole app follows instantly.",
      "Install it like a real app — one tap on Android and desktop, clear step-by-step on iPhone — so it lives on your home screen and opens full-screen.",
      "Always up to date: an honest 'Check for updates' that tells you when a new version is ready and reloads straight into it.",
      "Little touches that make it feel like an app, not a web page: text no longer selects as you tap and drag, and names on coloured avatars stay crisp and readable.",
    ],
    howToTest: [
      "Settings → Appearance → Language → Português: the tabs, settings and prompts change immediately (English is the default).",
      "Settings → Offline & install → 'Install app' (Android/desktop shows the prompt; iPhone shows the Share → Add to Home Screen steps); an installed app is detected.",
      "Settings → Offline & install → 'Check for updates' → after a new deploy it offers to reload into the new version.",
      "Settings → About → see the build date and working links to Privacy and Offline; try selecting text anywhere (it won't) — but typing in inputs still works.",
    ],
  },
  {
    version: "0.11.0",
    date: "2026-06-24",
    title: "Your squad, upgraded",
    icon: "diversity_3",
    whatsNew: [
      "Be in more than one squad: a switcher at the top of the Squad tab lets you hop between them, each with its own plan, map and meeting points.",
      "Put a face to your name — add a real profile photo (we keep it small), shown to your squad and on the map. No photo? Your coloured initials still look great.",
      "Joining a squad now offers to share your plan and favourites in one tap, so the shared timetable fills in instantly (you can turn this off in Settings).",
      "A real mini-map of the venue with your squad on it, richer meeting-point cards — with who set it and an optional photo of the exact spot — and honest, accurate copy throughout.",
    ],
    howToTest: [
      "Profile → tap your avatar → choose a photo (it appears in the header and your squad's member list); 'Remove photo' reverts to initials.",
      "Create a custom-emoji squad, then a second one → the switcher appears at the top of the Squad tab.",
      "Join via an invite link → the one-time 'Share your plan?' confirm (toggle it in Settings → Auto-share).",
      "Set a meeting point → open it → 'Add photo'; the squad home card shows the photo + who set it. 'Where's the squad' shows the real venue mini-map.",
    ],
  },
  {
    version: "0.10.3",
    date: "2026-06-24",
    title: "Tweak your plan without starting over",
    icon: "edit_calendar",
    whatsNew: [
      "Your plan is yours to edit: tap any set in My Plan to swap it, remove it, or jump to it on the map.",
      "Add a set anytime — we only offer acts that actually fit, so your day never ends up with a clash.",
      "Walking times and breaks recalculate instantly after every change, so the plan always stays honest.",
    ],
    howToTest: [
      "My Plan → tap a set → Swap / Remove / View on map; tap 'Add a set' to slot another act in.",
      "Add or swap and watch the walk chips and breaks redraw — the plan never overlaps itself.",
    ],
  },
  {
    version: "0.10.2",
    date: "2026-06-24",
    title: "A cleaner, easier-to-read timetable",
    icon: "calendar_view_week",
    whatsNew: [
      "Cleaner set cards: a single slim stage-colour line on top, the artist photo, and the heart neatly centred.",
      "Discreet hour and half-hour gridlines make set times easier to read at a glance (toggle them with the Grid button).",
      "Back-to-back sets no longer look glued together, and the controls up top are more compact so you see more of the grid.",
    ],
    howToTest: [
      "Open the Timetable: cards now show one thin colour line on top (not two) and a small gap between touching sets.",
      "Tap 'Grid' to show/hide the faint time lines behind the cards.",
    ],
  },
  {
    version: "0.10.1",
    date: "2026-06-24",
    title: "Now & Next is yours, never random",
    icon: "bolt",
    whatsNew: [
      "The home screen now follows your night: your locked plan first, then your favorites in order — what's on now, what's next, and when to leave.",
      "No more random artists on the home — if you haven't picked anyone yet, it tells you so and points you to the lineup.",
    ],
    howToTest: [
      "Open Now & Next before favoriting anyone — you get a friendly 'Pick the acts you can't miss' prompt, not a stranger.",
      "Favorite a few artists on the Lineup, then return to Now & Next — the hero and 'Up next' are only acts you chose.",
    ],
  },
  {
    version: "0.10.0",
    date: "2026-06-24",
    title: "A favorites flow with a face",
    icon: "photo_library",
    whatsNew: [
      "FestPilot now opens by asking your name — and an optional email, no password — so your squad sees you on the plan and the map. Don't want to share an email? One tap skips it.",
      "Pick your way: swipe artists with a real drag (right to keep, left to skip), or flip to a photo grid and just tap everyone you'd see. Both build the same favorites.",
      "Artists have photos now — on the swipe card, the grid, the Lineup, your Plan, Now & Next and the stage map — with a clean fallback when a photo isn't available.",
      "Picking is grouped day by day with its own progress, and a clear reminder that you're building favorites — not the final plan. We solve the clashes later.",
    ],
    howToTest: [
      "Reset/first launch → type your name (email is optional, \"skip\" proceeds) → you land in the picker.",
      "Onboarding step 4 → toggle Swipe ⇆ Grid at the top; drag a card right/left in Swipe, tap photos in Grid — both add to favorites.",
      "Watch the \"Day 1 of N · %\" header and per-day sections; artist photos show on Lineup, Timetable, My Plan, Now & Next and the map's stage sheet.",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-06-24",
    title: "Find the full lineup — and never miss a change",
    icon: "splitscreen",
    whatsNew: [
      "Flip between the full Lineup and your Timetable with one tap — the lineup isn't hidden behind a tiny icon anymore.",
      "Before the schedule is out, FestPilot shows the announced lineup and tells you set times aren't released yet — instead of a blank screen.",
      "When the lineup changes, a friendly heads-up tells you what's newly added and whether any of your picks got cut, so your plan never breaks silently.",
      "Don't see your festival yet? Suggest it right from the first screen — the most-requested ones come next.",
    ],
    howToTest: [
      "Timetable or Lineup → tap the Timetable ⇆ Lineup switch at the top to flip between them in one tap.",
      "Onboarding step 1 → \"Suggest a festival\" → type a name → Send (you get a thanks confirmation).",
      "When acts are added or removed, the Timetable/Lineup shows an update banner with Review (jumps to favorites) and Dismiss.",
    ],
  },
  {
    version: "0.8.2",
    date: "2026-06-24",
    title: "A living stage map",
    icon: "map",
    whatsNew: [
      "The stage map is alive: tap any stage to see who's playing now and what's up next — and the names stay crisp and readable at every zoom level.",
      "See your real squad on the map, not strangers: friends appear by the stage they're near, plus your own 'you are here' dot.",
      "Step outside the festival and the map no longer goes blank — it tells you you're out and gives you a button straight back to the venue map.",
      "Setting a meeting point is precise now: pinch to zoom right in and drop the pin exactly where you mean, or tap 'My spot' to use your location.",
    ],
    howToTest: [
      "Map tab → tap a stage: a sheet shows now-playing + next. Pinch/scroll to zoom — the labels stay sharp, never pixelated.",
      "With no squad joined, the map shows an honest 'join a squad' state — never random people.",
      "Squad → Set a meeting point → pinch to zoom and tap to drop the pin precisely; 'My spot' drops it on your GPS.",
    ],
  },
  {
    version: "0.8.1",
    date: "2026-06-24",
    title: "Sharper days & honest clashes",
    icon: "schedule",
    whatsNew: [
      "Festival days are smarter: a 1 AM set now stays on the night it belongs to, and the timetable runs the whole night across midnight instead of stopping at 12.",
      "Late-night or oddly-labeled sets land on the right day — no more stray act showing up under the wrong one.",
      "Lock in only asks about acts that truly overlap: resolving your 4 PM slot won't offer a 9 PM act anymore, so every choice actually makes sense.",
    ],
    howToTest: [
      "Timetable → pick a day that runs past midnight: its early-morning sets show and the time axis crosses 00:00.",
      "Lock in a day with back-to-back overlaps → each step lists only the acts clashing at that time; the locked plan still has zero conflicts.",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-06-24",
    title: "Undo, share & the squad split",
    icon: "auto_awesome",
    whatsNew: [
      "Changed your mind locking in? Undo any clash pick and see exactly what you gave up — then bring it back in a tap.",
      "On the swipe screen, an Undo button takes you back to the last artist.",
      "Share your day as a gorgeous, on-brand image — made for an Instagram story or WhatsApp — pick a Story or Square format, save it, or copy it as a link.",
      "When the squad spreads across stages, a new split view shows who's where at a glance, with a one-tap \"meet up after\".",
    ],
    howToTest: [
      "Lock in → make a pick → the \"You gave up …\" bar + Undo appear (also on the celebration). Onboarding swipe → Undo.",
      "My Plan (or the Lock-in celebration) → Share → toggle Story/Square → Share image / Save / Copy link.",
      "Squad plan → open a contested block → \"See who's where\" → per-stage cards + \"Set a meet-up after\".",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-06-24",
    title: "Never lost — find your way back",
    icon: "explore",
    whatsNew: [
      "Got separated? Tap \"I'm lost\" to share your exact spot and alert the squad — they'll see where you are and come to you.",
      "A live compass points the way to any meeting point, with the walking distance and time.",
      "Back together? One tap says \"I'm okay\" and stops sharing.",
      "A new About screen with the app's story and the full update history (you're reading it).",
    ],
    howToTest: [
      "Squad → \"I'm lost\" → \"Share my location + alert squad\" → the broadcast opens; \"I'm okay\" closes it.",
      "Open a meeting point → Navigate → the arrow + distance/ETA update as you move (allow location).",
      "Settings → \"About & what's new\" (this screen).",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-06-23",
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
