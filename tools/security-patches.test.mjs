import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { ICNS } = require('image-size/dist/types/icns.js');
const { findBox } = require('image-size/dist/types/utils.js');

test('CVE-2025-71330: rejects a zero-length ICNS entry without looping', () => {
  const maliciousIcns = Buffer.alloc(16);
  maliciousIcns.write('icns', 0, 'ascii');
  maliciousIcns.writeUInt32BE(16, 4);
  maliciousIcns.write('ic07', 8, 'ascii');
  maliciousIcns.writeUInt32BE(0, 12);

  assert.throws(
    () => ICNS.calculate(maliciousIcns),
    /Invalid ICNS entry length/,
  );
});

test('CVE-2025-71329: rejects zero-sized ISO boxes without looping', () => {
  const maliciousBox = Buffer.alloc(8);
  maliciousBox.writeUInt32BE(0, 0);
  maliciousBox.write('ftyp', 4, 'ascii');

  assert.equal(findBox(maliciousBox, 'ftyp', 0), undefined);
});
