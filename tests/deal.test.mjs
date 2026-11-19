import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  createPrng,
  pick,
  weightedPick,
  weightedSampleWithoutReplacement,
  shuffle,
  randInt,
} from '../skills/slop-skill/scripts/lib/prng.mjs';
import {
  DEFAULT_LIBRARY_DIR,
  loadLibrary,
  parseCliArgs,
  dealDesign,
} from '../skills/slop-skill/scripts/deal.mjs';
import {
  VALID_ANIMATIONS,
  VALID_PAGES,
  validateLibraryItem,
  validateCopyLibrary,
  validateDealOutput,
} from '../skills/slop-skill/library/schema.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const DEAL_SCRIPT = path.join(REPO_ROOT, 'skills', 'slop-skill', 'scripts', 'deal.mjs');
const MINI_LIBRARY_DIR = path.join(__dirname, 'fixtures', 'mini-library');

test('mini-library fixture is completely schema-valid', () => {
  const lib = loadLibrary(MINI_LIBRARY_DIR);
  assert.ok(lib.palettes.length >= 5, 'mini-library should contain at least 5 palettes');
  assert.ok(lib.fonts.length >= 3, 'mini-library should contain at least 3 fonts');
  assert.ok(lib.components.length >= 10, 'mini-library should contain at least 10 components');

  for (const palette of lib.palettes) {
    assert.equal(validateLibraryItem(palette, 'palette').valid, true);
  }
  for (const font of lib.fonts) {
    assert.equal(validateLibraryItem(font, 'font').valid, true);
  }
  for (const component of lib.components) {
    assert.equal(validateLibraryItem(component, 'component').valid, true);
  }
  assert.equal(validateCopyLibrary(lib.copy, { minItems: 6 }).valid, true);
});

test('Mulberry32 PRNG determinism, range, distribution sanity, and helpers', () => {
  const rngA = createPrng(12345);
  const rngB = createPrng(12345);
  const rngC = createPrng(99999);

  const seqA = Array.from({ length: 50 }, () => rngA());
  const seqB = Array.from({ length: 50 }, () => rngB());
  const seqC = Array.from({ length: 50 }, () => rngC());

  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);

  // Distribution sanity over 10,000 draws
  const distRng = createPrng(42);
  const buckets = new Array(10).fill(0);
  let sum = 0;
  const draws = 10000;
  for (let i = 0; i < draws; i += 1) {
    const v = distRng();
    assert.ok(v >= 0 && v < 1, `PRNG value out of [0, 1): ${v}`);
    sum += v;
    buckets[Math.floor(v * 10)] += 1;
  }
  const mean = sum / draws;
  assert.ok(mean > 0.47 && mean < 0.53, `Expected mean near 0.5, got ${mean}`);
  for (const count of buckets) {
    assert.ok(count > 850 && count < 1150, `Expected roughly uniform bucket (~1000), got ${count}`);
  }

  // Invalid seeds throw
  assert.throws(() => createPrng(3.14), RangeError);
  assert.throws(() => createPrng(Number.NaN), RangeError);
  assert.throws(() => createPrng('42'), RangeError);

  // Negative integer seeds are supported deterministically
  assert.equal(createPrng(-7)(), createPrng(-7)());

  // Helpers: pick, weightedPick, weightedSampleWithoutReplacement, shuffle, randInt
  const helperRng = createPrng(77);
  assert.equal(pick(helperRng, []), null);
  assert.equal(weightedPick(helperRng, [], () => 1), null);
  assert.deepEqual(weightedSampleWithoutReplacement(helperRng, [], 3, () => 1), []);

  const original = [1, 2, 3, 4, 5, 6];
  const shuffled = shuffle(createPrng(77), original);
  assert.deepEqual(original, [1, 2, 3, 4, 5, 6], 'shuffle must not mutate input');
  assert.deepEqual([...shuffled].sort((a, b) => a - b), original);

  const sample = weightedSampleWithoutReplacement(
    createPrng(77),
    ['a', 'b', 'c', 'd'],
    3,
    (x) => (x === 'd' ? 10 : 1)
  );
  assert.equal(sample.length, 3);
  assert.equal(new Set(sample).size, 3, 'sample without replacement must contain unique items');

  const intRng = createPrng(88);
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) {
    const val = randInt(intRng, 2, 5);
    assert.ok(Number.isInteger(val) && val >= 2 && val <= 5);
    seen.add(val);
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [2, 3, 4, 5]);
});

test('seed reproducibility and variation across seeds', () => {
  const first = dealDesign({ level: 4, seed: 42, page: 'landing', libraryDir: MINI_LIBRARY_DIR });
  const second = dealDesign({ level: 4, seed: 42, page: 'landing', libraryDir: MINI_LIBRARY_DIR });
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));

  const variations = new Set();
  for (let seed = 1; seed <= 25; seed += 1) {
    const dealt = dealDesign({ level: 3, seed, page: 'saas', libraryDir: MINI_LIBRARY_DIR });
    variations.add(
      JSON.stringify({
        palette: dealt.palette.id,
        font: dealt.font.id,
        headline: dealt.copy.hero_headline,
        components: dealt.components.map((c) => c.id),
      })
    );
  }
  assert.ok(variations.size > 10, `Expected strong seed variation, got ${variations.size} unique outputs`);
});

