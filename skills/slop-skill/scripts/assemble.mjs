#!/usr/bin/env node
/**
 * HTML Page Assembler for slop-skill.
 * Combines starter.html, system.css, and a validated deal JSON into a
 * standalone, responsive HTML5 document.
 *
 * Zero external runtime dependencies (Node.js >= 22 ESM).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  HTML_SLOTS,
  validateDealOutput,
  assertValid,
} from '../library/schema.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_TEMPLATE_PATH = path.resolve(__dirname, '../assets/starter.html');
const DEFAULT_CSS_PATH = path.resolve(__dirname, '../assets/system.css');

const TOKEN_FALLBACKS = Object.freeze({
  surface: 'rgba(128, 128, 128, 0.06)',
  muted: '#64748b',
  border: 'rgba(128, 128, 128, 0.2)',
  glow: 'rgba(128, 128, 128, 0.25)',
});

const STANDARD_TOKEN_KEYS = new Set([
  'bg',
  'fg',
  'accent1',
  'accent2',
  'surface',
  'muted',
  'border',
  'glow',
]);

const ANIMATION_RULES = Object.freeze({
  float: [
    '@keyframes float {',
    '  0%, 100% { transform: translateY(0); }',
    '  50% { transform: translateY(-10px); }',
    '}',
    '.slop-badge,',
    '.slop-float-item,',
    '.slop-emoji-icon,',
    '.slop-animate-float {',
    '  animation: float 4s ease-in-out infinite;',
    '}',
  ].join('\n'),

  pulse: [
    '@keyframes pulse {',
    '  0%, 100% { opacity: 1; transform: scale(1); }',
    '  50% { opacity: 0.72; transform: scale(1.03); }',
    '}',
    '.slop-badge,',
    '.slop-pulse-dot,',
    '.slop-animate-pulse {',
    '  animation: pulse 2.4s ease-in-out infinite;',
    '}',
  ].join('\n'),

  'blob-drift': [
    '@keyframes blob-drift {',
    '  0%, 100% { transform: translate(0, 0) scale(1); }',
    '  33% { transform: translate(28px, -24px) scale(1.08); }',
    '  66% { transform: translate(-22px, 18px) scale(0.95); }',
    '}',
    '.slop-blob,',
    '.slop-animate-blob {',
    '  animation: blob-drift 14s ease-in-out infinite;',
    '}',
  ].join('\n'),

  'gradient-shift': [
    '@keyframes gradient-shift {',
    '  0% { background-position: 0% 50%; }',
    '  50% { background-position: 100% 50%; }',
    '  100% { background-position: 0% 50%; }',
    '}',
    '.slop-gradient-text,',
    '.slop-btn-primary,',
    '.slop-animate-gradient {',
    '  background-size: 200% 200%;',
    '  animation: gradient-shift 6s ease infinite;',
    '}',
  ].join('\n'),

  'hover-scale': [
    '.slop-card,',
    '.slop-glass-card,',
    '.slop-shadow-card,',
    '.slop-testimonial-card,',
    '.slop-btn {',
    '  transition: transform 0.3s ease;',
    '}',
    '.slop-card:hover,',
    '.slop-glass-card:hover,',
    '.slop-shadow-card:hover,',
    '.slop-testimonial-card:hover,',
    '.slop-btn:hover {',
    '  transform: scale(1.05) translateY(-4px);',
    '}',
  ].join('\n'),

  'neon-glow-pulse': [
    '@keyframes neon-glow-pulse {',
    '  0%, 100% { box-shadow: 0 0 18px var(--slop-glow), 0 0 36px var(--slop-glow); }',
    '  50% { box-shadow: 0 0 28px var(--slop-glow), 0 0 56px var(--slop-glow); }',
    '}',
    '.slop-btn-primary,',
    '.slop-neon-btn,',
    '.slop-animate-glow {',
    '  animation: neon-glow-pulse 3s ease-in-out infinite;',
    '}',
  ].join('\n'),
});

/**
 * HTML-escape a string for safe interpolation into text nodes and attributes.
 * @param {unknown} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitize a CSS property value so injected tokens cannot break out of
 * `:root` declarations or `<style>` blocks.
 * @param {unknown} str
 * @returns {string}
 */
export function sanitizeCssValue(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/<\/style\b[^>]*>/gi, '')
    .replace(/<style\b[^>]*>/gi, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\*|\*\//g, '')
    .replace(/[\r\n\0{};<>\\]/g, '')
    .trim();
}

