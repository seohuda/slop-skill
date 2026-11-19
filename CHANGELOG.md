# Changelog

All notable changes to `slop-skill` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-20

### Added

- **Documentation & Specification**
  - [Anatomy of AI Slop Design](docs/slop-anatomy.md) cataloging the visual, typographic, layout, motion, and copywriting tropes of statistical AI mediocrity.
  - [Technical Contract](docs/CONTRACT.md) defining the 5-level intensity spectrum, JSON schemas, CLI interfaces, HTML slot markers, and scoring rules.
- **Design Library & Schema Validation**
  - Zero-dependency Node.js ESM schema validator (`skills/slop-skill/library/schema.mjs`) and unit test suite (`tests/schema.test.mjs`).
  - Curated design libraries (`palettes.json`, `fonts.json`, `copy.json`, `components.json`) stratified across `min_level` 1 through 5.
- **Deterministic CLI Pipeline**
  - Seeded design dealer (`skills/slop-skill/scripts/deal.mjs`) using a Mulberry32 PRNG (`skills/slop-skill/scripts/lib/prng.mjs`) for reproducible `(seed, level, page, brand)` output.
  - Slot-based HTML/CSS assembler (`skills/slop-skill/scripts/assemble.mjs`) with canonical 9-slot starter template (`skills/slop-skill/assets/starter.html`) and base system styles (`skills/slop-skill/assets/system.css`).
- **Slop Meter Auditing Engine**
  - Scoring CLI (`skills/slop-skill/scripts/slop-meter.mjs`) with 34 JSON detection rules (`skills/slop-skill/scripts/rules/*.json`) spanning `color`, `typography`, `layout`, `effect`, and `copy`, supporting `--min` threshold gating and `--json` output.
- **Examples & End-to-End Verification**
  - Deterministic showcase builds (`examples/level-1/`, `examples/level-3/`, `examples/level-5/`) using `--seed 127` with verified Slop Meter scores (`19/100`, `76/100`, `97/100`) and headless Chrome screenshots.
  - Full `node:test` unit and end-to-end test suites (`tests/schema.test.mjs`, `tests/deal.test.mjs`, `tests/assemble.test.mjs`, `tests/meter.test.mjs`, `tests/e2e.test.mjs`).
- **Agent Skill & Plugin Packaging**
  - Claude Skill definition (`skills/slop-skill/SKILL.md`), Claude Code plugin and marketplace manifests (`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`), safe local symlink installer (`install.sh`), and Node.js >= 22 ESM `package.json`.
