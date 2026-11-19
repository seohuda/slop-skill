---
name: slop-skill
description: >-
  Intentionally reproduce calibrated AI slop web design (Levels 1 to 5) using a
  seeded design library, slot-based HTML/CSS assembler, and 34-rule Slop Meter.
  Trigger on requests such as: "AI slop 디자인을 만들어줘", "일부러 AI스럽게 만들어줘",
  "전형적인 AI 랜딩페이지 만들어줘", "슬롭 강도 5로 디자인해줘",
  "일부러 ChatGPT가 만든 것처럼 만들어줘", "Make this look like AI slop",
  or any request asking for intentional generic AI SaaS landing page aesthetics
  or Slop Score auditing.
---

# slop-skill — Intentional AI Slop Design System

Use this skill whenever the user explicitly asks for **AI slop** web design—purple-to-blue gradients, dark neon voids, frosted glassmorphism cards, floating badges, emoji feature grids, fake `10K+` statistics, 5-star testimonials, and peak SaaS buzzword copy—calibrated cleanly from **Level 1** to **Level 5**.

> **Skill Directory Note:** All script paths below are relative to this `slop-skill` directory (`scripts/deal.mjs`, `scripts/assemble.mjs`, `scripts/slop-meter.mjs`). Every script resolves its own `library/`, `assets/`, and `scripts/rules/` paths via `import.meta.url`, so commands work identically from any working directory.

---

## Core Commitment (Non-Negotiable Rules)

1. **Do NOT silently "fix" or improve the design.** When a user asks for intentional AI slop, never compromise toward understated editorial minimalism, Swiss restraint, or genuine good taste.
2. **Respect the requested intensity level faithfully.**
   - **Level 1 (Subtle Slop, target score ≤ 50):** Clean light/soft palette, geometric sans (`Inter`/`Poppins`), centered hero, clean cards, zero animations.
   - **Level 2 (Mild SaaS, target score 26–60):** Light indigo/lavender tints, dual CTAs, modest shadows, optional hover scale.
   - **Level 3 (Classic AI, target score 51–80):** Purple-to-blue gradients, gradient-text hero, emoji 3-column cards, sparkle pill badge, `float` animation, classic SaaS cliché copy.
   - **Level 4 (Heavy Neon, target score 70–92):** Dark void backdrop, purple/blue neon glow, glassmorphism cards, fake statistics strip, 5-star testimonials, multiple animations.
   - **Level 5 (Peak Transcendent Slop, target score ≥ 81):** Full dark neon void, multi-stop gradients, gradient-text headline, drifting blurred blobs, floating sparkles/dot-grid, glassmorphism, emoji cards, heavy neon shadows, fake stats, 5-star testimonials, glowing waitlist box, neon CTA, full animation stack, and saturated buzzword copy.
3. **Preserve real functionality and usability.** Intentional slop is an aesthetic commitment, NOT broken engineering:
   - Reflect the user's actual product name, value proposition, sections, and links.
   - Keep semantic HTML5 landmarks (`<header>`, `<main>`, `<section>`, `<footer>`), readable foreground contrast, accessible form labels, keyboard focus rings, and responsive mobile/desktop layout without horizontal overflow.
   - Clearly label synthetic demo statistics or testimonials as fictional/sample when producing showcase prototypes.

---

## Standard 11-Step Execution Workflow

Follow these steps in order every time this skill activates:

### Step 1: Identify User Brief & Page Archetype
Extract the target page type (`landing`, `saas`, `portfolio`, or `pricing`), product/brand name, key user-provided sections/features, and output file path.

