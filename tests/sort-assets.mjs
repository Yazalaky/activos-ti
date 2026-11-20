// Ejecutar con: node --experimental-strip-types tests/sort-assets.mjs
import assert from 'node:assert/strict';
import { compareAssetCodes } from '../utils/sortAssets.ts';

const original = [
  { fixedAssetId: 'LBOG-016' },
  { fixedAssetId: 'LBOG-002' },
  { fixedAssetId: 'LBOG-013' },
  { fixedAssetId: 'LBOG-011' },
  { fixedAssetId: 'LBOG-005' },
  { fixedAssetId: 'LBOG-012' },
  { fixedAssetId: 'LBOG-004' },
  { fixedAssetId: 'LBOG-017' },
  { fixedAssetId: 'LBOG-014' },
  { fixedAssetId: 'LBOG-021' },
  { fixedAssetId: 'LBOG-1000' },
  { fixedAssetId: 'LBOG-999' },
  { fixedAssetId: 'LBOG-1' },
  { fixedAssetId: '' },
  { fixedAssetId: null },
];
const before = original.map((asset) => asset.fixedAssetId);
const sorted = original.slice().sort(compareAssetCodes);
assert.deepEqual(sorted.map((asset) => asset.fixedAssetId), [
  'LBOG-1', 'LBOG-002', 'LBOG-004', 'LBOG-005', 'LBOG-011', 'LBOG-012',
  'LBOG-013', 'LBOG-014', 'LBOG-016', 'LBOG-017', 'LBOG-021', 'LBOG-999',
  'LBOG-1000', '', null,
]);
assert.deepEqual(original.map((asset) => asset.fixedAssetId), before, 'no debe modificar la lista original');
assert.ok(compareAssetCodes({ fixedAssetId: 'RPWI-9' }, { fixedAssetId: 'RPWI-10' }) < 0);
assert.ok(compareAssetCodes({ fixedAssetId: 'AB-001' }, { fixedAssetId: 'CD-001' }) < 0);
assert.equal(compareAssetCodes({}, { fixedAssetId: '   ' }), 0);
console.log('PASS: orden natural de activos, códigos incompletos y lista original intacta');
