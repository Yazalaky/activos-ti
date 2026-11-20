// Ejecutar con: node --experimental-strip-types tests/act-asset-availability.mjs
import assert from 'node:assert/strict';
import { assetAvailableForAct, assetIdsWithActiveActs, assetsForActSite } from '../utils/actAvailability.ts';

const assignment = { assignedToName: 'Persona', assignedToPosition: 'Cargo', assignedToResponsible: 'Entrega' };
const acts = [
  { assetId: '001', status: 'issued' },
  { assetId: '002', status: 'draft' },
  { assetId: '004', status: 'signed' },
  { assetId: '005', status: 'void' },
  { assetId: '006', status: 'draft', isDeleted: true },
  { assetId: '007', status: 'legacy' },
];
const occupied = assetIdsWithActiveActs(acts);
const asset = (id, extra = {}) => ({ id, status: 'asignado', currentAssignment: assignment, ...extra });
assert.deepEqual(['001', '002', '003', '004'].filter((id) => assetAvailableForAct(asset(id), occupied)), ['003']);
assert.equal(assetAvailableForAct(asset('005'), occupied), true, 'un acta anulada no bloquea');
assert.equal(assetAvailableForAct(asset('006'), occupied), true, 'un acta eliminada no bloquea');
assert.equal(assetAvailableForAct(asset('007'), occupied), false, 'estado antiguo no anulado bloquea');
assert.equal(assetAvailableForAct(asset('008', { status: 'bodega' }), occupied), false);
assert.equal(assetAvailableForAct(asset('009', { currentAssignment: { assignedToName: 'Persona' } }), occupied), false);
assert.equal(assetAvailableForAct(asset('010', { currentAssignment: null }), occupied), false);
const equipment = [asset('001', { siteId: 'bogota' }), asset('003', { siteId: 'bogota' }),
  asset('011', { siteId: 'otra' })];
assert.deepEqual(assetsForActSite(equipment, occupied, 'bogota').map((item) => item.id), ['003']);
assert.deepEqual(assetsForActSite(equipment, occupied, 'bogota', '001').map((item) => item.id), ['001', '003'], 'editar conserva el activo del acta');
assert.deepEqual(assetsForActSite(equipment, occupied, 'otra').map((item) => item.id), ['011']);
assert.deepEqual(acts.map((act) => act.assetId), ['001', '002', '004', '005', '006', '007']);
console.log('PASS: se ocultan activos con actas vigentes, se permiten anuladas y se exige asignación completa');
