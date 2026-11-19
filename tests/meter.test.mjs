import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  SLOP_CATEGORIES,
  validateRule,
} from '../skills/slop-skill/library/schema.mjs';
import {
  loadRules,
  scoreHtml,
  getGrade,
  formatTextReport,
  parseCliArgs,
} from '../skills/slop-skill/scripts/slop-meter.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const CLI_PATH = resolve(ROOT_DIR, 'skills/slop-skill/scripts/slop-meter.mjs');
const SLOP_FIXTURE = resolve(__dirname, 'fixtures/slop.html');
const CLEAN_FIXTURE = resolve(__dirname, 'fixtures/clean.html');

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8',
    cwd: options.cwd ?? ROOT_DIR,
  });
}

test('loadRules loads >= 30 valid unique rules covering all 5 categories', () => {
  const rules = loadRules();
  assert.ok(rules.length >= 30, `Expected at least 30 rules, got ${rules.length}`);
  assert.ok(rules.length >= 32, `Expected at least 32 rules, got ${rules.length}`);

  const ids = new Set();
  const categories = new Set();

  for (const rule of rules) {
    const check = validateRule(rule);
    assert.equal(
      check.valid,
      true,
      `Rule "${rule.id}" failed validation: ${check.errors.join('; ')}`
    );
    assert.equal(ids.has(rule.id), false, `Duplicate rule id: ${rule.id}`);
    ids.add(rule.id);
    categories.add(rule.category);
  }

  for (const cat of SLOP_CATEGORIES) {
    assert.ok(categories.has(cat), `Missing category: ${cat}`);
  }
});

test('slop.html fixture scores >= 85 with Transcendent grade', () => {
  const html = readFileSync(SLOP_FIXTURE, 'utf8');
  const report = scoreHtml(html);

  assert.ok(report.score >= 81, `Expected score >= 81, got ${report.score}`);
  assert.ok(report.score >= 85, `Expected score >= 85, got ${report.score}`);
  assert.equal(report.grade, 'Transcendent');
  assert.ok(report.passedCount >= 30);
});

test('clean.html fixture scores <= 25 with Artisanal grade', () => {
  const html = readFileSync(CLEAN_FIXTURE, 'utf8');
  const report = scoreHtml(html);

  assert.ok(report.score <= 25, `Expected score <= 25, got ${report.score}`);
  assert.equal(report.grade, 'Artisanal');
});

test('Level 1 subtle slop HTML calibrates under 50 (Artisanal/Mild)', () => {
  const level1Html = `<!DOCTYPE html>
  <html lang="en">
  <head>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
    <style>
      :root {
        --slop-bg: #F8FAFC;
        --slop-fg: #0F172A;
        --slop-accent1: #3B82F6;
        --slop-accent2: #64748B;
        --slop-glow: rgba(15, 23, 42, 0.06);
        --slop-gradient: linear-gradient(135deg, #F8FAFC, #E2E8F0);
        --slop-font-heading: 'Inter', system-ui, sans-serif;
        --slop-font-body: 'Inter', system-ui, sans-serif;
      }
      body { background: var(--slop-bg); color: var(--slop-fg); font-family: var(--slop-font-body); }
      .slop-hero { text-align: center; padding: 4rem 1.5rem; }
      .slop-hero h1 { font-size: 2.25rem; }
      .slop-card { background: #FFFFFF; border: 1px solid #E2E8F0; padding: 1.5rem; }
      .slop-btn-primary { background: #2563EB; color: #FFFFFF; padding: 0.75rem 1.5rem; }
    </style>
  </head>
  <body>
    <section class="slop-hero">
      <h1>Clear Project Tracking for Small Teams</h1>
      <p>Coordinate milestones and tasks seamlessly without clutter.</p>
      <a href="#start" class="slop-btn-primary">Start Trial</a>
    </section>
    <section>
      <article class="slop-card"><h3>Task Boards</h3><p>See open work at a glance.</p></article>
      <article class="slop-card"><h3>Weekly Digest</h3><p>Summary sent every Friday.</p></article>
      <article class="slop-card"><h3>CSV Export</h3><p>Download records anytime.</p></article>
    </section>
  </body>
  </html>`;

  const report = scoreHtml(level1Html);
  assert.ok(report.score < 50, `Expected Level 1 score < 50, got ${report.score}`);
  assert.ok(['Artisanal', 'Mild'].includes(report.grade));
});

