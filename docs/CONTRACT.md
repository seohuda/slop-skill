# `slop-skill` Technical Contract

This document is the **Single Source of Truth** for data schemas, module interfaces, HTML template slots, scoring rules, and file ownership across `slop-skill`.

All modules MUST run on **Node.js >= 22** using native **ESM** (`.mjs`) with **zero external runtime dependencies**.

---

## 1. Slop Intensity Levels (1–5)

`slop-skill` supports five discrete intensity levels (`level` integer `1..5`):

| Level | Label | Components | Animations | Visual & Structural Profile | Expected Slop Score |
|---:|---|---:|---|---|---|
| 1 | Subtle Slop | 2–3 | 0 (`[]`) | Light/soft neutral palette, subtle gradient, geometric font, clean centered hero & feature cards, minimal clutter | 0–50 (`Artisanal` / `Mild`) |
| 2 | Mild SaaS | 3–4 | 0–1 (optional) | Soft indigo/violet accent hints, dual CTAs, modest elevation shadows, gentle buzzwords | 25–60 (`Mild` / `Full Slop`) |
| 3 | Classic AI | 4–5 | 1 (`["float"]`) | Purple-to-blue gradient, gradient-text headline, emoji 3-column cards, sparkle pill badge, floating motion, SaaS cliché copy | 51–80 (`Full Slop`) |
| 4 | Heavy Neon | 6–7 | 2–3 (`float`, `pulse`, `hover-scale`) | Dark void backdrop, purple/blue neon glow, glassmorphism cards, fake stats, 5-star testimonials, heavy shadows | 70–92 (`Full Slop` / `Transcendent`) |
| 5 | Peak Transcendent Slop | 7–10 | 4–6 (all active) | Full dark neon void, multi-stop gradients, gradient text, blurred blobs, floating decorations, glassmorphism, emoji cards, heavy shadows, fake stats, 5-star testimonials, newsletter box, neon CTA, peak buzzword saturation | 81–100 (`Transcendent`) |

---

## 2. Common Library Item Fields

Every entry in `palettes.json`, `fonts.json`, and `components.json` MUST include:

```json
{
  "id": "purple-neon",
  "category": "color",
  "slop_weight": 8,
  "min_level": 3
}
```

