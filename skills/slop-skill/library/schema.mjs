/**
 * Schema validators for slop-skill library items, deal outputs, and slop-meter rules.
 * Single source of truth: docs/CONTRACT.md
 * Zero external runtime dependencies (Node.js >= 22 ESM).
 */

export const SLOP_CATEGORIES = Object.freeze([
  'color',
  'typography',
  'layout',
  'effect',
  'copy',
]);

export const HTML_SLOTS = Object.freeze([
  'head',
  'tokens',
  'hero',
  'features',
  'stats',
  'testimonials',
  'cta',
  'footer',
  'extra',
]);

export const RULE_TYPES = Object.freeze(['regex', 'count', 'computed']);

export const VALID_ANIMATIONS = Object.freeze([
  'float',
  'pulse',
  'blob-drift',
  'gradient-shift',
  'hover-scale',
  'neon-glow-pulse',
]);

export const VALID_PAGES = Object.freeze([
  'landing',
  'saas',
  'portfolio',
  'pricing',
]);

const KEBAB_CASE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REGEX_FLAGS_RE = /^[gimsuy]*$/;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIntInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function inferLibraryKind(item) {
  if (!isPlainObject(item)) return 'generic';
  if ('tokens' in item || 'gradient' in item || item.category === 'color') {
    if ('slot' in item || 'html' in item) return 'component';
    return 'palette';
  }
  if ('heading' in item || 'body' in item || 'googleFontsUrl' in item || item.category === 'typography') {
    if ('slot' in item || 'html' in item) return 'component';
    return 'font';
  }
  if ('slot' in item || 'html' in item) {
    return 'component';
  }
  return 'generic';
}

function validateCommonLibraryFields(item, prefix, errors) {
  if (!isNonEmptyString(item.id)) {
    errors.push(`${prefix}.id must be a non-empty string`);
  } else if (!KEBAB_CASE_RE.test(item.id)) {
    errors.push(`${prefix}.id ("${item.id}") must be lowercase kebab-case (e.g. "purple-neon")`);
  }

  if (!SLOP_CATEGORIES.includes(item.category)) {
    errors.push(
      `${prefix}.category ("${String(item.category)}") must be one of: ${SLOP_CATEGORIES.join(', ')}`
    );
  }

  if (!isIntInRange(item.slop_weight, 1, 10)) {
    errors.push(
      `${prefix}.slop_weight (${String(item.slop_weight)}) must be an integer between 1 and 10`
    );
  }

  if (!isIntInRange(item.min_level, 1, 5)) {
    errors.push(
      `${prefix}.min_level (${String(item.min_level)}) must be an integer between 1 and 5`
    );
  }
}

