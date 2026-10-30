import { describe, expect, it } from 'vitest';
import { decodeBackupEnvelope, encodeBackupEnvelope } from '../src/format';

describe('portable backup envelope', () => {
  it('round-trips its versioned authenticated header and ciphertext fields', () => {
    const envelope = {
      salt: new Uint8Array(16).fill(1),
      nonce: new Uint8Array(12).fill(2),
      ciphertext: new Uint8Array(16).fill(3),
    };
    const { authenticatedMetadata: _authenticatedMetadata, ...decoded } = decodeBackupEnvelope(encodeBackupEnvelope(envelope));
    expect(decoded).toEqual(envelope);
  });

  it('rejects bad magic, truncation, and unsupported versions', () => {
    const valid = encodeBackupEnvelope({
      salt: new Uint8Array(16).fill(1),
      nonce: new Uint8Array(12).fill(2),
      ciphertext: new Uint8Array(16).fill(3),
    });
    const corrupt = valid.slice();
    corrupt[0] = 0;
    expect(() => decodeBackupEnvelope(corrupt)).toThrow();
    expect(() => decodeBackupEnvelope(valid.slice(0, 20))).toThrow();
    const unknown = valid.slice();
    unknown[8] = 99;
    expect(() => decodeBackupEnvelope(unknown)).toThrow();
  });
});