test('levels 1..5 match contract component counts, hero budget, animations, and badges', () => {
  const expectedComponents = {
    1: [2, 3],
    2: [3, 4],
    3: [4, 5],
    4: [6, 7],
    5: [7, 10],
  };

  const expectedAnimations = {
    1: [0, 0],
    2: [0, 1],
    3: [1, 1],
    4: [2, 3],
    5: [4, 6],
  };

  for (let level = 1; level <= 5; level += 1) {
    const [minComp, maxComp] = expectedComponents[level];
    const [minAnim, maxAnim] = expectedAnimations[level];

    for (let seed = 1; seed <= 30; seed += 1) {
      const deal = dealDesign({ level, seed, page: 'landing', libraryDir: MINI_LIBRARY_DIR });

      // Component count within contract table
      assert.ok(
        deal.components.length >= minComp && deal.components.length <= maxComp,
        `Level ${level} seed ${seed}: component count ${deal.components.length} not in [${minComp}, ${maxComp}]`
      );

      // At most 1 hero, and exactly 1 hero because mini-library has eligible heroes at all levels
      const heroCount = deal.components.filter((c) => c.slot === 'hero').length;
      assert.equal(heroCount, 1, `Level ${level} seed ${seed}: expected exactly 1 hero, got ${heroCount}`);

      // No duplicate components
      const ids = deal.components.map((c) => c.id);
      assert.equal(new Set(ids).size, ids.length, 'Components must be unique');

      // Level 4-5 slot diversity
      if (level >= 4) {
        const distinctSlots = new Set(deal.components.map((c) => c.slot));
        assert.ok(
          distinctSlots.size >= 6,
          `Level ${level} seed ${seed}: expected broad slot coverage (>= 6), got ${distinctSlots.size}`
        );
      }

      // Animation count & rules
      assert.ok(
        deal.animations.length >= minAnim && deal.animations.length <= maxAnim,
        `Level ${level} seed ${seed}: animation count ${deal.animations.length} not in [${minAnim}, ${maxAnim}]`
      );
      for (const anim of deal.animations) {
        assert.ok(VALID_ANIMATIONS.includes(anim));
      }
      if (level === 1) {
        assert.deepEqual(deal.animations, []);
        assert.equal(deal.copy.badge, '');
      } else if (level === 2) {
        assert.ok(deal.copy.badge.length > 0 && !deal.copy.badge.includes('✨'));
      } else if (level === 3) {
        assert.deepEqual(deal.animations, ['float']);
        assert.equal(deal.copy.badge, '✨ Powered by Next-Gen AI');
      } else if (level === 4) {
        assert.ok(deal.animations.includes('float') && deal.animations.includes('pulse'));
        assert.equal(deal.copy.badge, '✨ Powered by Next-Gen AI');
      } else if (level === 5) {
        assert.deepEqual(deal.animations, [...VALID_ANIMATIONS]);
        assert.equal(deal.copy.badge, '✨ Powered by Next-Gen AI');
      }

      // Copy structure sanity
      assert.notEqual(deal.copy.primary_cta, deal.copy.secondary_cta);
      assert.equal(deal.copy.features.length, 3);
      assert.equal(deal.copy.stats.length, 4);
      assert.equal(deal.copy.testimonials.length, 3);
    }
  }
});

test('min_level filtering is strictly enforced and Level 4-5 prefer dark neon palettes', () => {
  for (let level = 1; level <= 5; level += 1) {
    for (let seed = 1; seed <= 40; seed += 1) {
      const deal = dealDesign({ level, seed, page: 'landing', libraryDir: MINI_LIBRARY_DIR });
      assert.ok(
        deal.palette.min_level <= level,
        `Palette ${deal.palette.id} (min_level=${deal.palette.min_level}) leaked into level ${level}`
      );
      assert.ok(
        deal.font.min_level <= level,
        `Font ${deal.font.id} (min_level=${deal.font.min_level}) leaked into level ${level}`
      );
      for (const comp of deal.components) {
        assert.ok(
          comp.min_level <= level,
          `Component ${comp.id} (min_level=${comp.min_level}) leaked into level ${level}`
        );
      }

      if (level >= 4) {
        assert.ok(
          deal.palette.min_level >= 3,
          `Level ${level} should prefer min_level >= 3 dark neon palettes, got ${deal.palette.id} (min_level=${deal.palette.min_level})`
        );
      }
    }
  }
});

