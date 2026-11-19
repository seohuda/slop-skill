import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { dealDesign } from '../skills/slop-skill/scripts/deal.mjs';
import { assembleHtml } from '../skills/slop-skill/scripts/assemble.mjs';
import { loadRules, scoreHtml } from '../skills/slop-skill/scripts/slop-meter.mjs';
import { validateDealOutput } from '../skills/slop-skill/library/schema.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPTS_DIR = path.join(REPO_ROOT, 'skills', 'slop-skill', 'scripts');
const DEAL_SCRIPT = path.join(SCRIPTS_DIR, 'deal.mjs');
const ASSEMBLE_SCRIPT = path.join(SCRIPTS_DIR, 'assemble.mjs');
const METER_SCRIPT = path.join(SCRIPTS_DIR, 'slop-meter.mjs');
const SKILL_MD_PATH = path.join(REPO_ROOT, 'skills', 'slop-skill', 'SKILL.md');
const INSTALL_SH_PATH = path.join(REPO_ROOT, 'install.sh');

const rules = loadRules();

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('E2E Level 5 pipeline: deal(5) -> assemble -> slop-meter achieves >= 81 (Transcendent)', () => {
  const deal = dealDesign({ level: 5, seed: 42, page: 'landing', brand: 'NovaFlow AI' });
  assert.equal(validateDealOutput(deal).valid, true);
  assert.ok(deal.components.length >= 7, `expected >= 7 components, got ${deal.components.length}`);
  assert.ok(deal.animations.length >= 4, `expected >= 4 animations, got ${deal.animations.length}`);

  const html = assembleHtml(deal);
  assert.equal(html.includes('<!-- SLOT:'), false, 'assembled HTML must have zero slot comments');
  assert.match(html, /<!DOCTYPE html>/i);
  assert.match(html, /fonts\.googleapis\.com/);

  const report = scoreHtml(html, rules);
  assert.ok(
    report.score >= 81,
    `expected Level 5 score >= 81, got ${report.score} (${report.grade})`
  );
  assert.equal(report.grade, 'Transcendent');
});

test('E2E Level 1 pipeline: deal(1) -> assemble -> slop-meter stays <= 50 and cleanly isolated', () => {
  const deal = dealDesign({ level: 1, seed: 42, page: 'landing', brand: 'NovaFlow AI' });
  assert.equal(validateDealOutput(deal).valid, true);
  assert.ok(deal.components.length >= 2 && deal.components.length <= 3);
  assert.deepEqual(deal.animations, []);

  const html = assembleHtml(deal);
  assert.equal(html.includes('<!-- SLOT:'), false);
  assert.equal(html.includes('@keyframes'), false, 'Level 1 HTML must not emit @keyframes');
  assert.equal(html.includes('backdrop-filter'), false, 'Level 1 HTML must not emit backdrop-filter');

  const report = scoreHtml(html, rules);
  assert.ok(
    report.score <= 50,
    `expected Level 1 score <= 50, got ${report.score} (${report.grade})`
  );
});

test('E2E fixed-seed calibration holds across seeds for Level 1 (<= 50), Level 3 (>= 51), Level 5 (>= 81)', () => {
  const seeds = [1, 7, 42, 99, 123];
  for (const seed of seeds) {
    const l1 = scoreHtml(assembleHtml(dealDesign({ level: 1, seed, brand: 'DemoFlow AI' })), rules);
    const l3 = scoreHtml(assembleHtml(dealDesign({ level: 3, seed, brand: 'DemoFlow AI' })), rules);
    const l5 = scoreHtml(assembleHtml(dealDesign({ level: 5, seed, brand: 'DemoFlow AI' })), rules);

    assert.ok(l1.score <= 50, `L1 seed=${seed} score=${l1.score} should be <= 50`);
    assert.ok(l3.score >= 51, `L3 seed=${seed} score=${l3.score} should be >= 51`);
    assert.ok(l5.score >= 81, `L5 seed=${seed} score=${l5.score} should be >= 81`);
    assert.ok(l1.score < l3.score, `expected L1 (${l1.score}) < L3 (${l3.score}) for seed=${seed}`);
    assert.ok(l3.score <= l5.score, `expected L3 (${l3.score}) <= L5 (${l5.score}) for seed=${seed}`);
  }
});

