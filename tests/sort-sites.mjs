// Ejecutar con: node --experimental-strip-types tests/sort-sites.mjs
import assert from 'node:assert/strict';
import { compareSiteNames } from '../utils/sortSites.ts';

const original = [
  { id: 'z', name: 'Zuluaga' },
  { id: 'nn', name: 'Ñandú' },
  { id: 'b', name: 'Bogotá' },
  { id: 'no', name: 'Norte' },
  { id: 'a', name: 'Álamos' },
  { id: 'c', name: 'Cañaveral' },
  { id: 'ni', name: 'Niño' },
  { id: 'ali', name: 'aliados' },
];
const before = original.map((site) => site.id);
const sorted = original.slice().sort(compareSiteNames);
assert.deepEqual(sorted.map((site) => site.name), ['Álamos', 'aliados', 'Bogotá', 'Cañaveral', 'Niño', 'Norte', 'Ñandú', 'Zuluaga']);
assert.deepEqual(original.map((site) => site.id), before, 'no se debe modificar la lista original');
assert.equal(compareSiteNames({ name: 'BOGOTÁ' }, { name: 'bogota' }), 0);
console.log('PASS: orden alfabético español, acentos, ñ, mayúsculas y lista original intacta');