test('slop_weight weighted sampling statistically favors higher weight items', () => {
  // 1. Direct weightedPick test
  const items = [
    { id: 'low', slop_weight: 1 },
    { id: 'high', slop_weight: 9 },
  ];
  let directHigh = 0;
  const directTrials = 2000;
  const rng = createPrng(2026);
  for (let i = 0; i < directTrials; i += 1) {
    if (weightedPick(rng, items, (it) => it.slop_weight).id === 'high') {
      directHigh += 1;
    }
  }
  const directRatio = directHigh / directTrials;
  assert.ok(
    directRatio > 0.85 && directRatio < 0.95,
    `Expected ~0.90 high-weight selection ratio, got ${directRatio.toFixed(3)}`
  );

  // 2. End-to-end dealDesign test with controlled equal-min_level palettes
  const baseLib = loadLibrary(MINI_LIBRARY_DIR);
  const lowPalette = { ...baseLib.palettes[0], id: 'low-weight', min_level: 1, slop_weight: 1 };
  const highPalette = { ...baseLib.palettes[1], id: 'high-weight', min_level: 1, slop_weight: 9 };
  const controlledLib = {
    ...baseLib,
    palettes: [lowPalette, highPalette],
  };

  let dealHigh = 0;
  const dealTrials = 300;
  for (let seed = 1; seed <= dealTrials; seed += 1) {
    const deal = dealDesign({ level: 1, seed, library: controlledLib });
    if (deal.palette.id === 'high-weight') {
      dealHigh += 1;
    }
  }
  const dealRatio = dealHigh / dealTrials;
  assert.ok(
    dealRatio > 0.8,
    `Expected dealDesign to strongly favor slop_weight=9 over slop_weight=1, got ${dealRatio.toFixed(3)}`
  );
});

test('output passes validateDealOutput across all levels 1..5 and valid pages', () => {
  for (const page of VALID_PAGES) {
    for (let level = 1; level <= 5; level += 1) {
      const deal = dealDesign({
        level,
        seed: 100 + level * 17,
        page,
        brand: 'HyperSlop Labs',
        libraryDir: MINI_LIBRARY_DIR,
      });
      const check = validateDealOutput(deal);
      assert.equal(check.valid, true, `Validation failed for ${page} L${level}: ${check.errors.join('; ')}`);
      assert.equal(deal.page, page);
      assert.equal(deal.copy.brand, 'HyperSlop Labs');
    }
  }
});

test('DEFAULT_LIBRARY_DIR resolves independently of process.cwd()', () => {
  assert.ok(
    DEFAULT_LIBRARY_DIR.endsWith(path.join('skills', 'slop-skill', 'library')),
    `Unexpected DEFAULT_LIBRARY_DIR: ${DEFAULT_LIBRARY_DIR}`
  );
});

test('parseCliArgs and CLI reject invalid arguments with exit code 1 and stderr message', () => {
  assert.throws(() => parseCliArgs(['--level', '0']), /--level/);
  assert.throws(() => parseCliArgs(['--level', '6']), /--level/);
  assert.throws(() => parseCliArgs(['--seed', 'nope']), /--seed/);
  assert.throws(() => parseCliArgs(['--seed', '3.14']), /--seed/);
  assert.throws(() => parseCliArgs(['--page', 'invalid']), /--page/);
  assert.throws(() => parseCliArgs(['--brand', '   ']), /--brand/);
  assert.throws(() => parseCliArgs(['--unknown-flag']), /Unknown option/);

  // Negative integer seed works cleanly
  assert.equal(parseCliArgs(['--seed', '-42']).seed, -42);
  assert.equal(parseCliArgs(['--level=5', '--seed=99', '--page=pricing']).level, 5);

  const invalidCases = [
    ['--level', '0'],
    ['--level', '6'],
    ['--level', 'abc'],
    ['--seed', 'nope'],
    ['--seed', '3.14'],
    ['--page', 'invalid'],
    ['--brand', ''],
    ['--does-not-exist'],
  ];

  for (const args of invalidCases) {
    const res = spawnSync(process.execPath, [DEAL_SCRIPT, ...args], { encoding: 'utf8' });
    assert.equal(res.status, 1, `Expected exit code 1 for args ${JSON.stringify(args)}, got ${res.status}`);
    assert.ok(res.stderr.trim().length > 0, `Expected helpful stderr for args ${JSON.stringify(args)}`);
  }

  // --help exits with 0
  const helpRes = spawnSync(process.execPath, [DEAL_SCRIPT, '--help'], { encoding: 'utf8' });
  assert.equal(helpRes.status, 0);
  assert.match(helpRes.stdout, /Usage:/);
});

test('CLI invocation via execFileSync emits valid, reproducible JSON', () => {
  const args = [
    DEAL_SCRIPT,
    '--level',
    '4',
    '--seed',
    '42',
    '--page',
    'landing',
    '--brand',
    'NovaFlow AI',
    '--library',
    MINI_LIBRARY_DIR,
  ];

  const stdout1 = execFileSync(process.execPath, args, { encoding: 'utf8', cwd: REPO_ROOT });
  const stdout2 = execFileSync(process.execPath, args, { encoding: 'utf8', cwd: '/tmp' });

  assert.equal(stdout1, stdout2, 'CLI output must be byte-identical regardless of cwd');

  const parsed = JSON.parse(stdout1);
  const check = validateDealOutput(parsed);
  assert.equal(check.valid, true, `CLI deal output invalid: ${check.errors.join('; ')}`);
  assert.equal(parsed.seed, 42);
  assert.equal(parsed.level, 4);
  assert.equal(parsed.page, 'landing');
  assert.equal(parsed.copy.brand, 'NovaFlow AI');
});
