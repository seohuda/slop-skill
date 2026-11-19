import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { validateDealOutput } from '../skills/slop-skill/library/schema.mjs';
import {
  assembleHtml,
  buildTokenCss,
  buildAnimationCss,
  interpolateTemplate,
  escapeHtml,
  sanitizeCssValue,
} from '../skills/slop-skill/scripts/assemble.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.join(ROOT_DIR, 'tests/fixtures/sample-deal.json');
const ASSEMBLE_SCRIPT = path.join(ROOT_DIR, 'skills/slop-skill/scripts/assemble.mjs');
const SYSTEM_CSS_PATH = path.join(ROOT_DIR, 'skills/slop-skill/assets/system.css');
const STARTER_HTML_PATH = path.join(ROOT_DIR, 'skills/slop-skill/assets/starter.html');

function loadSampleDeal() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

function makeLevel1Deal() {
  return {
    seed: 7,
    level: 1,
    page: 'landing',
    palette: {
      id: 'clean-slate',
      name: 'Clean Slate',
      category: 'color',
      slop_weight: 2,
      min_level: 1,
      tokens: {
        bg: '#FAFAFA',
        fg: '#111827',
        accent1: '#0F766E',
        accent2: '#0D9488',
      },
      gradient: 'linear-gradient(135deg, #F8FAFC, #E2E8F0)',
    },
    font: {
      id: 'inter-clean',
      name: 'Inter Clean',
      category: 'typography',
      slop_weight: 2,
      min_level: 1,
      heading: 'Inter',
      body: 'Inter',
      googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap',
    },
    copy: {
      brand: 'PlainCraft',
      badge: 'Release 1.0',
      hero_headline: 'Simple Documentation Hosting',
      subhead: 'Publish technical documentation with fast static builds and clean typography.',
      primary_cta: 'Start Reading',
      secondary_cta: 'View Docs',
      features: [
        { emoji: '', title: 'Static Markdown Builds' },
        { emoji: '', title: 'Versioned Releases' },
        { emoji: '', title: 'Keyboard Search' },
      ],
      stats: [{ value: '12ms', label: 'Median Build Time' }],
      testimonials: [
        {
          quote: 'Reliable tooling with predictable HTML output.',
          author: 'Jordan Park',
          role: 'Staff Engineer, Northwind',
          rating: 4,
        },
      ],
    },
    components: [
      {
        id: 'minimal-hero',
        name: 'Minimal Hero',
        category: 'layout',
        slop_weight: 2,
        min_level: 1,
        slot: 'hero',
        html: '<section class="slop-section"><div class="slop-container"><h1>{{hero_headline}}</h1><p>{{subhead}}</p><a class="slop-btn slop-btn-primary" href="#features">{{primary_cta}}</a></div></section>',
        css: '.slop-section h1 { font-size: 2.25rem; }',
      },
    ],
    animations: [],
  };
}

test('sample-deal.json fixture is schema-valid and starter.html defines all 9 contract slots', () => {
  const deal = loadSampleDeal();
  const res = validateDealOutput(deal);
  assert.equal(res.valid, true, `Fixture should be valid: ${res.errors.join('; ')}`);

  const starter = fs.readFileSync(STARTER_HTML_PATH, 'utf8');
  for (const slot of [
    'head',
    'tokens',
    'extra',
    'hero',
    'features',
    'stats',
    'testimonials',
    'cta',
    'footer',
  ]) {
    assert.ok(
      starter.includes(`<!-- SLOT:${slot} -->`),
      `starter.html must include <!-- SLOT:${slot} -->`
    );
  }
});

test('1. Full HTML generation from tests/fixtures/sample-deal.json', () => {
  const deal = loadSampleDeal();
  const html = assembleHtml(deal);

  assert.match(html, /^<!DOCTYPE html>/i);
  assert.ok(html.includes('<html lang="en">'));
  assert.ok(html.includes('<title>NovaFlow AI — Revolutionize Your Workflow with Next-Gen AI</title>'));
  assert.ok(html.includes('data-slop-level="5"'));
  assert.ok(html.includes('data-slop-page="landing"'));
  assert.ok(html.includes('<header class="slop-header">'));
  assert.ok(html.includes('<footer class="slop-footer">'));
  assert.ok(html.includes('<style id="slop-system">'));
  assert.ok(html.includes('<style id="slop-tokens">'));
  assert.ok(html.includes('Lightning-Fast AI Automation'));
  assert.ok(html.includes('10K+'));
  assert.ok(html.includes('Sarah Chen'));
  assert.ok(html.includes('VP of Engineering, TechFlow'));
});