test('individual PASS/FAIL detection across all 5 categories', () => {
  const rules = loadRules();
  const byId = (report, id) => {
    const found = report.results.find((r) => r.id === id);
    assert.ok(found, `Missing rule result for ${id}`);
    return found.passed;
  };

  // Color rules
  const purplePass = scoreHtml(
    '<style>:root { --slop-bg: #09051A; --slop-gradient: linear-gradient(135deg, #8B5CF6, #3B82F6); --slop-glow: rgba(139, 92, 246, 0.55); }</style>',
    rules
  );
  assert.equal(byId(purplePass, 'purple-gradient'), true);
  assert.equal(byId(purplePass, 'purple-blue-combo'), true);
  assert.equal(byId(purplePass, 'dark-void-bg'), true);
  assert.equal(byId(purplePass, 'dark-purple-combo'), true);
  assert.equal(byId(purplePass, 'neon-glow-shadow'), true);

  const colorFail = scoreHtml(
    '<style>body { background: #FFFFFF; color: #1C1917; }</style>',
    rules
  );
  assert.equal(byId(colorFail, 'purple-gradient'), false);
  assert.equal(byId(colorFail, 'purple-blue-combo'), false);
  assert.equal(byId(colorFail, 'dark-void-bg'), false);
  assert.equal(byId(colorFail, 'dark-purple-combo'), false);
  assert.equal(byId(colorFail, 'neon-glow-shadow'), false);

  // Typography rules
  const typoPass = scoreHtml(
    `<link href="https://fonts.googleapis.com/css2?family=Inter&family=Poppins" rel="stylesheet">
     <style>
       body { font-family: 'Inter', sans-serif; text-align: center; }
       h1 { font-size: clamp(2.5rem, 5vw, 4.5rem); letter-spacing: -0.04em; background-clip: text; -webkit-text-fill-color: transparent; text-align: center; }
       .cta { justify-content: center; }
     </style>`,
    rules
  );
  assert.equal(byId(typoPass, 'generic-saas-font'), true);
  assert.equal(byId(typoPass, 'gradient-text-headline'), true);
  assert.equal(byId(typoPass, 'universal-centering'), true);
  assert.equal(byId(typoPass, 'oversized-display-h1'), true);
  assert.equal(byId(typoPass, 'tight-display-tracking'), true);
  assert.equal(byId(typoPass, 'google-fonts-import'), true);

  const typoFail = scoreHtml(
    '<style>body { font-family: Georgia, serif; } h1 { font-size: 2rem; letter-spacing: 0; }</style>',
    rules
  );
  assert.equal(byId(typoFail, 'generic-saas-font'), false);
  assert.equal(byId(typoFail, 'gradient-text-headline'), false);
  assert.equal(byId(typoFail, 'universal-centering'), false);
  assert.equal(byId(typoFail, 'oversized-display-h1'), false);
  assert.equal(byId(typoFail, 'tight-display-tracking'), false);
  assert.equal(byId(typoFail, 'google-fonts-import'), false);

  // Layout rules
  const layoutPass = scoreHtml(
    `<section class="slop-hero">
       <span class="slop-badge">✨ Powered by Next-Gen AI</span>
       <div class="hero-actions">
         <a class="btn-primary" href="#">Start</a>
         <a class="btn-secondary" href="#">Demo</a>
       </div>
     </section>
     <div>🚀 ⚡ 🧠</div>
     <div><span>10K+</span> <span>99.9%</span></div>
     <blockquote class="testimonial">★★★★★ Great</blockquote>
     <form><h3>Join the waitlist</h3><input type="email" /></form>`,
    rules
  );
  assert.equal(byId(layoutPass, 'centered-hero'), true);
  assert.equal(byId(layoutPass, 'sparkle-pill-badge'), true);
  assert.equal(byId(layoutPass, 'dual-cta-buttons'), true);
  assert.equal(byId(layoutPass, 'emoji-feature-cards'), true);
  assert.equal(byId(layoutPass, 'fake-statistics'), true);
  assert.equal(byId(layoutPass, 'star-testimonials'), true);
  assert.equal(byId(layoutPass, 'newsletter-waitlist-box'), true);

  const layoutFail = scoreHtml(
    '<main><h1>Annual Report</h1><p>Published in March.</p><a href="/pdf">Download PDF</a></main>',
    rules
  );
  assert.equal(byId(layoutFail, 'centered-hero'), false);
  assert.equal(byId(layoutFail, 'sparkle-pill-badge'), false);
  assert.equal(byId(layoutFail, 'dual-cta-buttons'), false);
  assert.equal(byId(layoutFail, 'emoji-feature-cards'), false);
  assert.equal(byId(layoutFail, 'fake-statistics'), false);
  assert.equal(byId(layoutFail, 'star-testimonials'), false);
  assert.equal(byId(layoutFail, 'newsletter-waitlist-box'), false);

  // Effect rules
  const effectPass = scoreHtml(
    `<style>
       .glass { backdrop-filter: blur(16px); box-shadow: 0 4px 12px #000; }
       .a { box-shadow: 0 1px 2px #000; }
       .b { box-shadow: 0 2px 4px #000; }
       .c { box-shadow: 0 3px 6px #000; }
       .blob { filter: blur(90px); }
       .card:hover { transform: scale(1.05); }
       @keyframes slop-float { from { transform: translateY(0); } to { transform: translateY(-8px); } }
       @keyframes slop-pulse { from { opacity: 1; } to { opacity: 0.7; } }
     </style>
     <span class="slop-decor">✦</span>`,
    rules
  );
  assert.equal(byId(effectPass, 'glassmorphism'), true);
  assert.equal(byId(effectPass, 'float-animation'), true);
  assert.equal(byId(effectPass, 'pulse-animation'), true);
  assert.equal(byId(effectPass, 'blob-background'), true);
  assert.equal(byId(effectPass, 'excessive-shadows'), true);
  assert.equal(byId(effectPass, 'hover-scale-105'), true);
  assert.equal(byId(effectPass, 'background-decorations'), true);

  const effectFail = scoreHtml('<style>.box { border: 1px solid #ccc; }</style>', rules);
  assert.equal(byId(effectFail, 'glassmorphism'), false);
  assert.equal(byId(effectFail, 'float-animation'), false);
  assert.equal(byId(effectFail, 'pulse-animation'), false);
  assert.equal(byId(effectFail, 'blob-background'), false);
  assert.equal(byId(effectFail, 'excessive-shadows'), false);
  assert.equal(byId(effectFail, 'hover-scale-105'), false);
  assert.equal(byId(effectFail, 'background-decorations'), false);

  // Copy rules
  const copyPass = scoreHtml(
    `<p>Revolutionize your workflow! Unlock the power of autonomous AI-powered software
       to seamlessly supercharge operations and elevate your team to the next level.</p>`,
    rules
  );
  assert.equal(byId(copyPass, 'copy-revolutionize'), true);
  assert.equal(byId(copyPass, 'copy-unlock-power'), true);
  assert.equal(byId(copyPass, 'copy-seamlessly'), true);
  assert.equal(byId(copyPass, 'copy-supercharge'), true);
  assert.equal(byId(copyPass, 'copy-elevate'), true);
  assert.equal(byId(copyPass, 'copy-next-level'), true);
  assert.equal(byId(copyPass, 'copy-buzzword-density'), true);

  const copyFail = scoreHtml(
    '<p>Our command-line tool formats CSV files and validates column headers locally.</p>',
    rules
  );
  assert.equal(byId(copyFail, 'copy-revolutionize'), false);
  assert.equal(byId(copyFail, 'copy-unlock-power'), false);
  assert.equal(byId(copyFail, 'copy-seamlessly'), false);
  assert.equal(byId(copyFail, 'copy-supercharge'), false);
  assert.equal(byId(copyFail, 'copy-elevate'), false);
  assert.equal(byId(copyFail, 'copy-next-level'), false);
  assert.equal(byId(copyFail, 'copy-buzzword-density'), false);
});

