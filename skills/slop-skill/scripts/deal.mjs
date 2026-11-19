#!/usr/bin/env node
/**
 * Seeded Design Dealer for slop-skill.
 * Deterministically deals a palette, font pairing, copy set, components, and animations
 * based on intensity level (1..5), integer seed, page archetype, and brand name.
 *
 * Single source of truth: docs/CONTRACT.md
 * Zero external runtime dependencies (Node.js >= 22 ESM).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  createPrng,
  pick,
  weightedPick,
  weightedSampleWithoutReplacement,
  shuffle,
  randInt,
} from './lib/prng.mjs';
import {
  HTML_SLOTS,
  VALID_ANIMATIONS,
  VALID_PAGES,
  validateLibraryItem,
  validateCopyLibrary,
  validateDealOutput,
  assertValid,
} from '../library/schema.mjs';

export const DEFAULT_LIBRARY_DIR = fileURLToPath(new URL('../library', import.meta.url));
export const DEFAULT_LEVEL = 3;
export const DEFAULT_SEED = 42;
export const DEFAULT_PAGE = 'landing';
export const DEFAULT_BRAND = 'NovaFlow AI';

const FEATURE_EMOJIS = Object.freeze(['🚀', '⚡', '🧠', '✨', '🔥', '💎']);
const MILD_BADGES = Object.freeze([
  'New Release',
  'v2.0 Platform',
  'Built for Modern Teams',
  'Cloud Ready',
]);
const SPARKLE_AI_BADGE = '✨ Powered by Next-Gen AI';

const COMPONENT_BUDGETS = Object.freeze({
  1: [2, 3],
  2: [3, 4],
  3: [4, 5],
  4: [6, 7],
  5: [8, 10],
});

const NON_HERO_SLOT_PRIORITY = Object.freeze([
  'features',
  'stats',
  'testimonials',
  'cta',
  'extra',
  'footer',
  'head',
  'tokens',
]);

const BUZZWORD_RE =
  /\b(?:ai|next-gen|revolutionize|supercharge|autonomous|seamless|seamlessly|elevate|unlock|transform|quantum|hyper|synergy|disrupt|10x|instant|intelligent|smart|powered)\b/gi;

const STRICT_INT_RE = /^[+-]?\d+$/;

/**
 * Format CLI usage help text.
 * @returns {string}
 */
export function formatUsage() {
  return [
    'Usage: node skills/slop-skill/scripts/deal.mjs [options]',
    '',
    'Options:',
    `  --level <1-5>        Slop intensity level 1..5 (default: ${DEFAULT_LEVEL})`,
    `  --seed <integer>     Deterministic integer seed for Mulberry32 PRNG (default: ${DEFAULT_SEED})`,
    `  --page <archetype>   Page archetype: ${VALID_PAGES.join(', ')} (default: ${DEFAULT_PAGE})`,
    `  --brand <name>       Brand name injected into copy.brand (default: "${DEFAULT_BRAND}")`,
    '  --library <dir>      Directory containing palettes.json, fonts.json, copy.json, components.json',
    '  -h, --help           Show this help message and exit',
  ].join('\n');
}