/**
 * Validate a library item (palette, font, component, or generic common item).
 * @param {unknown} item
 * @param {'palette'|'font'|'component'|'generic'} [kind]
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateLibraryItem(item, kind) {
  const errors = [];
  const label = kind || 'item';

  if (!isPlainObject(item)) {
    return { valid: false, errors: [`${label} must be a plain object`] };
  }

  const resolvedKind = kind || inferLibraryKind(item);
  validateCommonLibraryFields(item, resolvedKind, errors);

  if (resolvedKind === 'palette') {
    if (item.category !== 'color') {
      errors.push(`palette.category must be "color" (got "${String(item.category)}")`);
    }
    if (!isNonEmptyString(item.name)) {
      errors.push('palette.name must be a non-empty string');
    }
    if (!isPlainObject(item.tokens)) {
      errors.push('palette.tokens must be a plain object');
    } else {
      for (const reqKey of ['bg', 'fg', 'accent1', 'accent2']) {
        if (!isNonEmptyString(item.tokens[reqKey])) {
          errors.push(`palette.tokens.${reqKey} must be a non-empty string`);
        }
      }
      for (const [k, v] of Object.entries(item.tokens)) {
        if (!isNonEmptyString(v)) {
          errors.push(`palette.tokens.${k} must be a non-empty string`);
        }
      }
    }
    if (!isNonEmptyString(item.gradient)) {
      errors.push('palette.gradient must be a non-empty CSS gradient string');
    } else if (!/(?:linear|radial|conic)-gradient\(/i.test(item.gradient)) {
      errors.push(`palette.gradient ("${item.gradient}") must contain a valid CSS gradient function`);
    }
  } else if (resolvedKind === 'font') {
    if (item.category !== 'typography') {
      errors.push(`font.category must be "typography" (got "${String(item.category)}")`);
    }
    if (!isNonEmptyString(item.heading)) {
      errors.push('font.heading must be a non-empty string');
    }
    if (!isNonEmptyString(item.body)) {
      errors.push('font.body must be a non-empty string');
    }
    if (!isNonEmptyString(item.googleFontsUrl)) {
      errors.push('font.googleFontsUrl must be a non-empty URL string');
    } else if (!/^https:\/\/fonts\.googleapis\.com\/css2?\?/i.test(item.googleFontsUrl)) {
      errors.push(
        `font.googleFontsUrl ("${item.googleFontsUrl}") must start with "https://fonts.googleapis.com/css"`
      );
    }
    if (item.name !== undefined && !isNonEmptyString(item.name)) {
      errors.push('font.name, when provided, must be a non-empty string');
    }
  } else if (resolvedKind === 'component') {
    if (!HTML_SLOTS.includes(item.slot)) {
      errors.push(
        `component.slot ("${String(item.slot)}") must be one of: ${HTML_SLOTS.join(', ')}`
      );
    }
    if (!isNonEmptyString(item.html)) {
      errors.push('component.html must be a non-empty string');
    }
    if (typeof item.css !== 'string') {
      errors.push('component.css must be a string (may be empty)');
    }
    if (item.name !== undefined && !isNonEmptyString(item.name)) {
      errors.push('component.name, when provided, must be a non-empty string');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a copy library object (`copy.json`).
 * @param {unknown} copy
 * @param {{ minItems?: number }} [options]
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCopyLibrary(copy, options = {}) {
  const minItems = options.minItems ?? 1;
  const errors = [];

  if (!isPlainObject(copy)) {
    return { valid: false, errors: ['copy library must be a plain object'] };
  }

  for (const key of ['hero_headlines', 'subheads', 'ctas', 'feature_titles']) {
    if (!Array.isArray(copy[key])) {
      errors.push(`copy.${key} must be an array of strings`);
      continue;
    }
    if (copy[key].length < minItems) {
      errors.push(`copy.${key} must contain at least ${minItems} entries (got ${copy[key].length})`);
    }
    copy[key].forEach((entry, i) => {
      if (!isNonEmptyString(entry)) {
        errors.push(`copy.${key}[${i}] must be a non-empty string`);
      }
    });
  }

  if (!Array.isArray(copy.testimonials)) {
    errors.push('copy.testimonials must be an array');
  } else {
    if (copy.testimonials.length < minItems) {
      errors.push(
        `copy.testimonials must contain at least ${minItems} entries (got ${copy.testimonials.length})`
      );
    }
    copy.testimonials.forEach((t, i) => {
      if (!isPlainObject(t)) {
        errors.push(`copy.testimonials[${i}] must be a plain object`);
        return;
      }
      if (!isNonEmptyString(t.quote)) {
        errors.push(`copy.testimonials[${i}].quote must be a non-empty string`);
      }
      if (!isNonEmptyString(t.author)) {
        errors.push(`copy.testimonials[${i}].author must be a non-empty string`);
      }
      if (!isNonEmptyString(t.role)) {
        errors.push(`copy.testimonials[${i}].role must be a non-empty string`);
      }
      if (!isIntInRange(t.rating, 1, 5)) {
        errors.push(`copy.testimonials[${i}].rating must be an integer between 1 and 5`);
      }
    });
  }

  if (!Array.isArray(copy.fake_stats)) {
    errors.push('copy.fake_stats must be an array');
  } else {
    if (copy.fake_stats.length < minItems) {
      errors.push(
        `copy.fake_stats must contain at least ${minItems} entries (got ${copy.fake_stats.length})`
      );
    }
    copy.fake_stats.forEach((s, i) => {
      if (!isPlainObject(s)) {
        errors.push(`copy.fake_stats[${i}] must be a plain object`);
        return;
      }
      if (!isNonEmptyString(s.value)) {
        errors.push(`copy.fake_stats[${i}].value must be a non-empty string`);
      }
      if (!isNonEmptyString(s.label)) {
        errors.push(`copy.fake_stats[${i}].label must be a non-empty string`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate the JSON output emitted by `deal.mjs`.
 * @param {unknown} deal
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDealOutput(deal) {
  const errors = [];

  if (!isPlainObject(deal)) {
    return { valid: false, errors: ['deal output must be a plain object'] };
  }

  if (!Number.isInteger(deal.seed)) {
    errors.push(`deal.seed (${String(deal.seed)}) must be an integer`);
  }

  if (!isIntInRange(deal.level, 1, 5)) {
    errors.push(`deal.level (${String(deal.level)}) must be an integer between 1 and 5`);
  }

  if (!isNonEmptyString(deal.page)) {
    errors.push('deal.page must be a non-empty string');
  }

  const paletteCheck = validateLibraryItem(deal.palette, 'palette');
  if (!paletteCheck.valid) {
    errors.push(...paletteCheck.errors.map((e) => `deal.${e}`));
  }

  const fontCheck = validateLibraryItem(deal.font, 'font');
  if (!fontCheck.valid) {
    errors.push(...fontCheck.errors.map((e) => `deal.${e}`));
  }

  if (!isPlainObject(deal.copy)) {
    errors.push('deal.copy must be a plain object');
  } else {
    for (const key of ['hero_headline', 'subhead', 'primary_cta', 'secondary_cta']) {
      if (!isNonEmptyString(deal.copy[key])) {
        errors.push(`deal.copy.${key} must be a non-empty string`);
      }
    }
    if (deal.copy.brand !== undefined && !isNonEmptyString(deal.copy.brand)) {
      errors.push('deal.copy.brand, when provided, must be a non-empty string');
    }
    if (deal.copy.badge !== undefined && typeof deal.copy.badge !== 'string') {
      errors.push('deal.copy.badge, when provided, must be a string');
    }
    if (!Array.isArray(deal.copy.features)) {
      errors.push('deal.copy.features must be an array');
    } else {
      deal.copy.features.forEach((f, i) => {
        if (!isPlainObject(f) || !isNonEmptyString(f.title)) {
          errors.push(`deal.copy.features[${i}] must be an object with a non-empty title`);
        }
      });
    }
    if (!Array.isArray(deal.copy.stats)) {
      errors.push('deal.copy.stats must be an array');
    } else {
      deal.copy.stats.forEach((s, i) => {
        if (!isPlainObject(s) || !isNonEmptyString(s.value) || !isNonEmptyString(s.label)) {
          errors.push(`deal.copy.stats[${i}] must be an object with non-empty value and label`);
        }
      });
    }
    if (!Array.isArray(deal.copy.testimonials)) {
      errors.push('deal.copy.testimonials must be an array');
    } else {
      deal.copy.testimonials.forEach((t, i) => {
        if (
          !isPlainObject(t) ||
          !isNonEmptyString(t.quote) ||
          !isNonEmptyString(t.author) ||
          !isNonEmptyString(t.role) ||
          !isIntInRange(t.rating, 1, 5)
        ) {
          errors.push(
            `deal.copy.testimonials[${i}] must have quote, author, role (strings) and rating (1..5)`
          );
        }
      });
    }
  }

  if (!Array.isArray(deal.components) || deal.components.length === 0) {
    errors.push('deal.components must be a non-empty array of component objects');
  } else {
    deal.components.forEach((comp, i) => {
      const compCheck = validateLibraryItem(comp, 'component');
      if (!compCheck.valid) {
        errors.push(...compCheck.errors.map((e) => `deal.components[${i}].${e}`));
      }
    });
  }

  if (!Array.isArray(deal.animations)) {
    errors.push('deal.animations must be an array of animation ID strings');
  } else {
    deal.animations.forEach((anim, i) => {
      if (!isNonEmptyString(anim)) {
        errors.push(`deal.animations[${i}] must be a non-empty string`);
      } else if (!VALID_ANIMATIONS.includes(anim)) {
        errors.push(
          `deal.animations[${i}] ("${anim}") must be one of: ${VALID_ANIMATIONS.join(', ')}`
        );
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a slop-meter rule definition.
 * @param {unknown} rule
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRule(rule) {
  const errors = [];

  if (!isPlainObject(rule)) {
    return { valid: false, errors: ['rule must be a plain object'] };
  }

  if (!isNonEmptyString(rule.id)) {
    errors.push('rule.id must be a non-empty string');
  } else if (!KEBAB_CASE_RE.test(rule.id)) {
    errors.push(`rule.id ("${rule.id}") must be lowercase kebab-case`);
  }

  if (rule.name !== undefined && !isNonEmptyString(rule.name)) {
    errors.push('rule.name, when provided, must be a non-empty string');
  }

  if (!SLOP_CATEGORIES.includes(rule.category)) {
    errors.push(
      `rule.category ("${String(rule.category)}") must be one of: ${SLOP_CATEGORIES.join(', ')}`
    );
  }

  if (!isIntInRange(rule.weight, 1, 10)) {
    errors.push(`rule.weight (${String(rule.weight)}) must be an integer between 1 and 10`);
  }

  if (!RULE_TYPES.includes(rule.type)) {
    errors.push(`rule.type ("${String(rule.type)}") must be one of: ${RULE_TYPES.join(', ')}`);
  }

  if (rule.flags !== undefined) {
    if (typeof rule.flags !== 'string' || !REGEX_FLAGS_RE.test(rule.flags)) {
      errors.push(`rule.flags ("${String(rule.flags)}") must contain only valid RegExp flags (g,i,m,s,u,y)`);
    }
  }

  if (rule.type === 'regex' || rule.type === 'count') {
    if (!isNonEmptyString(rule.pattern)) {
      errors.push(`rule.pattern must be a non-empty regex string when type is "${rule.type}"`);
    } else {
      try {
        new RegExp(rule.pattern, typeof rule.flags === 'string' && REGEX_FLAGS_RE.test(rule.flags) ? rule.flags : 'i');
      } catch (err) {
        errors.push(`rule.pattern is not a valid regular expression: ${err.message}`);
      }
    }
  } else if (rule.type === 'computed') {
    if (!isNonEmptyString(rule.check) && !isNonEmptyString(rule.pattern)) {
      errors.push('rule.check (or rule.pattern) must name a computed heuristic when type is "computed"');
    }
  }

  if (rule.min !== undefined) {
    if (!Number.isInteger(rule.min) || rule.min < 1) {
      errors.push(`rule.min (${String(rule.min)}) must be an integer >= 1`);
    }
  } else if (rule.type === 'count') {
    errors.push('rule.min is required and must be an integer >= 1 when type is "count"');
  }

  if (!isNonEmptyString(rule.description)) {
    errors.push('rule.description must be a non-empty string');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Throw a descriptive Error if a validation result failed.
 * @param {{ valid: boolean, errors: string[] }} result
 * @param {string} [context]
 */
export function assertValid(result, context = 'Validation') {
  if (!result || !result.valid) {
    const details = result?.errors?.length ? result.errors.join('; ') : 'unknown validation error';
    throw new Error(`${context} failed: ${details}`);
  }
}