test('weighted score calculation and count rule evaluation are exact', () => {
  const customRules = [
    {
      id: 'rule-a',
      name: 'Rule A',
      category: 'color',
      weight: 3,
      type: 'regex',
      pattern: 'alpha',
      description: 'Matches alpha',
    },
    {
      id: 'rule-b',
      name: 'Rule B',
      category: 'effect',
      weight: 4,
      type: 'count',
      pattern: 'beta',
      min: 2,
      description: 'Matches beta at least twice',
    },
    {
      id: 'rule-c',
      name: 'Rule C',
      category: 'copy',
      weight: 5,
      type: 'regex',
      pattern: 'gamma',
      description: 'Matches gamma',
    },
  ];

  // Match rule-a (3) + rule-b (4) = 7 / 12 => Math.round(58.333...) = 58
  const r1 = scoreHtml('alpha beta beta', customRules);
  assert.equal(r1.matchedWeight, 7);
  assert.equal(r1.totalWeight, 12);
  assert.equal(r1.score, Math.round((7 / 12) * 100));
  assert.equal(r1.score, 58);
  assert.equal(r1.grade, 'Full Slop');
  assert.equal(r1.passedCount, 2);
  assert.equal(r1.totalRules, 3);

  // Only one beta -> rule-b fails, only rule-a (3) passes => 3 / 12 = 25
  const r2 = scoreHtml('alpha beta', customRules);
  assert.equal(r2.matchedWeight, 3);
  assert.equal(r2.score, 25);
  assert.equal(r2.grade, 'Artisanal');

  // Empty rule array -> score 0
  const rEmpty = scoreHtml('anything', []);
  assert.equal(rEmpty.score, 0);
  assert.equal(rEmpty.grade, 'Artisanal');
});