### Step 2: Determine Slop Intensity Level & Seed
- Map the user's phrasing to `level` `1..5` (default `3` if unspecified; map phrases like "풀 슬롭", "최대 강도", "슬롭 강도 5", "peak AI slop" to `5`).
- Choose an integer `--seed` (use the user's seed if provided, otherwise default `42` for reproducibility).

### Step 3: Deal a Design Specification (`deal.mjs`)
Run the deterministic dealer script to draw a schema-validated palette, Google Font pairing, copy pool selection, slot-diverse components, and animation stack:

```bash
node <skill-dir>/scripts/deal.mjs \
  --level <1-5> \
  --seed <integer> \
  --page <landing|saas|portfolio|pricing> \
  --brand "<Brand Name>" \
  > deal.json
```

### Step 4: Inspect the Dealt Elements
Review `deal.json` to confirm:
- `palette` (color tokens + CSS gradient) matches the requested level
- `font` (`heading`, `body`, `googleFontsUrl`)
- `components` cover the expected HTML slots (`hero`, `features`, `stats`, `testimonials`, `cta`, `extra`)
- `animations` match the level budget (`[]` at Level 1 up to all 6 animations at Level 5)

### Step 5: Adapt Copy & Details to the User's Real Brief
Customize `deal.copy` (or component fragments if custom sections were requested) so the page genuinely represents the user's product, domain, and features—**while preserving the target level's slop voice** (e.g., weaving in *"Revolutionize your workflow"*, *"Unlock the power of"*, *"Seamlessly"*, *"Supercharge"*, *"Elevate your experience"*, and *"next level"* at Levels 3–5).

### Step 6: Prepare HTML & CSS Within the 9-Slot Contract
Ensure any customized deal JSON remains valid against `library/schema.mjs` and respects the 9 canonical template slots (`head`, `tokens`, `hero`, `features`, `stats`, `testimonials`, `cta`, `footer`, `extra`). Do NOT inject high-level CSS effects manually into a Level 1 build.

### Step 7: Assemble the Standalone HTML Page (`assemble.mjs`)
Run the assembler to emit a self-contained, responsive HTML5 document with `:root` tokens, Google Fonts, scoped component CSS, active animation keyframes, and zero leftover `<!-- SLOT:... -->` markers:

```bash
node <skill-dir>/scripts/assemble.mjs \
  --deal deal.json \
  --output out/index.html
```

(You may also pipe `deal.mjs` directly into `assemble.mjs --deal - --output out/index.html` when no manual copy edits are needed.)

### Step 8: Measure with the Slop Meter (`slop-meter.mjs`)
Run the 34-rule auditor against the assembled HTML:

```bash
node <skill-dir>/scripts/slop-meter.mjs out/index.html --min <target-min>
```

Recommended `--min` thresholds:
- Level 5: `--min 81` (`Transcendent`)
- Level 4: `--min 70`
- Level 3: `--min 51` (`Full Slop`)
- Level 2: `--min 26` (`Mild`)
- Level 1: inspect without `--min` and verify `score <= 50`

Use `--json` when you want structured category breakdowns and per-rule diagnostics.

### Step 9: Evaluate Score & Failed Rules
Inspect the `[PASS]` / `[FAIL]` breakdown. Check whether the score aligns with the requested intensity band (`Artisanal` 0–25, `Mild` 26–50, `Full Slop` 51–80, `Transcendent` 81–100).

### Step 10: Reinforce Missing Tropes (Maximum 3 Iterations)
If the Slop Score falls below the target threshold for the requested level:
1. Pick the highest-weight `[FAIL]` rules appropriate for that level (e.g., missing `glassmorphism`, `blob-background`, `fake-statistics`, `star-testimonials`, `gradient-text-headline`, `float-animation`, or missing cliché copy phrases).
2. Add or reinforce those elements in the deal/HTML.
3. Re-assemble (if modifying `deal.json`) and re-run `slop-meter.mjs`.
4. Stop as soon as the target band is satisfied or after **at most 3 reinforcement passes**.

### Step 11: Deliver Final Output
Present the final generated file path(s) to the user along with:
- Selected Slop Level (`1–5`) and Seed
- Selected palette, font pairing, component list, and animations
- Verified **Slop Score** (`X/100`) and **Grade** (`Artisanal` / `Mild` / `Full Slop` / `Transcendent`)

---

## Quick Reference: CLI Pipeline

```bash
# One-liner Level 5 peak slop generation & audit
node <skill-dir>/scripts/deal.mjs --level 5 --seed 42 --brand "NovaFlow AI" \
  | node <skill-dir>/scripts/assemble.mjs --deal - --output out/index.html \
  && node <skill-dir>/scripts/slop-meter.mjs out/index.html --min 81
```

## Reference Files in This Skill

- `library/schema.mjs` — Zero-dependency runtime schema validators
- `library/palettes.json` — 12 curated color palettes spanning Levels 1–5
- `library/fonts.json` — 8 Google Fonts display/body pairings
- `library/copy.json` — 6 buzzword-calibrated copy pools (15 entries each)
- `library/components.json` — 14 standalone responsive HTML/CSS components
- `assets/starter.html` & `assets/system.css` — 9-slot HTML5 template and trope-isolated baseline CSS
- `scripts/rules/*.json` — 34 weighted Slop Meter rules across 5 categories
