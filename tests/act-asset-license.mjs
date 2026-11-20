// Ejecutar con: node --experimental-strip-types tests/act-asset-license.mjs
import assert from 'node:assert/strict';
import { actAssetLicense } from '../utils/actAssetLicense.ts';

assert.equal(actAssetLicense('windows 10'), 'windows 10');
assert.equal(actAssetLicense('  Windows 11  '), 'Windows 11');
for (const missing of [undefined, null, '', '   ', 11, {}]) {
  assert.equal(actAssetLicense(missing), '');
}
console.log('PASS: licencia a partir del sistema operativo, datos faltantes y formato original');