function parseStrictInt(raw, flagName) {
  if (typeof raw !== 'string' || !STRICT_INT_RE.test(raw.trim())) {
    throw new Error(`Invalid ${flagName} value "${String(raw)}": expected an integer`);
  }
  const value = Number(raw.trim());
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Invalid ${flagName} value "${raw}": integer out of safe range`);
  }
  return value;
}

/**
 * Parse and strictly validate CLI arguments.
 * @param {string[]} argv
 * @returns {{ help: boolean, level: number, seed: number, page: string, brand: string, libraryDir: string }}
 */
export function parseCliArgs(argv) {
  const result = {
    help: false,
    level: DEFAULT_LEVEL,
    seed: DEFAULT_SEED,
    page: DEFAULT_PAGE,
    brand: DEFAULT_BRAND,
    libraryDir: DEFAULT_LIBRARY_DIR,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === '-h' || token === '--help') {
      result.help = true;
      continue;
    }

    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument "${token}". Use --help for usage.`);
    }

    const eqIdx = token.indexOf('=');
    const flag = eqIdx === -1 ? token : token.slice(0, eqIdx);
    let value;

    const readValue = () => {
      if (eqIdx !== -1) {
        return token.slice(eqIdx + 1);
      }
      if (i + 1 >= argv.length) {
        throw new Error(`Missing value for ${flag}`);
      }
      i += 1;
      return argv[i];
    };

    switch (flag) {
      case '--level': {
        value = readValue();
        const level = parseStrictInt(value, '--level');
        if (level < 1 || level > 5) {
          throw new Error(`Invalid --level value "${value}": must be an integer between 1 and 5`);
        }
        result.level = level;
        break;
      }
      case '--seed': {
        value = readValue();
        result.seed = parseStrictInt(value, '--seed');
        break;
      }
      case '--page': {
        value = readValue();
        if (!VALID_PAGES.includes(value)) {
          throw new Error(
            `Invalid --page value "${value}": must be one of ${VALID_PAGES.join(', ')}`
          );
        }
        result.page = value;
        break;
      }
      case '--brand': {
        value = readValue();
        if (typeof value !== 'string' || value.trim().length === 0) {
          throw new Error('Invalid --brand value: must be a non-empty string');
        }
        result.brand = value.trim();
        break;
      }
      case '--library': {
        value = readValue();
        if (typeof value !== 'string' || value.trim().length === 0) {
          throw new Error('Invalid --library value: must be a non-empty directory path');
        }
        result.libraryDir = path.resolve(value);
        break;
      }
      default:
        throw new Error(`Unknown option "${flag}". Use --help for usage.`);
    }
  }

  return result;
}