test('E2E CLI pipeline works from outside project directory (cwd-independent) and is byte-reproducible', () => {
  const tmpDir = makeTempDir('slop-e2e-cli-');
  try {
    const out1 = path.join(tmpDir, 'run1.html');
    const out2 = path.join(tmpDir, 'run2.html');

    const dealJson1 = execFileSync(
      process.execPath,
      [DEAL_SCRIPT, '--level', '5', '--seed', '42', '--page', 'landing', '--brand', 'NovaFlow AI'],
      { cwd: tmpDir, encoding: 'utf8' }
    );
    const dealJson2 = execFileSync(
      process.execPath,
      [DEAL_SCRIPT, '--level', '5', '--seed', '42', '--page', 'landing', '--brand', 'NovaFlow AI'],
      { cwd: tmpDir, encoding: 'utf8' }
    );
    assert.equal(dealJson1, dealJson2, 'deal CLI must be byte-identical for same seed');

    execFileSync(
      process.execPath,
      [ASSEMBLE_SCRIPT, '--deal', '-', '--output', out1],
      { cwd: tmpDir, input: dealJson1, encoding: 'utf8' }
    );
    execFileSync(
      process.execPath,
      [ASSEMBLE_SCRIPT, '--deal', '-', '--output', out2],
      { cwd: tmpDir, input: dealJson2, encoding: 'utf8' }
    );

    const html1 = fs.readFileSync(out1, 'utf8');
    const html2 = fs.readFileSync(out2, 'utf8');
    assert.equal(html1, html2, 'assembled HTML must be byte-identical for same deal');
    assert.equal(html1.includes('<!-- SLOT:'), false);

    const meterOut = execFileSync(
      process.execPath,
      [METER_SCRIPT, out1, '--min', '81', '--json'],
      { cwd: tmpDir, encoding: 'utf8' }
    );
    const parsed = JSON.parse(meterOut);
    assert.ok(parsed.score >= 81, `CLI slop-meter score ${parsed.score} should be >= 81`);
    assert.equal(parsed.grade, 'Transcendent');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('SKILL.md contains valid frontmatter and all required Korean/English trigger phrases', () => {
  const raw = fs.readFileSync(SKILL_MD_PATH, 'utf8');
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fmMatch, 'SKILL.md must begin with YAML frontmatter');
  const frontmatter = fmMatch[1];

  assert.match(frontmatter, /^name:\s*slop-skill$/m);
  assert.match(frontmatter, /^description:/m);

  const requiredTriggers = [
    'AI slop 디자인을 만들어줘',
    '일부러 AI스럽게 만들어줘',
    '전형적인 AI 랜딩페이지 만들어줘',
    '슬롭 강도 5로 디자인해줘',
    '일부러 ChatGPT가 만든 것처럼 만들어줘',
    'Make this look like AI slop',
  ];
  for (const phrase of requiredTriggers) {
    assert.ok(
      frontmatter.includes(phrase),
      `SKILL.md frontmatter description must include trigger: "${phrase}"`
    );
  }
});

test('install.sh safely installs symlink, is idempotent, and refuses overwrite without --force', () => {
  const tmpDir = makeTempDir('slop-e2e-install-');
  try {
    const linkPath = path.join(tmpDir, 'slop-skill');
    const expectedTarget = path.join(REPO_ROOT, 'skills', 'slop-skill');

    // Fresh install
    execFileSync('bash', [INSTALL_SH_PATH, '--target', tmpDir], { encoding: 'utf8' });
    assert.equal(fs.lstatSync(linkPath).isSymbolicLink(), true);
    assert.equal(fs.realpathSync(linkPath), fs.realpathSync(expectedTarget));

    // Idempotent re-run succeeds
    const rerunOut = execFileSync('bash', [INSTALL_SH_PATH, '--target', tmpDir], {
      encoding: 'utf8',
    });
    assert.match(rerunOut, /Already installed/i);

    // Replace symlink with a conflicting directory -> must refuse without --force
    fs.unlinkSync(linkPath);
    fs.mkdirSync(linkPath);
    assert.throws(
      () => execFileSync('bash', [INSTALL_SH_PATH, '--target', tmpDir], { stdio: 'pipe' }),
      'install.sh must refuse to overwrite an existing directory without --force'
    );
    assert.equal(fs.lstatSync(linkPath).isDirectory(), true);

    // With --force -> replaces cleanly
    execFileSync('bash', [INSTALL_SH_PATH, '--target', tmpDir, '--force'], { encoding: 'utf8' });
    assert.equal(fs.lstatSync(linkPath).isSymbolicLink(), true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
