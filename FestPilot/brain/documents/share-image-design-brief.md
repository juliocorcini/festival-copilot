# FestPilot — Share Image Design Brief

> **Purpose:** This document is a detailed prompt/brief for a design AI to generate the visual template for FestPilot's "Share My Plan" feature. The output should be a **static visual reference** (mockup/concept art) that will guide the code implementation of a canvas-rendered poster.

---

## 1. Context — What Is This?

FestPilot is a festival companion app. After a user builds their personal timetable (a conflict-free plan of which DJs/artists to see at a multi-stage festival), they can **share it as a branded image** — to Instagram Stories, WhatsApp, or save as PNG.

The share image is:
- Generated programmatically on a `<canvas>` (not a screenshot)
- Branded with FestPilot's visual identity
- Contains the user's real plan data (artist names, times, stages, photos)
- Designed to make recipients curious and want to use the app

---

## 2. Formats Required

Design **two versions** of the same concept:

| Format | Dimensions | Use Case |
|--------|-----------|----------|
| **Story** | 1080 × 1920 px (9:16) | Instagram Stories, WhatsApp Status |
| **Square** | 1080 × 1080 px (1:1) | Instagram Feed, WhatsApp chat, general sharing |

Both should feel like the same visual language, adapted to the ratio.

---

## 3. Brand Identity — "Amber Glass"

### Color Palette

| Token | Hex | Role |
|-------|-----|------|
| Background | `#0F0D09` | Warm near-black base |
| Panel | `#16120B` | Slightly lighter surface (for depth) |
| Accent (Amber) | `#F5A623` | Primary brand color — warm gold/amber |
| Accent 2 (Gold) | `#FFD060` | Gradient end / highlight |
| Ink (Text) | `#F5F0E6` | Primary text — warm off-white |
| Muted | `#9C9080` | Secondary text / captions |
| Purple glow | `#7C3AED` at ~12% opacity | Atmospheric depth accent |

### Design Language

- **Warm, dark, premium** — not a generic bright app; think whiskey-bar menu meets luxury event invite
- **Glass morphism** — frosted translucent panels with subtle amber glow
- **Radial light sources** — soft amber glow from top-center, subtle purple glow from bottom-right
- **Amber frame** — thin rounded border (3px, `rgba(245,166,35,0.22)`) with large radius (38px)
- **No pure white** — use warm off-white (`#F5F0E6`) for text
- **No pure black backgrounds** — use `#0F0D09` (has warm brown undertone)

### Typography

| Font | Role | Weight |
|------|------|--------|
| **Oswald** | Headlines, festival name, artist names | 700–800 |
| **Albert Sans** | Body, labels, metadata, CTA | 600–800 |

- Headlines are UPPERCASE with slight negative letter-spacing
- Labels use generous letter-spacing (tracking)
- Hierarchy through size contrast: large headlines vs. compact data rows

---

## 4. Layout Structure

### Story Format (1080 × 1920)

```
┌──────────────────────────────────┐
│  [amber frame — thin border]      │
│                                    │
│  FESTPILOT (wordmark, amber)       │  ← top area
│  Your festival, sorted. (muted)    │
│                                    │
│  ┌────────────────────────────┐   │
│  │  FESTIVAL NAME (huge)       │   │  ← headline block
│  │  DAY NAME (amber gradient)  │   │
│  └────────────────────────────┘   │
│                                    │
│  MY PLAN          8 SETS · 0 ✓    │  ← section label
│                                    │
│  ○ 14:00  DJ NAME 1               │  ← set rows (list)
│    ● Stage Name                    │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  ○ 15:30  DJ NAME 2               │
│    ● Stage Name                    │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  ○ 17:00  DJ NAME 3               │
│  ...                               │
│                                    │
│  ┌─────────────────────────┐      │
│  │  Make yours — free  (CTA)│      │  ← footer
│  └─────────────────────────┘      │
│  festpilot.pages.dev (muted)       │
│                                    │
└──────────────────────────────────┘
```

### Square Format (1080 × 1080)

Same elements, condensed:
- Smaller typography
- Fewer visible rows (paginated if needed)
- CTA pill at bottom
- Tighter spacing

---

## 5. Dynamic Content (Placeholders in the Design)

These areas contain **real user data** and should be designed as placeholders:

| Element | Example Value | Notes |
|---------|--------------|-------|
| Festival name | `TOMORROWLAND 2026` | Could be any festival; design should handle long names |
| Day name | `SATURDAY` | One of the festival's days |
| Set count | `8 SETS` | Number varies (4–15+) |
| Clash indicator | `CLASH-FREE` or `2 CLASHES` | Amber when clean, orange-red when clashes exist |
| Artist photo | Circular medallion (84px in story) | With colored-ring border; falls back to colored initials disc |
| Artist name | `MARTIN GARRIX` | Oswald, uppercase, warm white |
| Set time | `16:00` | Albert Sans, amber |
| Stage name | `Mainstage` | Small text with colored dot (stage color) |
| CTA text | `Make yours — free` | Amber-to-gold gradient pill button |
| App URL | `festpilot.pages.dev` | Muted text below CTA |

