// Ejecutar con: node --experimental-strip-types tests/asset-types.mjs
import assert from 'node:assert/strict';
import { DEFAULT_ASSET_TYPES, mergeAssetTypes, assetTypeName, actDeviceType } from '../utils/assetTypes.ts';

const input = [
  { id: 'laptop', name: 'Portátil', active: false },
  { id: 'custom_abc', name: 'Video beam', active: true },
  { id: 'custom_def', name: 'Auriculares', active: false },
];
const types = mergeAssetTypes(input);
assert.equal(types.find((type) => type.id === 'laptop').active, false);
assert.equal(assetTypeName('laptop', types), 'Portátil');
assert.equal(types.find((type) => type.id === 'tablet').name, 'Tablet');
assert.equal(types.find((type) => type.id === 'cellphone').name, 'Celular');
assert.deepEqual(types.slice(-2).map((type) => type.name), ['Auriculares', 'Video beam']);
assert.equal(DEFAULT_ASSET_TYPES.find((type) => type.id === 'laptop').active, true);
assert.equal(assetTypeName('legacy-x', types), 'legacy-x');
assert.equal(actDeviceType('tablet', types).deviceTypes.tablet, true);
assert.equal(actDeviceType('cellphone', types).deviceTypes.cellphone, true);
assert.equal(actDeviceType('custom_abc', types).deviceTypes.other, true);
assert.equal(actDeviceType('custom_abc', types).otherDeviceType, 'Video beam');
assert.equal(actDeviceType('printer', types).otherDeviceType, '');
console.log('PASS: tipos predeterminados, personalizados, inactivos y casillas del acta');