### Field Constraints
- `id` (`string`, required): Unique lowercase kebab-case identifier (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`).
- `category` (`string`, required): One of `"color" | "typography" | "layout" | "effect" | "copy"`.
- `slop_weight` (`integer`, required): Relative intensity weight from `1` to `10` (inclusive). Used for weighted sampling by `deal.mjs`.
- `min_level` (`integer`, required): Minimum slop level (`1..5`) required for this item to be eligible.

---

## 3. Palette JSON Schema (`skills/slop-skill/library/palettes.json`)

Top-level JSON **array** of Palette objects (minimum **10** palettes spanning `min_level` 1 through 5).

```json
{
  "id": "purple-neon",
  "name": "Purple Neon",
  "category": "color",
  "slop_weight": 9,
  "min_level": 3,
  "tokens": {
    "bg": "#09051A",
    "surface": "rgba(255, 255, 255, 0.06)",
    "fg": "#FFFFFF",
    "muted": "#A5B4FC",
    "accent1": "#8B5CF6",
    "accent2": "#3B82F6",
    "border": "rgba(139, 92, 246, 0.35)",
    "glow": "rgba(139, 92, 246, 0.55)"
  },
  "gradient": "linear-gradient(135deg, #8B5CF6, #3B82F6)"
}
```

### Required Fields
- Common fields (`id`, `category: "color"`, `slop_weight`, `min_level`)
- `name` (`string`): Human-readable palette name.
- `tokens` (`object`): CSS color tokens.
  - Required keys: `bg`, `fg`, `accent1`, `accent2` (non-empty strings).
  - Optional keys: `surface`, `muted`, `border`, `glow`, `accent3` (non-empty strings).
- `gradient` (`string`): Non-empty CSS gradient value (`linear-gradient(...)`, `radial-gradient(...)`, or `conic-gradient(...)`).

### Level Distribution Guideline
- Include at least 2 palettes at `min_level: 1` (clean light/soft surfaces, restrained subtle gradients, NO dark neon void).
- Include palettes across `min_level: 2`, `3`, `4`, and `5`, escalating to deep obsidian backgrounds (`#09051A`, `#030712`, `#0F172A`) with purple/blue/cyan/magenta neon glows.

---

## 4. Font JSON Schema (`skills/slop-skill/library/fonts.json`)

Top-level JSON **array** of Font Pairing objects (minimum **6** pairings).

```json
{
  "id": "inter-poppins",
  "name": "Inter & Poppins",
  "category": "typography",
  "slop_weight": 6,
  "min_level": 1,
  "heading": "Poppins",
  "body": "Inter",
  "googleFontsUrl": "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@600;700;800&display=swap"
}
```

### Required Fields
- Common fields (`id`, `category: "typography"`, `slop_weight`, `min_level`)
- `heading` (`string`): Display/heading font family name.
- `body` (`string`): Body copy font family name.
- `googleFontsUrl` (`string`): Valid `https://fonts.googleapis.com/...` stylesheet URL.
- `name` (`string`, optional): Display label for the pairing.

---

## 5. Copy JSON Schema (`skills/slop-skill/library/copy.json`)

Top-level JSON **object** containing six copy pools (minimum **12** entries in each array):

```json
{
  "hero_headlines": [
    "Revolutionize Your Workflow with Next-Gen AI"
  ],
  "subheads": [
    "Unlock the power of autonomous intelligence and seamlessly elevate your experience to the next level."
  ],
  "ctas": [
    "Get Started Free"
  ],
  "feature_titles": [
    "Lightning-Fast AI Automation"
  ],
  "testimonials": [
    {
      "quote": "This platform completely revolutionized our workflow and supercharged our team's productivity.",
      "author": "Sarah Chen",
      "role": "VP of Engineering, TechFlow",
      "rating": 5
    }
  ],
  "fake_stats": [
    {
      "value": "10K+",
      "label": "Active Users"
    }
  ]
}
```

### Required Fields
- `hero_headlines`: `string[]` (length >= 12, non-empty strings)
- `subheads`: `string[]` (length >= 12, non-empty strings)
- `ctas`: `string[]` (length >= 12, non-empty strings)
- `feature_titles`: `string[]` (length >= 12, non-empty strings)
- `testimonials`: array (length >= 12) of `{ quote: string, author: string, role: string, rating: integer (1..5) }`
- `fake_stats`: array (length >= 12) of `{ value: string, label: string }`

---

## 6. Component JSON Schema (`skills/slop-skill/library/components.json`)

Top-level JSON **array** of Component objects (minimum **10** components; recommended **14** to cover Levels 1–5 cleanly).

```json
{
  "id": "glass-feature-card",
  "name": "Glassmorphism Feature Cards",
  "category": "layout",
  "slop_weight": 8,
  "min_level": 3,
  "slot": "features",
  "html": "<section class=\"slop-section slop-glass-features\">...</section>",
  "css": ".slop-glass-card { backdrop-filter: blur(16px); ... }"
}
```

### Required Fields
- Common fields (`id`, `category`, `slop_weight`, `min_level`)
- `slot` (`string`): Target HTML slot name. Must be one of:
  `head | tokens | hero | features | stats | testimonials | cta | footer | extra`
- `html` (`string`): Non-empty, self-contained HTML fragment safe to insert directly into `slot`.
- `css` (`string`): Scoped CSS string (may be `""` if no custom styles are needed).
- `name` (`string`, optional): Display label.
- `description` (`string`, optional): Brief description of the component.

### Copy Placeholders Supported in Component HTML
Components MAY embed the following Mustache-style placeholders, which `assemble.mjs` replaces with HTML-escaped values from `deal.copy`:

- `{{brand}}`
- `{{badge}}`
- `{{hero_headline}}`
- `{{subhead}}`
- `{{primary_cta}}`
- `{{secondary_cta}}`
- `{{feature_0_title}}`, `{{feature_1_title}}`, `{{feature_2_title}}`
- `{{feature_0_emoji}}`, `{{feature_1_emoji}}`, `{{feature_2_emoji}}`
- `{{stat_0_value}}`, `{{stat_0_label}}` ... `{{stat_3_value}}`, `{{stat_3_label}}`
- `{{testimonial_0_quote}}`, `{{testimonial_0_author}}`, `{{testimonial_0_role}}` ... `{{testimonial_2_*}}`

Components MUST remain valid, unbroken HTML even when rendered independently in their target slot.

### Clean Isolation Invariant (Critical for Score Calibration)
- Components with `min_level: 1` MUST NOT include heavy Level 4–5 tropes (no dark purple neon glow, no glassmorphism `backdrop-filter: blur`, no `@keyframes float`/`pulse`, no emojis, no fake `10K+` stats, no 5-star testimonials).
- Higher-level tropes (`gradient-text`, `backdrop-filter`, neon glow shadows, emoji cards, fake stats, 5-star testimonials, drifting blobs, floating sparkles, `scale(1.05)` hover) belong in `min_level >= 3` components and `deal.animations`.

---

## 7. `deal.mjs` CLI & Output Schema

### CLI Interface
```bash
node skills/slop-skill/scripts/deal.mjs --level <1-5> [--seed <integer>] [--page <page>] [--brand <name>] [--library <dir>]
```

- `--level <1-5>`: Slop intensity level (default `3`; non-integer or out-of-range exits with code `1`).
- `--seed <integer>`: Deterministic integer seed for Mulberry32 PRNG (default `42` if omitted or explicit integer; non-integer exits with code `1`).
- `--page <string>`: Target page archetype (`landing`, `saas`, `portfolio`, `pricing`; default `landing`).
- `--brand <string>`: Optional brand name injected into `copy.brand` (default `"NovaFlow AI"`).
- `--library <dir>`: Optional path to library JSON directory (defaults via `import.meta.url` to `../../library`).

### Output JSON Schema (stdout)
```json
{
  "seed": 42,
  "level": 4,
  "page": "landing",
  "palette": { "...Palette object..." },
  "font": { "...Font object..." },
  "copy": {
    "brand": "NovaFlow AI",
    "badge": "✨ Powered by Next-Gen AI",
    "hero_headline": "Revolutionize Your Workflow with Next-Gen AI",
    "subhead": "Unlock the power of autonomous intelligence and seamlessly elevate your experience.",
    "primary_cta": "Get Started Free",
    "secondary_cta": "Watch Demo",
    "features": [
      { "emoji": "🚀", "title": "Lightning-Fast AI Automation" },
      { "emoji": "⚡", "title": "Seamless Cloud Integration" },
      { "emoji": "🧠", "title": "Autonomous Smart Analytics" }
    ],
    "stats": [
      { "value": "10K+", "label": "Active Users" },
      { "value": "99.9%", "label": "Uptime SLA" },
      { "value": "500M+", "label": "Tasks Automated" },
      { "value": "4.9/5", "label": "Customer Rating" }
    ],
    "testimonials": [
      {
        "quote": "...",
        "author": "Sarah Chen",
        "role": "VP of Engineering, TechFlow",
        "rating": 5
      }
    ]
  },
  "components": [
    { "...Component object..." }
  ],
  "animations": ["float", "pulse", "hover-scale"]
}
```

### Selection Rules
1. **Deterministic PRNG:** Uses Mulberry32 (`skills/slop-skill/scripts/lib/prng.mjs`). Identical `(seed, level, page, brand, library)` produces byte-identical JSON output.
2. **Eligibility Filter:** Only items with `item.min_level <= level` are eligible. At `level === 1`, prefer items with `min_level === 1`; at higher levels (`level >= 4`), bias weighted sampling toward higher `slop_weight` and higher `min_level` items so Level 4–5 reliably select dark neon palettes and peak slop components.
3. **Component Slot Budget:**
   - Select at most **1** `hero` component (always select 1 `hero` if any eligible `hero` component exists).
   - Target component counts per level (capped by available non-duplicate-hero eligible components):
     - Level 1: `2–3` components
     - Level 2: `3–4` components
     - Level 3: `4–5` components
     - Level 4: `6–7` components
     - Level 5: `7–10` components (at least 7 when library supplies them; prefer covering every distinct slot: `hero`, `features`, `stats`, `testimonials`, `cta`, `extra`)
4. **Animations (`VALID_ANIMATIONS`):**
   Allowed IDs: `"float"`, `"pulse"`, `"blob-drift"`, `"gradient-shift"`, `"hover-scale"`, `"neon-glow-pulse"`.
   - Level 1: `[]`
   - Level 2: `0–1` (`[]` or `["hover-scale"]`)
   - Level 3: `["float"]`
   - Level 4: `2–3` (includes `"float"`, `"pulse"`, and optionally `"hover-scale"`)
   - Level 5: `4–6` (all active animations, including `"float"`, `"pulse"`, `"blob-drift"`, `"gradient-shift"`, `"hover-scale"`, `"neon-glow-pulse"`)

---

## 8. `starter.html` Slots & `assemble.mjs` Interface

Canonical asset location (self-contained inside the skill package; no duplicate top-level copies):
- `skills/slop-skill/assets/starter.html`
- `skills/slop-skill/assets/system.css`

### Required Slot Markers in `starter.html`
Exactly 9 named slots using the marker format `<!-- SLOT:<name> -->`:

| Slot | Location | Populated By |
|---|---|---|
| `head` | Inside `<head>` | Google Fonts `<link>` tag + any `head`-slot components |
| `tokens` | Inside `<head>` (`<style id="slop-tokens">`) | `:root` CSS custom properties from `deal.palette` & `deal.font`, component CSS, and active animation CSS from `deal.animations` |
| `hero` | First section of `<main>` | `hero`-slot component(s) |
| `features` | Inside `<main>` | `features`-slot component(s) |
| `stats` | Inside `<main>` | `stats`-slot component(s) |
| `testimonials` | Inside `<main>` | `testimonials`-slot component(s) |
| `cta` | Inside `<main>` | `cta`-slot component(s) |
| `footer` | Inside `<footer>` | Optional `footer`-slot component(s) alongside default footer |
| `extra` | Inside `<body>` | Ambient/background elements (`blob-background`, `floating-decorations`) |

### Generated `:root` CSS Variables
From `deal.palette` and `deal.font`, `assemble.mjs` generates:
```css
:root {
  --slop-bg: <palette.tokens.bg>;
  --slop-fg: <palette.tokens.fg>;
  --slop-accent1: <palette.tokens.accent1>;
  --slop-accent2: <palette.tokens.accent2>;
  --slop-surface: <palette.tokens.surface or fallback>;
  --slop-muted: <palette.tokens.muted or fallback>;
  --slop-border: <palette.tokens.border or fallback>;
  --slop-glow: <palette.tokens.glow or fallback>;
  --slop-gradient: <palette.gradient>;
  --slop-font-heading: '<font.heading>', system-ui, sans-serif;
  --slop-font-body: '<font.body>', system-ui, sans-serif;
}
```
Any additional keys in `palette.tokens` are emitted as `--slop-<key>`.

### CLI Interface (`assemble.mjs`)
```bash
node skills/slop-skill/scripts/assemble.mjs --deal <path|-> [--output <path>] [--template <path>] [--css <path>]
```
- `--deal <path>`: Path to deal JSON file. If omitted or `-`, reads JSON from `stdin`.
- `--output <path>`: Output HTML file path (creates parent directories automatically). If omitted, writes HTML to `stdout`.
- Validates input deal JSON via `validateDealOutput` before rendering; exits with code `1` and clear stderr error on invalid JSON or schema failure.
- Escapes copy values (`&`, `<`, `>`, `"`, `'`) and sanitizes CSS token values before injection to prevent malformed HTML/CSS.
- Removes ALL unused `<!-- SLOT:... -->` markers so zero slot comments remain in the output HTML.
- Emits animation CSS ONLY for animation IDs listed in `deal.animations` (never hardcodes Level 4–5 effects into `system.css` globally).

---

## 9. `slop-meter.mjs` & Rule Schema

### Rule File Format (`skills/slop-skill/scripts/rules/*.json`)
Rules are stored in JSON files under `skills/slop-skill/scripts/rules/` (minimum **30** total rules across all 5 categories: `color`, `typography`, `layout`, `effect`, `copy`).

```json
{
  "id": "purple-gradient",
  "name": "Purple gradient",
  "category": "color",
  "weight": 8,
  "type": "regex",
  "pattern": "linear-gradient\\([^)]*(?:#8b5cf6|#7c3aed|#a855f7|#9333ea|#6366f1|purple|violet)",
  "flags": "i",
  "min": 1,
  "description": "Uses a purple or violet linear gradient"
}
```

### Field Constraints (`validateRule`)
- `id` (`string`, required): Unique lowercase kebab-case identifier.
- `name` (`string`, optional): Concise human-readable display label for CLI output (defaults to `description` or `id` if omitted).
- `category` (`string`, required): `"color" | "typography" | "layout" | "effect" | "copy"`.
- `weight` (`integer`, required): Positive integer `1..10`.
- `type` (`string`, required): `"regex" | "count" | "computed"`.
  - `regex`: Tests regular expression `pattern` (with `flags`, default `"i"`). Passes when match count >= `min` (default `1`).
  - `count`: Counts matches of regular expression `pattern` (ensuring `g` flag). Passes when match count >= `min` (required >= `1`).
  - `computed`: Evaluates a zero-dependency built-in heuristic named in `check` (or `pattern`), using `min` as threshold where applicable.
- `pattern` (`string`): Required non-empty valid regex pattern for `regex` and `count`; for `computed`, either `check` or `pattern` must name a heuristic.
- `flags` (`string`, optional): Valid JavaScript `RegExp` flags subset of `[gimsuy]`.
- `min` (`integer`, optional): Positive integer `>= 1` (default `1`).
- `description` (`string`, required): Non-empty explanation of the rule.

### Scoring Formula & Grades
```text
Slop Score = Math.round((matchedWeightSum / totalWeightSum) * 100)
```

| Score Range | Grade |
|---:|---|
| 0–25 | `Artisanal` |
| 26–50 | `Mild` |
| 51–80 | `Full Slop` |
| 81–100 | `Transcendent` |

### CLI Interface
```bash
node skills/slop-skill/scripts/slop-meter.mjs <html-file> [--min <0-100>] [--json] [--rules <dir>]
```
- Text output format:
  ```text
  Slop Meter

  [PASS] Purple gradient
  [PASS] Glassmorphism
  [FAIL] Fake statistics
  ...

  Score: 87/100
  Grade: Transcendent
  ```
- `--min <N>`: Exits with code `1` if `score < N`, otherwise `0`.
- `--json`: Prints structured JSON `{ file, score, grade, matchedWeight, totalWeight, passedCount, totalRules, categories, results }`.

---

## 10. File Ownership Matrix

Each Wave 1 worker owns ONLY the paths listed below and MUST NOT modify `docs/CONTRACT.md` or any file outside its scope:

| Worker | Branch | Owned Paths |
|---|---|---|
| **W1 — Library** | `w1-library` | `skills/slop-skill/library/palettes.json`, `skills/slop-skill/library/fonts.json`, `skills/slop-skill/library/copy.json`, `skills/slop-skill/library/components.json` |
| **W2 — Dealer** | `w2-deal` | `skills/slop-skill/scripts/deal.mjs`, `skills/slop-skill/scripts/lib/prng.mjs`, `tests/deal.test.mjs`, `tests/fixtures/mini-library/**` |
| **W3 — Assemble** | `w3-assemble` | `skills/slop-skill/assets/starter.html`, `skills/slop-skill/assets/system.css`, `skills/slop-skill/scripts/assemble.mjs`, `tests/assemble.test.mjs`, `tests/fixtures/sample-deal.json` |
| **W4 — Slop Meter** | `w4-meter` | `skills/slop-skill/scripts/slop-meter.mjs`, `skills/slop-skill/scripts/rules/**`, `tests/meter.test.mjs`, `tests/fixtures/slop.html`, `tests/fixtures/clean.html` |
| **W5 — Packaging** | `w5-packaging` | `README.md`, `CHANGELOG.md`, `.claude-plugin/**`, `install.sh`, `package.json` |
| **Coordinator** | `main` | `.gitignore`, `LICENSE`, `docs/**`, `skills/slop-skill/library/schema.mjs`, `tests/schema.test.mjs`, `skills/slop-skill/SKILL.md`, `tests/e2e.test.mjs`, `examples/**` |