function sanitizeFontName(name) {
  return sanitizeCssValue(name).replace(/['"]/g, '').trim();
}

function sanitizeTokenKey(key) {
  return String(key).replace(/[^a-zA-Z0-9_-]/g, '');
}

function sanitizeStyleBlockContent(css) {
  if (typeof css !== 'string') return '';
  return css.replace(/<\/style\b[^>]*>/gi, '').trim();
}

function isValidGoogleFontsUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!/^https:\/\/fonts\.googleapis\.com\/css2?\?/i.test(trimmed)) return false;
  if (/[\s<>'"]/.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && parsed.hostname === 'fonts.googleapis.com';
  } catch {
    return false;
  }
}

/**
 * Build the `:root` CSS custom properties block from `deal.palette` and `deal.font`.
 * @param {object} deal
 * @returns {string}
 */
export function buildTokenCss(deal) {
  const tokens = deal?.palette?.tokens ?? {};
  const gradient = sanitizeCssValue(deal?.palette?.gradient ?? '');
  const headingFont = sanitizeFontName(deal?.font?.heading ?? 'Inter');
  const bodyFont = sanitizeFontName(deal?.font?.body ?? 'Inter');

  const lines = [
    ':root {',
    `  --slop-bg: ${sanitizeCssValue(tokens.bg)};`,
    `  --slop-fg: ${sanitizeCssValue(tokens.fg)};`,
    `  --slop-accent1: ${sanitizeCssValue(tokens.accent1)};`,
    `  --slop-accent2: ${sanitizeCssValue(tokens.accent2)};`,
    `  --slop-surface: ${sanitizeCssValue(tokens.surface ?? TOKEN_FALLBACKS.surface)};`,
    `  --slop-muted: ${sanitizeCssValue(tokens.muted ?? TOKEN_FALLBACKS.muted)};`,
    `  --slop-border: ${sanitizeCssValue(tokens.border ?? TOKEN_FALLBACKS.border)};`,
    `  --slop-glow: ${sanitizeCssValue(tokens.glow ?? TOKEN_FALLBACKS.glow)};`,
  ];

  for (const [key, value] of Object.entries(tokens)) {
    if (STANDARD_TOKEN_KEYS.has(key)) continue;
    const safeKey = sanitizeTokenKey(key);
    if (!safeKey) continue;
    lines.push(`  --slop-${safeKey}: ${sanitizeCssValue(value)};`);
  }

  lines.push(`  --slop-gradient: ${gradient};`);
  lines.push(`  --slop-font-heading: '${headingFont}', system-ui, sans-serif;`);
  lines.push(`  --slop-font-body: '${bodyFont}', system-ui, sans-serif;`);
  lines.push('}');

  return lines.join('\n');
}

/**
 * Build animation CSS ONLY for the animation IDs present in `animations`.
 * @param {string[]} [animations]
 * @returns {string}
 */
export function buildAnimationCss(animations = []) {
  if (!Array.isArray(animations) || animations.length === 0) {
    return '';
  }

  const seen = new Set();
  const blocks = [];

  for (const animId of animations) {
    if (typeof animId !== 'string' || seen.has(animId)) continue;
    seen.add(animId);
    const rule = ANIMATION_RULES[animId];
    if (rule) {
      blocks.push(rule);
    }
  }

  return blocks.join('\n\n');
}

/**
 * Build an escaped placeholder dictionary from `copy` and `meta`.
 * @param {object} [copy]
 * @param {object} [meta]
 * @returns {Record<string, string>}
 */
function buildPlaceholderMap(copy = {}, meta = {}) {
  const safeCopy = copy && typeof copy === 'object' ? copy : {};
  const safeMeta = meta && typeof meta === 'object' ? meta : {};

  const map = {
    brand: escapeHtml(safeCopy.brand ?? 'NovaFlow AI'),
    badge: escapeHtml(safeCopy.badge ?? ''),
    hero_headline: escapeHtml(safeCopy.hero_headline ?? ''),
    subhead: escapeHtml(safeCopy.subhead ?? ''),
    primary_cta: escapeHtml(safeCopy.primary_cta ?? ''),
    secondary_cta: escapeHtml(safeCopy.secondary_cta ?? ''),
  };

  if (safeMeta.level !== undefined) {
    map.level = escapeHtml(safeMeta.level);
  }
  if (safeMeta.page !== undefined) {
    map.page = escapeHtml(safeMeta.page);
  }
  if (safeMeta.seed !== undefined) {
    map.seed = escapeHtml(safeMeta.seed);
  }

  const features = Array.isArray(safeCopy.features) ? safeCopy.features : [];
  const featureCount = Math.max(3, features.length);
  for (let i = 0; i < featureCount; i++) {
    const feat = features[i];
    map[`feature_${i}_title`] = escapeHtml(feat?.title ?? '');
    map[`feature_${i}_emoji`] = escapeHtml(feat?.emoji ?? '');
    if (feat?.description !== undefined) {
      map[`feature_${i}_description`] = escapeHtml(feat.description);
    }
  }

  const stats = Array.isArray(safeCopy.stats) ? safeCopy.stats : [];
  const statCount = Math.max(4, stats.length);
  for (let i = 0; i < statCount; i++) {
    const stat = stats[i];
    map[`stat_${i}_value`] = escapeHtml(stat?.value ?? '');
    map[`stat_${i}_label`] = escapeHtml(stat?.label ?? '');
  }

  const testimonials = Array.isArray(safeCopy.testimonials) ? safeCopy.testimonials : [];
  const testimonialCount = Math.max(3, testimonials.length);
  for (let i = 0; i < testimonialCount; i++) {
    const item = testimonials[i];
    map[`testimonial_${i}_quote`] = escapeHtml(item?.quote ?? '');
    map[`testimonial_${i}_author`] = escapeHtml(item?.author ?? '');
    map[`testimonial_${i}_role`] = escapeHtml(item?.role ?? '');
    map[`testimonial_${i}_rating`] =
      item?.rating !== undefined ? escapeHtml(item.rating) : '';
    map[`testimonial_${i}_stars`] =
      Number.isInteger(item?.rating) && item.rating > 0
        ? '★'.repeat(Math.min(item.rating, 5))
        : '';
  }

  return map;
}

/**
 * Safely interpolate `{{...}}` copy and metadata placeholders with HTML-escaped values.
 * @param {string} html
 * @param {object} [copy]
 * @param {object} [meta]
 * @returns {string}
 */
export function interpolateTemplate(html, copy = {}, meta = {}) {
  if (typeof html !== 'string') return '';
  const values = buildPlaceholderMap(copy, meta);

  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      return values[key];
    }
    if (/^(?:feature_\d+_(?:title|emoji|description)|stat_\d+_(?:value|label)|testimonial_\d+_(?:quote|author|role|rating|stars))$/.test(key)) {
      return '';
    }
    return match;
  });
}

