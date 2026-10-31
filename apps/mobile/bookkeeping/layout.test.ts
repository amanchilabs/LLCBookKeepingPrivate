import { describe, expect, it } from 'vitest';
import { contentTopInset } from './layout';

describe('contentTopInset', () => {
  it('uses the Android status bar height as a top inset', () => {
    expect(contentTopInset('android', 24)).toBe(24);
  });

  it('does not add Android padding on iOS or web', () => {
    expect(contentTopInset('ios', 24)).toBe(0);
    expect(contentTopInset('web', 24)).toBe(0);
  });

  it('treats an unavailable or negative status bar height as zero', () => {
    expect(contentTopInset('android', null)).toBe(0);
    expect(contentTopInset('android', -1)).toBe(0);
  });
});