---

## 6. The Artistic Direction We Want (What to Change)

### Current State
The current poster is functional but **too utilitarian** — it looks like a data table with a dark background. It works, but it doesn't make people stop scrolling.

### Desired Direction

We want the share image to feel like:
- **A premium festival wristband or VIP pass** — something you'd proudly show
- **A concert poster** — artistic, moody, evocative
- **A personal trophy** — "look at my curated plan"

Specific enhancements desired:

1. **More atmospheric depth** — stronger radial glows, perhaps a subtle noise/grain texture overlay, maybe a faint geometric pattern (triangles/hexagons) in the background that evokes stage structures
2. **Better visual hierarchy** — the festival name should DOMINATE; the plan rows should feel like a premium tracklist
3. **Artist photos as a hero element** — instead of small circles in a list, consider: a collage/mosaic of the top 3-4 artist photos blended into the background (low opacity, cropped faces), with the structured list overlaid on top
4. **Stage colors as accent** — each row's left border or background tint could subtly carry its stage color
5. **A "vibe" gradient** — the background could transition from pure warm-black at edges to a slightly lighter amber-tinted center, creating focus
6. **Premium card feel** — imagine the whole image is a frosted glass card floating over a dark void, with edge glow

### What to Preserve
- The amber/gold/dark color system (NON-NEGOTIABLE)
- Clean readability of artist names and times
- The FESTPILOT wordmark at top
- The CTA pill at bottom
- The basic information hierarchy (festival → day → plan list → CTA)

### What NOT to Do
- Don't make it look like a generic Canva template
- Don't use bright neon colors or saturated backgrounds
- Don't add "party" clip art, confetti, or cartoon elements
- Don't obscure the text with heavy background imagery
- Don't use light/white backgrounds
- Don't deviate from the warm amber color family

---

## 7. Emotional Communication

### What the Image Should Transmit to the Viewer

1. **"This person has their festival figured out"** — organized, intentional, prepared
2. **"This app is premium and exclusive"** — the design itself should feel high-quality, not generic
3. **"I want to make mine too"** — the CTA should feel inviting, not pushy
4. **"Festival anticipation/excitement"** — warmth, energy, the glow of stage lights in the dark

### The Feeling
Imagine you're standing in the VIP area at 2AM, the main stage is lit amber and purple, bass is hitting your chest, and you look at your phone — this image should feel like THAT moment captured in a static frame.

---

## 8. Technical Constraints (for the Designer to Know)

- The final image is **rendered on HTML Canvas** (no CSS, no SVG in the export)
- Fonts available: Oswald (Google Fonts), Albert Sans (Google Fonts), Material Symbols Rounded (icons)
- Artist photos come from CDN; they may fail to load (design must work WITHOUT photos too — initials fallback)
- The plan can have 4–15+ sets; the design must scale/paginate gracefully
- No external images/textures can be bundled (everything must be drawable with canvas primitives: gradients, shapes, arcs, text)
- Colors must have enough contrast for readability on mobile screens in sunlight

---

## 9. Deliverable Expected

Please generate:
1. **One Story mockup** (1080 × 1920) with example data filled in (~8 artists)
2. **One Square mockup** (1080 × 1080) with example data filled in (~6 artists)
3. **A short annotation** explaining key design decisions and any elements that would enhance the current implementation

Use these example artists for the mockup:
- 14:00 — Martin Garrix @ Mainstage (color: `#FF5A36`)
- 15:30 — ARTBAT @ Freedom (color: `#16A34A`)
- 17:00 — Charlotte de Witte @ Core (color: `#0EA5E9`)
- 18:30 — Amelie Lens @ Cage (color: `#F59E0B`)
- 20:00 — Adam Beyer @ Elixir (color: `#7C3AED`)
- 21:30 — Nina Kraviz @ Rose Garden (color: `#EC4899`)
- 23:00 — Tale Of Us @ Mainstage (color: `#FF5A36`)
- 00:30 — Peggy Gou @ Freedom (color: `#16A34A`)

Festival: **TOMORROWLAND 2026**
Day: **SATURDAY**
Stats: **8 SETS · CLASH-FREE**

---

## 10. Reference/Inspiration Notes

- Spotify Wrapped cards (dark, personal, shareable, premium)
- Apple Music replay posters (moody, typographic)
- Festival wristband/ticket design (textured, layered)
- High-end event invitations (gold foil on dark stock)
- Nightclub event flyers (atmospheric, stage-lit, moody)

The output should be something a festival-goer would WANT to post on their story — it should feel like bragging, not spam.
