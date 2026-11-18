// Solo emulador: firebase emulators:exec --project demo-act-signatures --only firestore 'node tests/act-shared-renderer-guard.cjs'
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
if (process.env.GCLOUD_PROJECT !== 'demo-act-signatures' || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Esta prueba requiere exclusivamente el emulador demo-act-signatures.');
}
process.env.ACT_RENDERER_URL = 'https://renderer-test.run.app';
const root = path.resolve(__dirname, '..');
const functionRequire = createRequire(path.join(root, 'functions/index.js'));
const { getFirestore } = functionRequire('firebase-admin/firestore');
const functions = require(path.join(root, 'functions/index.js'));
const db = getFirestore();
let responseCount;
let responseBlank;
global.fetch = async (url) => {
  const target = new URL(url);
  if (target.hostname === 'metadata.google.internal') return { ok: true, text: async () => 'token-ficticio' };
  if (target.origin !== 'https://renderer-test.run.app' || target.pathname !== '/render') throw new Error('Red no permitida en la prueba');
  const body = { fileName: 'acta-TEST-001.pdf', pdfBase64: Buffer.from('%PDF-ficticio').toString('base64') };
  if (responseCount !== undefined) body.discountSignatureCount = responseCount;
  if (responseBlank !== undefined) body.blankDiscountSigners = responseBlank;
  return { ok: true, json: async () => body };
};
const act = (count) => ({
  siteId: 'site', companyId: 'redinsalud', fixedAssetIdSnapshot: 'TEST-001', companyNitSnapshot: '900000000-1',
  recipient: { fullName: 'Receptora Ficticia' }, assetSnapshot: {}, documentDetails: { discountSignatureCount: count }, status: 'draft',
});
async function main() {
  await Promise.all([
    db.doc('users/admin-test').set({ role: 'admin', accessScope: 'global', name: 'Administrador ficticio' }),
    db.doc('sites/site').set({ companyId: 'redinsalud' }),
    db.doc('actTemplates/redinsalud').set({ companyName: 'Empresa ficticia', nit: '900000000-1', active: true }),
    db.doc('acts/shared').set(act(5)),
    db.doc('acts/individual').set(act(1)),
    db.doc('acts/blank-single').set({ ...act(1), documentDetails: { discountSignatureCount: 1, blankDiscountSigners: true } }),
    db.doc('acts/blank-shared').set({ ...act(3), documentDetails: { discountSignatureCount: 3, blankDiscountSigners: true } }),
  ]);
  const shared = { auth: { uid: 'admin-test' }, data: { actId: 'shared' } };
  responseCount = undefined;
  await assert.rejects(() => functions.generateSharedActPdf.run(shared), (error) => error.code === 'failed-precondition');
  assert.equal((await db.doc('acts/shared').get()).data().status, 'draft');
  responseCount = 3;
  await assert.rejects(() => functions.generateSharedActPdf.run(shared), (error) => error.code === 'failed-precondition');
  assert.equal((await db.doc('acts/shared').get()).data().status, 'draft');
  responseCount = 5;
  const generated = await functions.generateSharedActPdf.run(shared);
  assert.equal(generated.fileName, 'acta-TEST-001.pdf');
  assert.equal((await db.doc('acts/shared').get()).data().status, 'issued');
  responseCount = undefined;
  await functions.generateActPdf.run({ auth: { uid: 'admin-test' }, data: { actId: 'individual' } });
  assert.equal((await db.doc('acts/individual').get()).data().status, 'issued');
  const blank = { auth: { uid: 'admin-test' }, data: { actId: 'blank-single' } };
  responseCount = 1;
  responseBlank = undefined;
  await assert.rejects(() => functions.generateBlankSignerActPdf.run(blank), (error) => error.code === 'failed-precondition');
  assert.equal((await db.doc('acts/blank-single').get()).data().status, 'draft');
  responseBlank = false;
  await assert.rejects(() => functions.generateBlankSignerActPdf.run(blank), (error) => error.code === 'failed-precondition');
  responseBlank = true;
  await functions.generateBlankSignerActPdf.run(blank);
  assert.equal((await db.doc('acts/blank-single').get()).data().status, 'issued');
  responseCount = 3;
  await functions.generateBlankSignerActPdf.run({ auth: { uid: 'admin-test' }, data: { actId: 'blank-shared' } });
  assert.equal((await db.doc('acts/blank-shared').get()).data().status, 'issued');
  console.log('PASS: renderizador antiguo o incompatible no emite el acta; uno compatible sí, y una firma conserva compatibilidad');
}
main().then(() => process.exit(0)).catch((error) => { console.error('FAIL:', error); process.exit(1); });