test('2. CSS :root tokens, --slop-gradient, font variables, extra tokens, and fallbacks', () => {
  const deal = loadSampleDeal();
  const tokenCss = buildTokenCss(deal);

  assert.ok(tokenCss.includes(':root {'));
  assert.ok(tokenCss.includes('--slop-bg: #09051A;'));
  assert.ok(tokenCss.includes('--slop-fg: #FFFFFF;'));
  assert.ok(tokenCss.includes('--slop-accent1: #8B5CF6;'));
  assert.ok(tokenCss.includes('--slop-accent2: #3B82F6;'));
  assert.ok(tokenCss.includes('--slop-accent3: #EC4899;'));
  assert.ok(tokenCss.includes('--slop-surface: rgba(255, 255, 255, 0.06);'));
  assert.ok(tokenCss.includes('--slop-muted: #A5B4FC;'));
  assert.ok(tokenCss.includes('--slop-border: rgba(139, 92, 246, 0.35);'));
  assert.ok(tokenCss.includes('--slop-glow: rgba(139, 92, 246, 0.55);'));
  assert.ok(tokenCss.includes('--slop-gradient: linear-gradient(135deg, #8B5CF6, #3B82F6, #EC4899);'));
  assert.ok(tokenCss.includes("--slop-font-heading: 'Poppins', system-ui, sans-serif;"));
  assert.ok(tokenCss.includes("--slop-font-body: 'Inter', system-ui, sans-serif;"));

  // Level 1 deal omits optional surface/muted/border/glow -> fallbacks emitted cleanly
  const level1TokenCss = buildTokenCss(makeLevel1Deal());
  assert.ok(level1TokenCss.includes('--slop-surface:'));
  assert.ok(level1TokenCss.includes('--slop-muted:'));
  assert.ok(level1TokenCss.includes('--slop-border:'));
  assert.ok(level1TokenCss.includes('--slop-glow:'));
  assert.doesNotMatch(level1TokenCss, /#8b5cf6|#3b82f6|#ec4899/i);
});

test('3. Google Fonts preconnect and stylesheet <link> tags inserted in <head>', () => {
  const deal = loadSampleDeal();
  const html = assembleHtml(deal);
  const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
  assert.ok(headMatch, '<head> section should exist');
  const headContent = headMatch[1];

  assert.ok(headContent.includes('<link rel="preconnect" href="https://fonts.googleapis.com">'));
  assert.ok(headContent.includes('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'));
  assert.ok(
    headContent.includes(
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;family=Poppins:wght@600;700;800&amp;display=swap">'
    )
  );
});

test('4. Components placed in target slots (extra, hero, features, stats, testimonials, cta, head, footer) and their CSS included', () => {
  const deal = loadSampleDeal();
  deal.components.push(
    {
      id: 'meta-theme-color',
      name: 'Theme Color Meta',
      category: 'color',
      slop_weight: 2,
      min_level: 1,
      slot: 'head',
      html: '<meta name="theme-color" content="#09051A">',
      css: '',
    },
    {
      id: 'footer-links',
      name: 'Footer Links',
      category: 'layout',
      slop_weight: 2,
      min_level: 1,
      slot: 'footer',
      html: '<div class="slop-footer-extra">Built for {{brand}}</div>',
      css: '.slop-footer-extra { font-weight: 500; }',
    }
  );

  const html = assembleHtml(deal);

  const headBlock = html.match(/<head>([\s\S]*?)<\/head>/i)[1];
  const mainBlock = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)[1];
  const footerBlock = html.match(/<footer class="slop-footer">([\s\S]*?)<\/footer>/i)[1];
  const tokensStyle = html.match(/<style id="slop-tokens">([\s\S]*?)<\/style>/i)[1];

  assert.ok(headBlock.includes('<meta name="theme-color" content="#09051A">'));
  assert.ok(html.includes('class="slop-blobs"'));
  assert.ok(mainBlock.includes('class="slop-section slop-hero"'));
  assert.ok(mainBlock.includes('id="features" class="slop-section slop-features"'));
  assert.ok(mainBlock.includes('id="stats" class="slop-section slop-stats"'));
  assert.ok(mainBlock.includes('id="testimonials" class="slop-section slop-testimonials"'));
  assert.ok(mainBlock.includes('id="cta" class="slop-section slop-cta"'));
  assert.ok(footerBlock.includes('<div class="slop-footer-extra">Built for NovaFlow AI</div>'));

  // Component CSS merged into #slop-tokens
  assert.ok(tokensStyle.includes('.slop-blobs'));
  assert.ok(tokensStyle.includes('.slop-glass-card'));
  assert.ok(tokensStyle.includes('.slop-stat-card'));
  assert.ok(tokensStyle.includes('.slop-testimonial-card'));
  assert.ok(tokensStyle.includes('.slop-cta-box'));
  assert.ok(tokensStyle.includes('.slop-footer-extra'));
});

