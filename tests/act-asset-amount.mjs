// Ejecutar con: node --experimental-strip-types tests/act-asset-amount.mjs
import assert from 'node:assert/strict';
import { actAssetAmount } from '../utils/actAssetAmount.ts';

const examples = [
  [1_900_000, 'Un millón novecientos mil pesos', '1.900.000'],
  [1, 'Un peso', '1'],
  [21, 'Veintiún pesos', '21'],
  [31, 'Treinta y un pesos', '31'],
  [100, 'Cien pesos', '100'],
  [101, 'Ciento un pesos', '101'],
  [1_000, 'Mil pesos', '1.000'],
  [21_000, 'Veintiún mil pesos', '21.000'],
  [1_000_000, 'Un millón de pesos', '1.000.000'],
  [2_000_001, 'Dos millones un pesos', '2.000.001'],
  [1_000_000_000, 'Mil millones de pesos', '1.000.000.000'],
  [1_900_000.5, 'Un millón novecientos mil pesos con cincuenta centavos', '1.900.000,50'],
  [0.01, 'Cero pesos con un centavo', '0,01'],
];
for (const [cost, words, numeric] of examples) {
  assert.deepEqual(actAssetAmount(cost), { discountAmountWords: words, discountAmountValue: numeric });
}
for (const invalid of [undefined, null, 0, -1, NaN, Infinity, '1900000', 1.001, 1_000_000_000_000]) {
  assert.equal(actAssetAmount(invalid), null);
}
console.log('PASS: valores COP en letras y cifras, centavos y costos no válidos');
