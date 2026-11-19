#!/usr/bin/env node
/**
 * Slop Meter — Zero-dependency HTML AI-slop scoring engine and CLI.
 * Reference: docs/CONTRACT.md (Section 9)
 */

import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  SLOP_CATEGORIES,
  assertValid,
  validateRule,
} from '../library/schema.mjs';

export const DEFAULT_RULES_DIR = new URL('./rules', import.meta.url);

const CATEGORY_FILE_ORDER = Object.freeze([
  'color.json',
  'typography.json',
  'layout.json',
  'effect.json',
  'copy.json',
]);

const PURPLE_ACCENT_RE =
  /(?:#(?:8b5cf6|7c3aed|a855f7|9333ea|6366f1|c084fc|6d28d9|a78bfa|d946ef)\b|rgba?\(\s*(?:139|124|168|147|99|192|167|217)\s*,|(?:[:,\s(])(?:purple|violet|indigo)\b)/i;

const ELECTRIC_BLUE_RE =
  /(?:#(?:3b82f6|2563eb|06b6d4|60a5fa|38bdf8|0ea5e9|22d3ee|00d4ff|1d4ed8|0284c7)\b|rgba?\(\s*(?:59|37|6|96|56|14|34)\s*,\s*(?:130|99|182|165|189|211)\s*,|(?:[:,\s(])cyan\b)/i;

const DARK_VOID_BG_RE =
  /(?:--(?:slop-)?bg|background(?:-color)?)\s*:[^;{}]*(?:#[01][0-9a-f][01][0-9a-f][0-3][0-9a-f]\b|#1e1b4b\b|rgba?\(\s*(?:[0-9]|1[0-9]|2[0-4])\s*,\s*(?:[0-9]|1[0-9]|2[0-4])\s*,\s*(?:[0-9]|[1-4][0-9])\b)|\bbg-(?:slate-950|gray-950|zinc-950|neutral-950|\[#0[0-9a-f]{5}\])/i;

const GRADIENT_USAGE_RE = /(?:linear|radial|conic)-gradient\(|var\(--slop-gradient\)/gi;

const CENTERING_RE =
  /(?:text-align\s*:\s*center|justify-content\s*:\s*center|\btext-center\b|\bjustify-center\b)/gi;

const PRIMARY_CTA_CLASS_RE = /\b(?:slop-)?(?:btn|button|cta)-primary\b/i;
const SECONDARY_CTA_CLASS_RE = /\b(?:slop-)?(?:btn|button|cta)-(?:secondary|ghost|outline)\b/i;

const CTA_GROUP_BLOCK_RE =
  /<(div|nav|section|p)[^>]*class=["'][^"']*(?:cta-group|hero-actions|hero-cta|hero-buttons|btn-group|button-group|slop-actions|slop-cta-group)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi;

const HERO_SECTION_RE =
  /<(section|header)[^>]*class=["'][^"']*\b(?:slop-)?hero\b[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi;

const SAAS_EMOJI_RE = /🚀|⚡|🧠|✨|🔥|💎|🔒|📊|🤖|🎯|🌟|💡|🛡️|⚙️|📈|🔮/gu;

const BOX_SHADOW_RE = /box-shadow\s*:\s*(?!none\b)/gi;

const BUZZWORD_RE =
  /\b(?:workflows?|autonomous|ai[\s-]powered|revolutioniz(?:e|es|ed|ing)|supercharg(?:e|es|ed|ing)|seamless(?:ly)?|unlock\s+the\s+power|elevat(?:e|es|ed|ing)|next[\s-]gen(?:eration)?|next[\s-]level|10x|hyper(?:scale|fast|charged|growth|[\s-]personaliz\w*|[\s-]automat\w*)?|effortless(?:ly)?|cutting[\s-]edge|game[\s-]changing)\b/gi;

function stripNonVisibleBlocks(html) {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

function extractVisibleText(html) {
  return stripNonVisibleBlocks(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countMatches(text, regex) {
  const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

export const COMPUTED_CHECKS = Object.freeze({
  'purple-blue-combo'(html) {
    const hasPurple = PURPLE_ACCENT_RE.test(html);
    const hasBlue = ELECTRIC_BLUE_RE.test(html);
    const passed = hasPurple && hasBlue;
    return { passed, matches: passed ? 1 : 0 };
  },

  'dark-purple-combo'(html) {
    const hasDark = DARK_VOID_BG_RE.test(html);
    const hasPurple = PURPLE_ACCENT_RE.test(html);
    const passed = hasDark && hasPurple;
    return { passed, matches: passed ? 1 : 0 };
  },

  'gradient-density'(html, rule) {
    const min = rule.min ?? 3;
    const matches = countMatches(html, GRADIENT_USAGE_RE);
    return { passed: matches >= min, matches };
  },

  'centering-bias'(html, rule) {
    const min = rule.min ?? 3;
    const matches = countMatches(html, CENTERING_RE);
    return { passed: matches >= min, matches };
  },

  'dual-cta'(html) {
    const markup = stripNonVisibleBlocks(html);

    if (PRIMARY_CTA_CLASS_RE.test(markup) && SECONDARY_CTA_CLASS_RE.test(markup)) {
      return { passed: true, matches: 2 };
    }

    const groupBlocks = markup.match(CTA_GROUP_BLOCK_RE) ?? [];
    for (const block of groupBlocks) {
      const actionCount = countMatches(block, /<(?:a|button)\b/gi);
      if (actionCount >= 2) {
        return { passed: true, matches: actionCount };
      }
    }

    const heroBlocks = markup.match(HERO_SECTION_RE) ?? [];
    for (const hero of heroBlocks) {
      const ctaCount = countMatches(
        hero,
        /<button\b|<a\b[^>]*class=["'][^"']*(?:btn|button|cta)[^"']*["']/gi
      );
      if (ctaCount >= 2) {
        return { passed: true, matches: ctaCount };
      }
    }

    return { passed: false, matches: 0 };
  },

  'emoji-card-density'(html, rule) {
    const min = rule.min ?? 3;
    const visibleMarkup = stripNonVisibleBlocks(html);
    const matches = countMatches(visibleMarkup, SAAS_EMOJI_RE);
    return { passed: matches >= min, matches };
  },

  'shadow-excess'(html, rule) {
    const min = rule.min ?? 4;
    const matches = countMatches(html, BOX_SHADOW_RE);
    return { passed: matches >= min, matches };
  },

  'buzzword-density'(html, rule) {
    const min = rule.min ?? 4;
    const visibleText = extractVisibleText(html);
    const matches = countMatches(visibleText, BUZZWORD_RE);
    return { passed: matches >= min, matches };
  },
});

function resolveRulesDir(rulesDir) {
  if (rulesDir instanceof URL) {
    return fileURLToPath(rulesDir);
  }
  if (typeof rulesDir === 'string' && rulesDir.trim().length > 0) {
    return resolve(rulesDir);
  }
  return fileURLToPath(DEFAULT_RULES_DIR);
}

function sortRuleFilenames(files) {
  return [...files].sort((a, b) => {
    const idxA = CATEGORY_FILE_ORDER.indexOf(a);
    const idxB = CATEGORY_FILE_ORDER.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });
}

/**
 * Load and validate all JSON rule files from a directory.
 * @param {string | URL} [rulesDir]
 * @returns {Array<object>}
 */
export function loadRules(rulesDir = DEFAULT_RULES_DIR) {
  const dirPath = resolveRulesDir(rulesDir);

  let stat;
  try {
    stat = statSync(dirPath);
  } catch (err) {
    throw new Error(`Rules directory not found: ${dirPath} (${err.message})`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`Rules path is not a directory: ${dirPath}`);
  }

  const jsonFiles = sortRuleFilenames(
    readdirSync(dirPath).filter((name) => extname(name).toLowerCase() === '.json')
  );

  if (jsonFiles.length === 0) {
    throw new Error(`No .json rule files found in: ${dirPath}`);
  }

  const rules = [];
  const seenIds = new Set();

  for (const filename of jsonFiles) {
    const filePath = join(dirPath, filename);
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (err) {
      throw new Error(`Failed to parse rule file ${filename}: ${err.message}`);
    }

    const entries = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray(parsed.rules)
        ? parsed.rules
        : null;

    if (!entries) {
      throw new Error(`Rule file ${filename} must export a JSON array of rule objects`);
    }

    entries.forEach((rule, index) => {
      assertValid(validateRule(rule), `Rule ${filename}[${index}]`);

      if (seenIds.has(rule.id)) {
        throw new Error(`Duplicate rule id "${rule.id}" found in ${filename}`);
      }
      seenIds.add(rule.id);

      if (rule.type === 'computed') {
        const checkName = rule.check ?? rule.pattern;
        if (!(checkName in COMPUTED_CHECKS)) {
          throw new Error(
            `Unknown computed check "${checkName}" in rule "${rule.id}" (${filename})`
          );
        }
      }

      rules.push(rule);
    });
  }

  if (rules.length === 0) {
    throw new Error(`Rules directory ${dirPath} contained 0 rules`);
  }

  return rules;
}

/**
 * Map numeric score (0..100) to a Slop Meter grade band.
 * @param {number} score
 * @returns {'Artisanal' | 'Mild' | 'Full Slop' | 'Transcendent'}
 */
export function getGrade(score) {
  if (!Number.isFinite(score)) {
    throw new TypeError(`Score must be a finite number (got ${String(score)})`);
  }
  if (score <= 25) return 'Artisanal';
  if (score <= 50) return 'Mild';
  if (score <= 80) return 'Full Slop';
  return 'Transcendent';
}

function evaluateRule(html, rule) {
  if (rule.type === 'regex' || rule.type === 'count') {
    const baseFlags = typeof rule.flags === 'string' ? rule.flags : 'i';
    const flags = baseFlags.includes('g') ? baseFlags : `${baseFlags}g`;
    const regex = new RegExp(rule.pattern, flags);
    const min = rule.min ?? 1;
    const matches = countMatches(html, regex);
    return {
      passed: matches >= min,
      matches,
    };
  }

  if (rule.type === 'computed') {
    const checkName = rule.check ?? rule.pattern;
    const evaluator = COMPUTED_CHECKS[checkName];
    if (!evaluator) {
      throw new Error(`Unknown computed check "${checkName}" in rule "${rule.id}"`);
    }
    const outcome = evaluator(html, rule);
    return {
      passed: Boolean(outcome.passed),
      matches: Number.isInteger(outcome.matches) ? outcome.matches : outcome.passed ? 1 : 0,
    };
  }

  throw new Error(`Unsupported rule type "${String(rule.type)}" in rule "${rule.id}"`);
}

/**
 * Score an HTML string against a set of slop-meter rules.
 * @param {string} html
 * @param {Array<object>} [rules]
 */
export function scoreHtml(html, rules = loadRules()) {
  if (typeof html !== 'string') {
    throw new TypeError('html input must be a string');
  }
  if (!Array.isArray(rules)) {
    throw new TypeError('rules must be an array of rule objects');
  }

  const categoryTotals = Object.create(null);
  for (const cat of SLOP_CATEGORIES) {
    categoryTotals[cat] = {
      score: 0,
      matchedWeight: 0,
      totalWeight: 0,
      passedCount: 0,
      totalRules: 0,
    };
  }

  let matchedWeight = 0;
  let totalWeight = 0;
  let passedCount = 0;

  const results = rules.map((rule) => {
    assertValid(validateRule(rule), `Rule "${rule?.id ?? 'unknown'}"`);

    const evaluation = evaluateRule(html, rule);
    totalWeight += rule.weight;

    if (!categoryTotals[rule.category]) {
      categoryTotals[rule.category] = {
        score: 0,
        matchedWeight: 0,
        totalWeight: 0,
        passedCount: 0,
        totalRules: 0,
      };
    }

    const catStats = categoryTotals[rule.category];
    catStats.totalWeight += rule.weight;
    catStats.totalRules += 1;

    if (evaluation.passed) {
      matchedWeight += rule.weight;
      passedCount += 1;
      catStats.matchedWeight += rule.weight;
      catStats.passedCount += 1;
    }

    return {
      id: rule.id,
      name: rule.name ?? rule.description ?? rule.id,
      category: rule.category,
      weight: rule.weight,
      type: rule.type,
      passed: evaluation.passed,
      matches: evaluation.matches,
      description: rule.description,
    };
  });

  for (const cat of Object.keys(categoryTotals)) {
    const entry = categoryTotals[cat];
    entry.score =
      entry.totalWeight === 0 ? 0 : Math.round((entry.matchedWeight / entry.totalWeight) * 100);
  }

  const score = totalWeight === 0 ? 0 : Math.round((matchedWeight / totalWeight) * 100);
  const grade = getGrade(score);

  return {
    score,
    grade,
    matchedWeight,
    totalWeight,
    passedCount,
    totalRules: rules.length,
    categories: categoryTotals,
    results,
  };
}

/**
 * Format a scoring report as human-readable CLI output.
 * @param {{ score: number, grade: string, results: Array<{ name?: string, description?: string, id: string, passed: boolean }> }} report
 * @returns {string}
 */
export function formatTextReport(report) {
  const lines = ['Slop Meter', ''];

  for (const item of report.results) {
    const badge = item.passed ? '[PASS]' : '[FAIL]';
    const label = item.name || item.description || item.id;
    lines.push(`${badge} ${label}`);
  }

  lines.push('');
  lines.push(`Score: ${report.score}/100`);
  lines.push(`Grade: ${report.grade}`);

  return lines.join('\n');
}

function parseMinValue(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error('--min requires a numeric value between 0 and 100');
  }
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0 || num > 100) {
    throw new Error(`Invalid --min value "${raw}": must be a number between 0 and 100`);
  }
  return num;
}

/**
 * Parse CLI arguments for slop-meter.mjs.
 * @param {string[]} argv
 * @returns {{ file: string | null, min: number | null, json: boolean, rulesDir: string | null, help: boolean }}
 */
export function parseCliArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError('argv must be an array of strings');
  }

  let file = null;
  let min = null;
  let json = false;
  let rulesDir = null;
  let help = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }

    if (arg === '--json') {
      json = true;
      continue;
    }

    if (arg === '--min') {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error('--min requires a numeric value between 0 and 100');
      }
      min = parseMinValue(next);
      i += 1;
      continue;
    }

    if (arg.startsWith('--min=')) {
      min = parseMinValue(arg.slice('--min='.length));
      continue;
    }

    if (arg === '--rules') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) {
        throw new Error('--rules requires a directory path');
      }
      rulesDir = next;
      i += 1;
      continue;
    }

    if (arg.startsWith('--rules=')) {
      const val = arg.slice('--rules='.length);
      if (!val) {
        throw new Error('--rules requires a directory path');
      }
      rulesDir = val;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (file !== null) {
      throw new Error(`Unexpected extra argument: ${arg}`);
    }
    file = arg;
  }

  if (!help && !file) {
    throw new Error('Missing required <html-file> argument');
  }

  return { file, min, json, rulesDir, help };
}

function getUsageText() {
  return [
    'Usage: node skills/slop-skill/scripts/slop-meter.mjs <html-file> [--min <0-100>] [--json] [--rules <dir>]',
    '',
    'Options:',
    '  --min <0-100>   Fail with exit code 1 if score is below threshold',
    '  --json          Output structured JSON report',
    '  --rules <dir>   Load rule JSON files from custom directory',
    '  -h, --help      Show this help message',
  ].join('\n');
}

function runCli(argv) {
  let args;
  try {
    args = parseCliArgs(argv);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n${getUsageText()}\n`);
    process.exitCode = 1;
    return;
  }

  if (args.help) {
    process.stdout.write(`${getUsageText()}\n`);
    process.exitCode = 0;
    return;
  }

  const filePath = resolve(args.file);
  let html;
  try {
    const fileStat = statSync(filePath);
    if (!fileStat.isFile()) {
      throw new Error('target path is not a regular file');
    }
    html = readFileSync(filePath, 'utf8');
  } catch (err) {
    process.stderr.write(`Error: Unable to read HTML file "${args.file}": ${err.message}\n`);
    process.exitCode = 1;
    return;
  }

  let rules;
  try {
    rules = args.rulesDir ? loadRules(args.rulesDir) : loadRules();
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exitCode = 1;
    return;
  }

  const scored = scoreHtml(html, rules);
  const report = {
    file: args.file,
    ...scored,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatTextReport(report)}\n`);
  }

  if (args.min !== null && report.score < args.min) {
    process.exitCode = 1;
    return;
  }

  process.exitCode = 0;
}

function isExecutedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
  }
}

if (isExecutedDirectly()) {
  runCli(process.argv.slice(2));
}
