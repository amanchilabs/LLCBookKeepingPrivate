import { describe, expect, it } from 'vitest';
import { contrastRatio, designTokens, minimumTouchTarget } from './design-system';

describe('shared design tokens', () => {
  it('keeps core text readable against the warm canvas', () => {
    expect(contrastRatio(designTokens.color.navy, designTokens.color.canvas)).toBeGreaterThanOrEqual(7);
  });

  it('uses platform-sized minimum touch targets', () => {
    expect(minimumTouchTarget('ios')).toBe(44);
    expect(minimumTouchTarget('android')).toBe(48);
  });

  it('provides consistent spacing and shape tokens', () => {
    expect(designTokens.spacing).toEqual({ xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 });
    expect(designTokens.radius.card).toBeGreaterThan(designTokens.radius.control);
  });
});