function buildHeadMarkup(deal, headComponentsHtml) {
  const parts = [];
  const fontsUrl = deal?.font?.googleFontsUrl;
  if (isValidGoogleFontsUrl(fontsUrl)) {
    parts.push('<link rel="preconnect" href="https://fonts.googleapis.com">');
    parts.push('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
    parts.push(`<link rel="stylesheet" href="${escapeHtml(fontsUrl.trim())}">`);
  }
  if (headComponentsHtml) {
    parts.push(headComponentsHtml);
  }
  return parts.join('\n  ');
}

/**
 * Assemble a complete standalone HTML5 document from a validated deal object.
 * @param {object} deal
 * @param {{ template?: string, css?: string, templatePath?: string, cssPath?: string }} [options]
 * @returns {string}
 */
export function assembleHtml(deal, options = {}) {
  const validation = validateDealOutput(deal);
  assertValid(validation, 'Deal validation');

  const templateHtml =
    typeof options.template === 'string'
      ? options.template
      : fs.readFileSync(options.templatePath || DEFAULT_TEMPLATE_PATH, 'utf8');

  const systemCss =
    typeof options.css === 'string'
      ? options.css
      : fs.readFileSync(options.cssPath || DEFAULT_CSS_PATH, 'utf8');

  const meta = {
    level: deal.level,
    page: deal.page,
    seed: deal.seed,
  };

  /** @type {Record<string, string[]>} */
  const slotHtmlMap = Object.fromEntries(HTML_SLOTS.map((slot) => [slot, []]));
  const componentCssParts = [];

  for (const comp of deal.components) {
    const renderedHtml = interpolateTemplate(comp.html, deal.copy, meta);
    if (Object.prototype.hasOwnProperty.call(slotHtmlMap, comp.slot)) {
      slotHtmlMap[comp.slot].push(renderedHtml);
    }
    const cleanCss = sanitizeStyleBlockContent(comp.css);
    if (cleanCss) {
      componentCssParts.push(cleanCss);
    }
  }

  const tokenCssParts = [buildTokenCss(deal)];
  if (componentCssParts.length > 0) {
    tokenCssParts.push(componentCssParts.join('\n\n'));
  }
  const animCss = buildAnimationCss(deal.animations);
  if (animCss) {
    tokenCssParts.push(animCss);
  }

  const cleanSystemCss = sanitizeStyleBlockContent(systemCss);
  const tokensParts = [
    `<style id="slop-system">\n${cleanSystemCss}\n  </style>`,
    `<style id="slop-tokens">\n${tokenCssParts.join('\n\n')}\n  </style>`,
  ];
  if (slotHtmlMap.tokens.length > 0) {
    tokensParts.push(slotHtmlMap.tokens.join('\n'));
  }

  const slotReplacements = {
    head: buildHeadMarkup(deal, slotHtmlMap.head.join('\n  ')),
    tokens: tokensParts.join('\n  '),
    extra: slotHtmlMap.extra.join('\n'),
    hero: slotHtmlMap.hero.join('\n'),
    features: slotHtmlMap.features.join('\n'),
    stats: slotHtmlMap.stats.join('\n'),
    testimonials: slotHtmlMap.testimonials.join('\n'),
    cta: slotHtmlMap.cta.join('\n'),
    footer: slotHtmlMap.footer.join('\n'),
  };

  // Interpolate starter template placeholders first so user copy cannot trigger
  // secondary placeholder expansion or inject slot markers.
  let output = interpolateTemplate(templateHtml, deal.copy, meta);

  for (const slot of HTML_SLOTS) {
    const content = slotReplacements[slot] ?? '';
    const slotPattern = new RegExp(`<!--\\s*SLOT:${slot}\\s*-->`, 'g');
    output = output.replace(slotPattern, () => content);
  }

  // Final sweep: strip any remaining or custom `<!-- SLOT:... -->` markers.
  output = output.replace(/<!--\s*SLOT:[^>]*-->/g, '');

  return output;
}

function parseCliArgs(argv) {
  const args = {
    deal: null,
    output: null,
    template: null,
    css: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }

    const eqIndex = arg.indexOf('=');
    const flag = eqIndex !== -1 ? arg.slice(0, eqIndex) : arg;
    const inlineValue = eqIndex !== -1 ? arg.slice(eqIndex + 1) : null;

    const readValue = () => {
      if (inlineValue !== null) return inlineValue;
      if (i + 1 >= argv.length) {
        throw new Error(`Missing value for option ${flag}`);
      }
      i += 1;
      return argv[i];
    };

    switch (flag) {
      case '--deal':
        args.deal = readValue();
        break;
      case '--output':
      case '-o':
        args.output = readValue();
        break;
      case '--template':
        args.template = readValue();
        break;
      case '--css':
        args.css = readValue();
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printUsage() {
  process.stdout.write(
    [
      'Usage: node skills/slop-skill/scripts/assemble.mjs [options]',
      '',
      'Options:',
      '  --deal <path|->     Path to deal JSON file (omit or "-" to read from stdin)',
      '  --output <path>     Write assembled HTML to file (omit to write to stdout)',
      '  --template <path>   Override starter.html template path',
      '  --css <path>        Override system.css stylesheet path',
      '  -h, --help          Show this help message',
      '',
    ].join('\n')
  );
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  let args;
  try {
    args = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  let rawJson;
  try {
    if (!args.deal || args.deal === '-') {
      rawJson = await readStdin();
    } else {
      rawJson = fs.readFileSync(args.deal, 'utf8');
    }
  } catch (err) {
    process.stderr.write(`Error reading deal input: ${err.message}\n`);
    process.exit(1);
  }

  if (!rawJson || !rawJson.trim()) {
    process.stderr.write('Error: Deal JSON input is empty.\n');
    process.exit(1);
  }

  let deal;
  try {
    deal = JSON.parse(rawJson);
  } catch (err) {
    process.stderr.write(`Error: Invalid JSON input: ${err.message}\n`);
    process.exit(1);
  }

  const validation = validateDealOutput(deal);
  if (!validation.valid) {
    process.stderr.write(
      `Error: Invalid deal schema:\n${validation.errors.map((e) => `  - ${e}`).join('\n')}\n`
    );
    process.exit(1);
  }

  let html;
  try {
    html = assembleHtml(deal, {
      templatePath: args.template || undefined,
      cssPath: args.css || undefined,
    });
  } catch (err) {
    process.stderr.write(`Error assembling HTML: ${err.message}\n`);
    process.exit(1);
  }

  try {
    if (args.output) {
      const resolvedOut = path.resolve(args.output);
      fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
      fs.writeFileSync(resolvedOut, html, 'utf8');
    } else {
      process.stdout.write(html);
    }
  } catch (err) {
    process.stderr.write(`Error writing output: ${err.message}\n`);
    process.exit(1);
  }
}

const isMain =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  await main();
}
