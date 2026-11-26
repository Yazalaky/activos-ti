import assert from 'node:assert/strict';
import { actCollaborator } from '../utils/actPeople.ts';

const director = { fullName: 'Directora ficticia', position: 'Directora', documentNumber: '111' };
const employee = { fullName: 'Colaboradora ficticia', position: 'Auxiliar', documentNumber: '222' };
assert.deepEqual(actCollaborator(director, employee, 1), employee);
for (const count of [2, 3, 4, 5]) assert.deepEqual(actCollaborator(director, employee, count), director);
assert.notEqual(actCollaborator(director, employee, 1), employee);
assert.notEqual(actCollaborator(director, employee, 2), director);
console.log('PASS: colaborador individual y director en equipos compartidos');