function readJsonFile(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read library file "${filePath}": ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse JSON in "${filePath}": ${err.message}`);
  }
}

/**
 * Load and schema-validate a slop-skill library directory.
 * @param {string} [libraryDir]
 * @returns {{ palettes: object[], fonts: object[], copy: object, components: object[] }}
 */
export function loadLibrary(libraryDir = DEFAULT_LIBRARY_DIR) {
  const resolvedDir = path.resolve(libraryDir);
  const palettes = readJsonFile(path.join(resolvedDir, 'palettes.json'));
  const fonts = readJsonFile(path.join(resolvedDir, 'fonts.json'));
  const copy = readJsonFile(path.join(resolvedDir, 'copy.json'));
  const components = readJsonFile(path.join(resolvedDir, 'components.json'));

  if (!Array.isArray(palettes) || palettes.length === 0) {
    throw new Error('palettes.json must contain a non-empty JSON array');
  }
  palettes.forEach((p, idx) => {
    assertValid(validateLibraryItem(p, 'palette'), `palettes[${idx}]`);
  });

  if (!Array.isArray(fonts) || fonts.length === 0) {
    throw new Error('fonts.json must contain a non-empty JSON array');
  }
  fonts.forEach((f, idx) => {
    assertValid(validateLibraryItem(f, 'font'), `fonts[${idx}]`);
  });

  assertValid(validateCopyLibrary(copy, { minItems: 1 }), 'copy.json');

  if (!Array.isArray(components) || components.length === 0) {
    throw new Error('components.json must contain a non-empty JSON array');
  }
  components.forEach((c, idx) => {
    assertValid(validateLibraryItem(c, 'component'), `components[${idx}]`);
  });

  return { palettes, fonts, copy, components };
}

/**
 * Compute level-aware effective sampling weight for a library item.
 * At equal min_level, weight is strictly proportional to slop_weight.
 * At higher levels, items with higher min_level receive an escalating boost.
 * @param {{ slop_weight: number, min_level: number }} item
 * @param {number} level
 * @returns {number}
 */
export function effectiveWeight(item, level) {
  return item.slop_weight * (1 + (item.min_level / 5) * (level - 1));
}

function copyWeight(text, level) {
  if (level < 5) return 1;
  const matches = String(text).match(BUZZWORD_RE);
  return 1 + (matches ? matches.length * 2 : 0);
}

function sampleWithFallback(rng, items, count, weightFn) {
  const chosen = weightedSampleWithoutReplacement(rng, items, count, weightFn);
  while (chosen.length < count && items.length > 0) {
    chosen.push(weightedPick(rng, items, weightFn));
  }
  return chosen;
}

function selectPalette(rng, palettes, level) {
  const eligible = palettes.filter((p) => p.min_level <= level);
  if (eligible.length === 0) {
    throw new Error(`No eligible palettes found for level ${level}`);
  }
  const preferred = level >= 4 ? eligible.filter((p) => p.min_level >= 3) : eligible;
  const pool = preferred.length > 0 ? preferred : eligible;
  return weightedPick(rng, pool, (p) => effectiveWeight(p, level));
}

function selectFont(rng, fonts, level) {
  const eligible = fonts.filter((f) => f.min_level <= level);
  if (eligible.length === 0) {
    throw new Error(`No eligible fonts found for level ${level}`);
  }
  return weightedPick(rng, eligible, (f) => effectiveWeight(f, level));
}

function selectComponents(rng, components, level) {
  const eligible = components.filter((c) => c.min_level <= level);
  if (eligible.length === 0) {
    throw new Error(`No eligible components found for level ${level}`);
  }

  const eligibleHeroes = eligible.filter((c) => c.slot === 'hero');
  const eligibleNonHeroes = eligible.filter((c) => c.slot !== 'hero');

  const hero =
    eligibleHeroes.length > 0
      ? weightedPick(rng, eligibleHeroes, (c) => effectiveWeight(c, level))
      : null;

  const maxAvailable = (hero ? 1 : 0) + eligibleNonHeroes.length;
  const [minTarget, maxTarget] = COMPONENT_BUDGETS[level];
  const targetCount = Math.min(maxAvailable, randInt(rng, minTarget, maxTarget));

  const selected = hero ? [hero] : [];
  const selectedSet = new Set(selected);

  const remainingForSlots = targetCount - selected.length;
  if (remainingForSlots > 0 && eligibleNonHeroes.length > 0) {
    const bySlot = new Map();
    for (const comp of eligibleNonHeroes) {
      if (!bySlot.has(comp.slot)) {
        bySlot.set(comp.slot, []);
      }
      bySlot.get(comp.slot).push(comp);
    }

    const slotEntries = [];
    for (const slot of NON_HERO_SLOT_PRIORITY) {
      const items = bySlot.get(slot);
      if (items && items.length > 0) {
        const totalWeight = items.reduce((sum, item) => sum + effectiveWeight(item, level), 0);
        slotEntries.push({ slot, items, weight: totalWeight });
      }
    }

    const chosenSlotEntries =
      slotEntries.length <= remainingForSlots
        ? slotEntries
        : weightedSampleWithoutReplacement(
            rng,
            slotEntries,
            remainingForSlots,
            (entry) => entry.weight
          );

    for (const entry of chosenSlotEntries) {
      const picked = weightedPick(rng, entry.items, (c) => effectiveWeight(c, level));
      if (picked && !selectedSet.has(picked)) {
        selected.push(picked);
        selectedSet.add(picked);
      }
    }
  }

  if (selected.length < targetCount) {
    const leftovers = eligibleNonHeroes.filter((c) => !selectedSet.has(c));
    const extras = weightedSampleWithoutReplacement(
      rng,
      leftovers,
      targetCount - selected.length,
      (c) => effectiveWeight(c, level)
    );
    for (const comp of extras) {
      selected.push(comp);
      selectedSet.add(comp);
    }
  }

  const slotRank = new Map(HTML_SLOTS.map((slot, idx) => [slot, idx]));
  selected.sort((a, b) => (slotRank.get(a.slot) ?? 99) - (slotRank.get(b.slot) ?? 99));

  return selected;
}

function selectCopy(rng, copyLib, level, brand) {
  const textWeight = (s) => copyWeight(s, level);

  const heroHeadline = weightedPick(rng, copyLib.hero_headlines, textWeight);
  const subhead = weightedPick(rng, copyLib.subheads, textWeight);
  const primaryCta = weightedPick(rng, copyLib.ctas, textWeight);
  const secondaryPool = copyLib.ctas.filter((c) => c !== primaryCta);
  const secondaryCta =
    secondaryPool.length > 0 ? weightedPick(rng, secondaryPool, textWeight) : primaryCta;

  const emojis = shuffle(rng, FEATURE_EMOJIS).slice(0, 3);
  const featureTitles = sampleWithFallback(rng, copyLib.feature_titles, 3, textWeight);
  const features = featureTitles.map((title, idx) => ({
    emoji: emojis[idx],
    title,
  }));

  const stats = sampleWithFallback(rng, copyLib.fake_stats, 4, () => 1).map((s) => ({
    value: s.value,
    label: s.label,
  }));

  const testimonialWeight = (t) => (level >= 5 && t.rating === 5 ? 4 : 1);
  const testimonials = sampleWithFallback(rng, copyLib.testimonials, 3, testimonialWeight).map(
    (t) => ({
      quote: t.quote,
      author: t.author,
      role: t.role,
      rating: t.rating,
    })
  );

  let badge = '';
  if (level === 2) {
    badge = pick(rng, MILD_BADGES);
  } else if (level >= 3) {
    badge = SPARKLE_AI_BADGE;
  }

  return {
    brand,
    badge,
    hero_headline: heroHeadline,
    subhead,
    primary_cta: primaryCta,
    secondary_cta: secondaryCta,
    features,
    stats,
    testimonials,
  };
}

function selectAnimations(rng, level) {
  switch (level) {
    case 1:
      return [];
    case 2:
      return rng() < 0.5 ? [] : ['hover-scale'];
    case 3:
      return ['float'];
    case 4:
      return rng() < 0.5 ? ['float', 'pulse'] : ['float', 'pulse', 'hover-scale'];
    case 5:
      return [...VALID_ANIMATIONS];
    default:
      throw new RangeError(`Unsupported slop level: ${String(level)}`);
  }
}

/**
 * Deal a deterministic, schema-validated design specification.
 * @param {{
 *   level?: number,
 *   seed?: number,
 *   page?: string,
 *   brand?: string,
 *   library?: { palettes: object[], fonts: object[], copy: object, components: object[] },
 *   libraryDir?: string,
 * }} [options]
 * @returns {object} Validated deal object matching docs/CONTRACT.md Section 7.
 */
export function dealDesign(options = {}) {
  const {
    level = DEFAULT_LEVEL,
    seed = DEFAULT_SEED,
    page = DEFAULT_PAGE,
    brand = DEFAULT_BRAND,
    library,
    libraryDir = DEFAULT_LIBRARY_DIR,
  } = options;

  if (!Number.isInteger(level) || level < 1 || level > 5) {
    throw new RangeError(`level must be an integer between 1 and 5 (got ${String(level)})`);
  }
  if (!Number.isSafeInteger(seed)) {
    throw new RangeError(`seed must be a finite integer (got ${String(seed)})`);
  }
  if (!VALID_PAGES.includes(page)) {
    throw new RangeError(`page must be one of ${VALID_PAGES.join(', ')} (got ${String(page)})`);
  }
  if (typeof brand !== 'string' || brand.trim().length === 0) {
    throw new RangeError('brand must be a non-empty string');
  }

  const lib = library ?? loadLibrary(libraryDir);
  const rng = createPrng(seed);

  const palette = selectPalette(rng, lib.palettes, level);
  const font = selectFont(rng, lib.fonts, level);
  const components = selectComponents(rng, lib.components, level);
  const copy = selectCopy(rng, lib.copy, level, brand.trim());
  const animations = selectAnimations(rng, level);

  const deal = {
    seed,
    level,
    page,
    palette,
    font,
    copy,
    components,
    animations,
  };

  assertValid(validateDealOutput(deal), 'Deal output validation');
  return deal;
}

/**
 * CLI entrypoint.
 * @param {string[]} argv
 * @returns {number} Exit code.
 */
export function main(argv = process.argv.slice(2)) {
  try {
    const parsed = parseCliArgs(argv);
    if (parsed.help) {
      process.stdout.write(`${formatUsage()}\n`);
      return 0;
    }

    const deal = dealDesign({
      level: parsed.level,
      seed: parsed.seed,
      page: parsed.page,
      brand: parsed.brand,
      libraryDir: parsed.libraryDir,
    });

    process.stdout.write(`${JSON.stringify(deal, null, 2)}\n`);
    return 0;
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    return 1;
  }
}

function isDirectEntrypoint() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
  } catch {
    return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
  }
}

if (isDirectEntrypoint()) {
  process.exitCode = main(process.argv.slice(2));
}