test('getGrade handles all exact boundary values', () => {
  assert.equal(getGrade(0), 'Artisanal');
  assert.equal(getGrade(25), 'Artisanal');
  assert.equal(getGrade(26), 'Mild');
  assert.equal(getGrade(50), 'Mild');
  assert.equal(getGrade(51), 'Full Slop');
  assert.equal(getGrade(80), 'Full Slop');
  assert.equal(getGrade(81), 'Transcendent');
  assert.equal(getGrade(100), 'Transcendent');
});

test('parseCliArgs parses valid flags and rejects invalid inputs', () => {
  assert.deepEqual(parseCliArgs(['page.html']), {
    file: 'page.html',
    min: null,
    json: false,
    rulesDir: null,
    help: false,
  });

  assert.deepEqual(parseCliArgs(['page.html', '--min', '81', '--json', '--rules', './r']), {
    file: 'page.html',
    min: 81,
    json: true,
    rulesDir: './r',
    help: false,
  });

  assert.deepEqual(parseCliArgs(['--min=50', '--rules=./custom', 'page.html']), {
    file: 'page.html',
    min: 50,
    json: false,
    rulesDir: './custom',
    help: false,
  });

  assert.throws(() => parseCliArgs([]), /Missing required/);
  assert.throws(() => parseCliArgs(['page.html', '--min', '101']), /between 0 and 100/);
  assert.throws(() => parseCliArgs(['page.html', '--min', '-5']), /between 0 and 100/);
  assert.throws(() => parseCliArgs(['page.html', '--min', 'abc']), /between 0 and 100/);
  assert.throws(() => parseCliArgs(['page.html', '--unknown']), /Unknown option/);
});

test('CLI --min exits 0 when score >= N and exits 1 when score < N', () => {
  const passRun = runCli([SLOP_FIXTURE, '--min', '81']);
  assert.equal(passRun.status, 0);
  assert.match(passRun.stdout, /Slop Meter/);
  assert.match(passRun.stdout, /Score: \d+\/100/);
  assert.match(passRun.stdout, /Grade: Transcendent/);

  const failRun = runCli([CLEAN_FIXTURE, '--min', '50']);
  assert.equal(failRun.status, 1);
  // Still prints full report before exiting 1
  assert.match(failRun.stdout, /Slop Meter/);
  assert.match(failRun.stdout, /Score: \d+\/100/);
  assert.match(failRun.stdout, /Grade: Artisanal/);
});

test('CLI --json outputs valid contract JSON schema and works from any cwd', () => {
  const res = runCli([CLEAN_FIXTURE, '--json'], { cwd: '/tmp' });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);

  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.file, CLEAN_FIXTURE);
  assert.equal(typeof parsed.score, 'number');
  assert.equal(parsed.grade, 'Artisanal');
  assert.equal(typeof parsed.matchedWeight, 'number');
  assert.equal(typeof parsed.totalWeight, 'number');
  assert.equal(typeof parsed.passedCount, 'number');
  assert.equal(typeof parsed.totalRules, 'number');
  assert.ok(parsed.totalRules >= 30);
  assert.equal(typeof parsed.categories, 'object');
  for (const cat of SLOP_CATEGORIES) {
    assert.ok(cat in parsed.categories, `Missing category ${cat} in JSON output`);
  }
  assert.ok(Array.isArray(parsed.results));
  assert.equal(parsed.results.length, parsed.totalRules);
});

test('CLI text output and formatTextReport follow contract format', () => {
  const res = runCli([SLOP_FIXTURE]);
  assert.equal(res.status, 0);
  assert.ok(res.stdout.startsWith('Slop Meter\n\n'));
  assert.match(res.stdout, /\[PASS\] Purple gradient/);
  assert.match(res.stdout, /\[PASS\] Glassmorphism/);
  assert.match(res.stdout, /\nScore: \d+\/100\nGrade: Transcendent\n$/);

  const formatted = formatTextReport({
    score: 50,
    grade: 'Mild',
    results: [
      { id: 'a', name: 'Rule Alpha', passed: true },
      { id: 'b', name: 'Rule Beta', passed: false },
    ],
  });
  assert.equal(
    formatted,
    ['Slop Meter', '', '[PASS] Rule Alpha', '[FAIL] Rule Beta', '', 'Score: 50/100', 'Grade: Mild'].join(
      '\n'
    )
  );
});

test('CLI exits 1 with clear stderr on missing file or invalid --min', () => {
  const missing = runCli(['tests/fixtures/does-not-exist.html']);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Unable to read HTML file/i);

  const badMin = runCli([SLOP_FIXTURE, '--min', 'not-a-number']);
  assert.equal(badMin.status, 1);
  assert.match(badMin.stderr, /Invalid --min value/i);

  const badRulesDir = runCli([SLOP_FIXTURE, '--rules', 'tests/fixtures/no-such-dir']);
  assert.equal(badRulesDir.status, 1);
  assert.match(badRulesDir.stderr, /Rules directory not found/i);
});
