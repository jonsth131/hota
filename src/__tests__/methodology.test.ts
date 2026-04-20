import { describe, it, expect } from 'vitest';
import {
  STRIDE_CATEGORIES, getCategoriesForElement, getThreatTemplates, getCategoryById,
} from '../methodology/stride.js';
import {
  PASTA_STAGES, getStages, getStage, getPastaCategories,
} from '../methodology/pasta.js';

describe('STRIDE categories', () => {
  it('has 6 categories', () => {
    expect(STRIDE_CATEGORIES).toHaveLength(6);
  });

  it('covers S, T, R, I, D, E', () => {
    const ids = STRIDE_CATEGORIES.map((c) => c.id);
    expect(ids).toEqual(['S', 'T', 'R', 'I', 'D', 'E']);
  });

  it('finds category by ID', () => {
    const cat = getCategoryById('T');
    expect(cat?.name).toBe('Tampering');
  });

  it('returns undefined for unknown ID', () => {
    expect(getCategoryById('X')).toBeUndefined();
  });
});

describe('getCategoriesForElement', () => {
  it('returns categories for Process', () => {
    const cats = getCategoriesForElement('Process');
    expect(cats.length).toBeGreaterThan(0);
  });

  it('returns categories for DataStore', () => {
    const cats = getCategoriesForElement('DataStore');
    expect(cats.length).toBeGreaterThan(0);
  });

  it('returns categories for ExternalEntity', () => {
    const cats = getCategoriesForElement('ExternalEntity');
    expect(cats.length).toBeGreaterThan(0);
  });
});

describe('Threat templates', () => {
  it('returns templates for Process', () => {
    const tpls = getThreatTemplates('Process');
    expect(tpls.length).toBeGreaterThan(0);
    expect(tpls[0]).toHaveProperty('title');
    expect(tpls[0]).toHaveProperty('category');
    expect(tpls[0]).toHaveProperty('severity');
  });

  it('returns templates for DataStore', () => {
    expect(getThreatTemplates('DataStore').length).toBeGreaterThan(0);
  });

  it('returns connection templates as fallback', () => {
    const tpls = getThreatTemplates('UnknownType');
    expect(tpls.length).toBeGreaterThan(0);
  });
});

describe('PASTA stages', () => {
  it('has 7 stages', () => {
    expect(PASTA_STAGES).toHaveLength(7);
    expect(getStages()).toHaveLength(7);
  });

  it('stages are numbered 1–7', () => {
    const nums = PASTA_STAGES.map((s) => s.stage);
    expect(nums).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('finds stage by number', () => {
    expect(getStage(1)?.name).toBe('Definiera mål');
    expect(getStage(7)?.name).toBe('Risk- och konsekvensanalys');
  });

  it('returns undefined for out-of-range stage', () => {
    expect(getStage(99)).toBeUndefined();
  });

  it('getPastaCategories returns 7 items', () => {
    expect(getPastaCategories()).toHaveLength(7);
  });

  it('each stage has activities', () => {
    PASTA_STAGES.forEach((stage) => {
      expect(stage.activities.length).toBeGreaterThan(0);
    });
  });

  it('each stage has icon and description', () => {
    PASTA_STAGES.forEach((stage) => {
      expect(stage.icon).toBeTruthy();
      expect(stage.description).toBeTruthy();
    });
  });
});
