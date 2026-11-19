import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateLibraryItem,
  validateCopyLibrary,
  validateDealOutput,
  validateRule,
  assertValid,
} from '../skills/slop-skill/library/schema.mjs';

const validPalette = {
  id: 'purple-neon',
  name: 'Purple Neon',
  category: 'color',
  slop_weight: 9,
  min_level: 3,
  tokens: {
    bg: '#09051A',
    fg: '#FFFFFF',
    accent1: '#8B5CF6',
    accent2: '#3B82F6',
  },
  gradient: 'linear-gradient(135deg, #8B5CF6, #3B82F6)',
};

const validFont = {
  id: 'inter-poppins',
  name: 'Inter & Poppins',
  category: 'typography',
  slop_weight: 6,
  min_level: 1,
  heading: 'Poppins',
  body: 'Inter',
  googleFontsUrl:
    'https://fonts.googleapis.com/css2?family=Inter&family=Poppins:wght@400;600;700&display=swap',
};

const validComponent = {
  id: 'glass-feature-card',
  name: 'Glass Feature Card',
  category: 'layout',
  slop_weight: 8,
  min_level: 3,
  slot: 'features',
  html: '<article class="glass-card"><h3>🚀 Fast</h3></article>',
  css: '.glass-card { backdrop-filter: blur(16px); }',
};

const validDeal = {
  seed: 42,
  level: 4,
  page: 'landing',
  palette: validPalette,
  font: validFont,
  copy: {
    brand: 'NovaFlow AI',
    badge: '✨ Powered by AI',
    hero_headline: 'Revolutionize Your Workflow',
    subhead: 'Unlock the power of next-gen automation.',
    primary_cta: 'Get Started Free',
    secondary_cta: 'Watch Demo',
    features: [{ emoji: '🚀', title: 'Seamless Integration' }],
    stats: [{ value: '10K+', label: 'Active Users' }],
    testimonials: [
      {
        quote: 'Supercharged our workflow overnight.',
        author: 'Sarah Chen',
        role: 'CTO, TechFlow',
        rating: 5,
      },
    ],
  },
  components: [validComponent],
  animations: ['float', 'pulse'],
};

test('validateLibraryItem accepts valid palette, font, and component', () => {
  assert.equal(validateLibraryItem(validPalette, 'palette').valid, true);
  assert.equal(validateLibraryItem(validPalette).valid, true);
  assert.equal(validateLibraryItem(validFont, 'font').valid, true);
  assert.equal(validateLibraryItem(validFont).valid, true);
  assert.equal(validateLibraryItem(validComponent, 'component').valid, true);
  assert.equal(validateLibraryItem(validComponent).valid, true);
});

test('validateLibraryItem rejects invalid common fields and type-specific issues', () => {
  const badPalette = {
    ...validPalette,
    id: 'Invalid ID!',
    slop_weight: 15,
    min_level: 0,
    tokens: { bg: '#000' },
    gradient: 'solid-purple',
  };
  const res = validateLibraryItem(badPalette, 'palette');
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('kebab-case')));
  assert.ok(res.errors.some((e) => e.includes('slop_weight')));
  assert.ok(res.errors.some((e) => e.includes('min_level')));
  assert.ok(res.errors.some((e) => e.includes('tokens.fg')));
  assert.ok(res.errors.some((e) => e.includes('gradient')));

  const badComp = { ...validComponent, slot: 'sidebar', html: '', css: 123 };
  const compRes = validateLibraryItem(badComp, 'component');
  assert.equal(compRes.valid, false);
  assert.ok(compRes.errors.some((e) => e.includes('component.slot')));
  assert.ok(compRes.errors.some((e) => e.includes('component.html')));
  assert.ok(compRes.errors.some((e) => e.includes('component.css')));
});

test('validateCopyLibrary validates pools and reports missing items clearly', () => {
  const validCopy = {
    hero_headlines: ['Revolutionize Your Workflow'],
    subheads: ['Unlock the power of AI.'],
    ctas: ['Get Started Free'],
    feature_titles: ['Seamless Sync'],
    testimonials: [{ quote: 'Amazing!', author: 'Alex Kim', role: 'CEO', rating: 5 }],
    fake_stats: [{ value: '10K+', label: 'Users' }],
  };
  assert.equal(validateCopyLibrary(validCopy, { minItems: 1 }).valid, true);
  const tooSmall = validateCopyLibrary(validCopy, { minItems: 12 });
  assert.equal(tooSmall.valid, false);
  assert.ok(tooSmall.errors.length >= 6);
});

test('validateDealOutput accepts valid deal and rejects invalid fields', () => {
  assert.equal(validateDealOutput(validDeal).valid, true);

  const badDeal = {
    ...validDeal,
    seed: '42',
    level: 9,
    components: [],
    animations: ['unknown-bounce'],
  };
  const res = validateDealOutput(badDeal);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('deal.seed')));
  assert.ok(res.errors.some((e) => e.includes('deal.level')));
  assert.ok(res.errors.some((e) => e.includes('deal.components')));
  assert.ok(res.errors.some((e) => e.includes('deal.animations')));
});

test('validateRule validates regex, count, and computed rules', () => {
  const regexRule = {
    id: 'purple-gradient',
    category: 'color',
    weight: 8,
    type: 'regex',
    pattern: 'linear-gradient',
    min: 1,
    description: 'Uses a linear gradient',
  };
  assert.equal(validateRule(regexRule).valid, true);

  const countRule = {
    id: 'multi-shadow',
    category: 'effect',
    weight: 5,
    type: 'count',
    pattern: 'box-shadow',
    min: 3,
    description: 'Excessive box-shadow usage',
  };
  assert.equal(validateRule(countRule).valid, true);

  const computedRule = {
    id: 'dark-purple-combo',
    category: 'color',
    weight: 7,
    type: 'computed',
    check: 'dark-purple-combo',
    description: 'Combines dark background with purple accent',
  };
  assert.equal(validateRule(computedRule).valid, true);

  const badRegex = { ...regexRule, pattern: '[unclosed(' };
  const badRes = validateRule(badRegex);
  assert.equal(badRes.valid, false);
  assert.ok(badRes.errors.some((e) => e.includes('regular expression')));

  assert.throws(() => assertValid(badRes, 'Rule check'), /Rule check failed:/);
});