test('5. Empty slots cleanly removed — zero <!-- SLOT: markers remain in output HTML', () => {
  const fullHtml = assembleHtml(loadSampleDeal());
  assert.equal(fullHtml.includes('<!-- SLOT:'), false);

  const minimalHtml = assembleHtml(makeLevel1Deal());
  assert.equal(minimalHtml.includes('<!-- SLOT:'), false);
  assert.doesNotMatch(minimalHtml, /<!--\s*SLOT:/i);
});

test('6. Animation & trope isolation: system.css and Level 1 deal emit zero @keyframes, scale(1.05), or backdrop-filter', () => {
  const systemCss = fs.readFileSync(SYSTEM_CSS_PATH, 'utf8');
  assert.doesNotMatch(systemCss, /backdrop-filter/i);
  assert.doesNotMatch(systemCss, /@keyframes/i);
  assert.doesNotMatch(systemCss, /scale\(1\.05\)/i);
  assert.doesNotMatch(systemCss, /#8b5cf6|#3b82f6|#ec4899/i);
  assert.doesNotMatch(systemCss, /linear-gradient\(/i);
  assert.doesNotMatch(systemCss, /box-shadow/i);

  const level1Html = assembleHtml(makeLevel1Deal());
  assert.doesNotMatch(level1Html, /@keyframes/i);
  assert.doesNotMatch(level1Html, /scale\(1\.05\)/i);
  assert.doesNotMatch(level1Html, /backdrop-filter/i);
  assert.equal(buildAnimationCss([]), '');

  // Selective animation emission
  const floatOnly = buildAnimationCss(['float']);
  assert.ok(floatOnly.includes('@keyframes float'));
  assert.ok(floatOnly.includes('.slop-animate-float'));
  assert.equal(floatOnly.includes('@keyframes pulse'), false);
  assert.equal(floatOnly.includes('scale(1.05)'), false);
  assert.equal(floatOnly.includes('@keyframes blob-drift'), false);

  // Full animation set
  const allAnims = buildAnimationCss([
    'float',
    'pulse',
    'blob-drift',
    'gradient-shift',
    'hover-scale',
    'neon-glow-pulse',
  ]);
  assert.ok(allAnims.includes('@keyframes float'));
  assert.ok(allAnims.includes('@keyframes pulse'));
  assert.ok(allAnims.includes('@keyframes blob-drift'));
  assert.ok(allAnims.includes('@keyframes gradient-shift'));
  assert.ok(allAnims.includes('scale(1.05)'));
  assert.ok(allAnims.includes('@keyframes neon-glow-pulse'));
});

test('7. HTML escaping and CSS sanitization neutralize injection attempts', () => {
  assert.equal(
    escapeHtml(`<script>alert("x" & 'y')</script>`),
    '&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;'
  );

  const deal = loadSampleDeal();
  deal.copy.brand = '<script>alert(1)</script> & Co "$&"';
  deal.copy.hero_headline = `<img src=x onerror="alert('xss')">`;
  deal.copy.features[0].title = '<b>Bold & "Fast"</b>';
  deal.palette.tokens.bg = '#09051A; } </style><script>alert(2)</script>\nbody { color: red';
  deal.font.heading = `Poppins'; }</style><script>alert(3)</script>`;

  const html = assembleHtml(deal);

  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.equal(html.includes('<script>alert(2)</script>'), false);
  assert.equal(html.includes('<script>alert(3)</script>'), false);
  assert.equal(html.includes(`<img src=x onerror="alert('xss')">`), false);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; Co &quot;$&amp;&quot;'));
  assert.ok(html.includes('&lt;b&gt;Bold &amp; &quot;Fast&quot;&lt;/b&gt;'));

  const sanitized = sanitizeCssValue('red; }\n</style><script>bad()</script>');
  assert.equal(sanitized.includes('</style>'), false);
  assert.equal(sanitized.includes(';'), false);
  assert.equal(sanitized.includes('}'), false);
  assert.equal(sanitized.includes('{'), false);
  assert.equal(sanitized.includes('\n'), false);

  // Interpolation handles missing indices cleanly and does not corrupt `$&`
  const interp = interpolateTemplate('{{brand}}|{{feature_2_title}}|{{stat_9_value}}', {
    brand: 'A$&B',
    features: [{ title: 'Only One' }],
    stats: [],
  });
  assert.equal(interp, 'A$&amp;B||');

  // Invalid deal throws when calling assembleHtml programmatically
  assert.throws(() => assembleHtml({ invalid: true }), /Deal validation failed/);
});

test('8. CLI supports --deal <file> --output <file>, stdin piping (--deal -), cwd independence, and exits 1 on invalid inputs', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-assemble-test-'));
  try {
    // a) --deal <file> --output <nested/out.html> from a different cwd
    const outPath = path.join(tmpDir, 'nested', 'dir', 'page.html');
    const fileRun = spawnSync(
      process.execPath,
      [ASSEMBLE_SCRIPT, '--deal', FIXTURE_PATH, '--output', outPath],
      { cwd: tmpDir, encoding: 'utf8' }
    );
    assert.equal(fileRun.status, 0, `Expected exit 0, got stderr: ${fileRun.stderr}`);
    assert.equal(fs.existsSync(outPath), true);
    const writtenHtml = fs.readFileSync(outPath, 'utf8');
    assert.match(writtenHtml, /^<!DOCTYPE html>/i);
    assert.equal(writtenHtml.includes('<!-- SLOT:'), false);
    assert.ok(writtenHtml.includes('NovaFlow AI'));

    // b) stdin piping with --deal - writing to stdout
    const rawDeal = fs.readFileSync(FIXTURE_PATH, 'utf8');
    const stdinRun = spawnSync(process.execPath, [ASSEMBLE_SCRIPT, '--deal', '-'], {
      input: rawDeal,
      encoding: 'utf8',
    });
    assert.equal(stdinRun.status, 0, `Expected exit 0, got stderr: ${stdinRun.stderr}`);
    assert.equal(stdinRun.stdout, writtenHtml);

    // c) stdin piping with omitted --deal
    const omittedDealRun = spawnSync(process.execPath, [ASSEMBLE_SCRIPT], {
      input: rawDeal,
      encoding: 'utf8',
    });
    assert.equal(omittedDealRun.status, 0);
    assert.equal(omittedDealRun.stdout, writtenHtml);

    // d) invalid JSON exits with code 1
    const badJsonRun = spawnSync(process.execPath, [ASSEMBLE_SCRIPT, '--deal', '-'], {
      input: '{ not valid json',
      encoding: 'utf8',
    });
    assert.equal(badJsonRun.status, 1);
    assert.match(badJsonRun.stderr, /Invalid JSON/i);

    // e) schema-invalid JSON exits with code 1
    const badSchemaRun = spawnSync(process.execPath, [ASSEMBLE_SCRIPT, '--deal', '-'], {
      input: JSON.stringify({ seed: 'nope', level: 99 }),
      encoding: 'utf8',
    });
    assert.equal(badSchemaRun.status, 1);
    assert.match(badSchemaRun.stderr, /Invalid deal schema/i);

    // f) missing file exits with code 1
    const missingFileRun = spawnSync(
      process.execPath,
      [ASSEMBLE_SCRIPT, '--deal', path.join(tmpDir, 'does-not-exist.json')],
      { encoding: 'utf8' }
    );
    assert.equal(missingFileRun.status, 1);
    assert.match(missingFileRun.stderr, /Error reading deal input/i);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
