import { describe, expect, it } from 'vitest';
import { nativeBuildPolicy } from './native-build-policy.cjs';

describe('native build policy', () => {
  it('keeps SQLCipher enabled by default and for production', () => {
    expect(nativeBuildPolicy({ EAS_BUILD_PROFILE: 'production' })).toEqual({ sqlCipherEnabled: true, securityNegativeBuild: false });
  });

  it('allows a separately opted-in SQLCipher-disabled negative test build', () => {
    expect(nativeBuildPolicy({ LLCB_SECURITY_NEGATIVE_SQLITE: '1' })).toEqual({ sqlCipherEnabled: false, securityNegativeBuild: true });
  });

  it('refuses to construct a SQLCipher-disabled production build', () => {
    expect(() => nativeBuildPolicy({ LLCB_SECURITY_NEGATIVE_SQLITE: '1', EAS_BUILD_PROFILE: 'production' })).toThrow('cannot use the production build profile');
  });
});
