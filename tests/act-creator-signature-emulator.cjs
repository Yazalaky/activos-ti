// Solo emulador: firebase emulators:exec --project demo-act-signatures --only firestore 'node tests/act-creator-signature-emulator.cjs'
const assert = require('node:assert/strict');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
if (process.env.GCLOUD_PROJECT !== 'demo-act-signatures' || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Esta prueba requiere exclusivamente el emulador demo-act-signatures.');
}
process.env.ACT_RENDERER_URL = 'https://renderer-test.run.app';
const root = path.resolve(__dirname, '..');
const functionRequire = createRequire(path.join(root, 'functions/index.js'));
const appRequire = createRequire(path.join(root, 'package.json'));
const functions = require(path.join(root, 'functions/index.js'));
const { getFirestore: getAdminFirestore } = functionRequire('firebase-admin/firestore');
const { initializeApp, deleteApp } = appRequire('firebase/app');
const { Bytes, getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, deleteDoc, serverTimestamp, terminate } = appRequire('firebase/firestore');
const db = getAdminFirestore();
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const clients = [];
function client(uid) {
  const app = initializeApp({ projectId: 'demo-act-signatures', apiKey: 'demo' }, uid);
  const clientDb = getFirestore(app);
  connectFirestoreEmulator(clientDb, host, Number(port), { mockUserToken: { sub: uid, user_id: uid } });
  clients.push({ app, clientDb });
  return clientDb;
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJWsAAAAASUVORK5CYII=', 'base64');
const pngWilliam = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64');
const payload = (uid, image = png) => ({ image: Bytes.fromUint8Array(image), contentType: 'image/png', authorized: true,
  updatedAt: serverTimestamp(), updatedByUid: uid });
const act = (creator, name, status = 'draft') => ({
  siteId: 'site', companyId: 'redinsalud', fixedAssetIdSnapshot: 'TEST-001', companyNitSnapshot: '900000000-1',
  recipient: { fullName: 'Receptora ficticia' }, assetSnapshot: {}, documentDetails: { deliveredByName: name },
  ...(creator ? { createdByUid: creator } : {}), status,
});
let lastBody;
let incompatible = false;
let directorSupported = true;
let revokeDuringRender = false;
global.fetch = async (url, options) => {
  const target = new URL(url);
  if (target.hostname === 'metadata.google.internal') return { ok: true, text: async () => 'token-ficticio' };
  if (target.origin !== 'https://renderer-test.run.app' || target.pathname !== '/render') throw new Error('Red no permitida');
  lastBody = JSON.parse(options.body);
  if (revokeDuringRender) await db.doc('users/fab/private/actSignature').delete();
  const image = lastBody.delivererSignature && Buffer.from(lastBody.delivererSignature, 'base64');
  return { ok: true, json: async () => ({ fileName: 'acta-TEST-001.pdf',
    pdfBase64: Buffer.from('%PDF-ficticio').toString('base64'), discountSignatureCount: 1,
    directorSnapshotSupported: directorSupported,
    delivererSignatureApplied: Boolean(image) && !incompatible,
    delivererSignatureSha256: image ? createHash('sha256').update(image).digest('hex') : null }) };
};

async function main() {
  await Promise.all([
    db.doc('users/fab').set({ role: 'admin', active: true, accessScope: 'global', name: 'Fabián Méndez' }),
    db.doc('users/william').set({ role: 'tech', active: true, accessScope: 'global', name: 'William' }),
    db.doc('users/auditor').set({ role: 'auditor', active: true, accessScope: 'global', name: 'Auditor' }),
    db.doc('sites/site').set({ companyId: 'redinsalud' }),
    db.doc('actTemplates/redinsalud').set({ companyName: 'Empresa ficticia', nit: '900000000-1', active: true }),
  ]);
  const fab = client('fab');
  const william = client('william');
  const auditor = client('auditor');
  const fabSignature = doc(fab, 'users/fab/private/actSignature');
  await setDoc(fabSignature, payload('fab'));
  assert.equal((await getDoc(fabSignature)).exists(), true);
  await assert.rejects(() => getDoc(doc(william, 'users/fab/private/actSignature')), (error) => error.code === 'permission-denied');
  await assert.rejects(() => setDoc(doc(william, 'users/fab/private/actSignature'), payload('william')), (error) => error.code === 'permission-denied');
  await assert.rejects(() => deleteDoc(doc(william, 'users/fab/private/actSignature')), (error) => error.code === 'permission-denied');
  await assert.rejects(() => setDoc(doc(auditor, 'users/auditor/private/actSignature'), payload('auditor')), (error) => error.code === 'permission-denied');
  await assert.rejects(() => setDoc(fabSignature, { ...payload('fab'), authorized: false }), (error) => error.code === 'permission-denied');
  await assert.rejects(() => setDoc(fabSignature, { ...payload('fab'), updatedByUid: 'william' }), (error) => error.code === 'permission-denied');
  await assert.rejects(() => setDoc(fabSignature, { ...payload('fab'), image: Bytes.fromUint8Array(new Uint8Array(250001)) }), (error) => error.code === 'permission-denied');
  await setDoc(doc(william, 'users/william/private/actSignature'), payload('william', pngWilliam));
  await assert.rejects(() => getDoc(doc(fab, 'users/william/private/actSignature')), (error) => error.code === 'permission-denied');
  await assert.rejects(() => setDoc(doc(fab, 'users/william/private/actSignature'), payload('fab')), (error) => error.code === 'permission-denied');
  console.log('CHECK: cada usuario controla únicamente su firma privada');

  await db.doc('acts/fab-created').set(act('fab', 'Fabián Méndez'));
  const result = await functions.generateActPdf.run({ auth: { uid: 'william' }, data: { actId: 'fab-created' } });
  assert.equal(result.signatureStatus, 'included');
  assert.deepEqual(Buffer.from(lastBody.delivererSignature, 'base64'), png);
  assert.equal(lastBody.delivererName, 'Fabián Méndez');
  const audit = await db.collection('acts/fab-created/signatureEvents').get();
  assert.equal(audit.size, 1);
  assert.equal(audit.docs[0].data().ownerUid, 'fab');
  assert.equal(audit.docs[0].data().generatedByUid, 'william');
  await assert.rejects(() => getDoc(doc(william, 'acts/fab-created/signatureEvents', audit.docs[0].id)), (error) => error.code === 'permission-denied');
  const firstIssueDate = (await db.doc('acts/fab-created').get()).data().issuedAt;
  assert.equal((await functions.generateActPdf.run({ auth: { uid: 'william' }, data: { actId: 'fab-created' } })).signatureStatus, 'included');
  assert.equal((await db.doc('acts/fab-created').get()).data().issuedAt, firstIssueDate);
  assert.equal((await db.collection('acts/fab-created/signatureEvents').get()).size, 2);

  await db.doc('acts/william-created').set(act('william', 'William'));
  assert.equal((await functions.generateActPdf.run({ auth: { uid: 'fab' }, data: { actId: 'william-created' } })).signatureStatus, 'included');
  assert.equal(lastBody.delivererName, 'William');
  assert.deepEqual(Buffer.from(lastBody.delivererSignature, 'base64'), pngWilliam);
  await db.doc('acts/no-creator').set(act(null, 'Fabián Méndez'));
  assert.equal((await functions.generateActPdf.run({ auth: { uid: 'william' }, data: { actId: 'no-creator' } })).signatureStatus, 'creator-unverified');
  assert.equal(lastBody.delivererSignature, undefined);
  await db.doc('acts/mismatch').set(act('fab', 'William'));
  assert.equal((await functions.generateActPdf.run({ auth: { uid: 'william' }, data: { actId: 'mismatch' } })).signatureStatus, 'creator-unverified');
  assert.equal(lastBody.delivererSignature, undefined);
  await db.doc('acts/signed').set(act('fab', 'Fabián Méndez', 'signed'));
  await assert.rejects(() => functions.generateActPdf.run({ auth: { uid: 'william' }, data: { actId: 'signed' } }), (error) => error.code === 'failed-precondition');
  console.log('CHECK: firma del creador, autoría ambigua y actas firmadas');

  await db.doc('acts/incompatible').set(act('fab', 'Fabián Méndez'));
  incompatible = true;
  await assert.rejects(() => functions.generateActPdf.run({ auth: { uid: 'william' }, data: { actId: 'incompatible' } }), (error) => error.code === 'failed-precondition');
  assert.equal((await db.doc('acts/incompatible').get()).data().status, 'draft');
  incompatible = false;
  const splitAct = act('fab', 'Fabián Méndez');
  splitAct.recipient = { fullName: 'Colaboradora ficticia' };
  splitAct.documentDetails.directorSnapshot = { fullName: 'Directora ficticia' };
  await db.doc('acts/split').set(splitAct);
  directorSupported = false;
  await assert.rejects(() => functions.generateActPdf.run({ auth: { uid: 'william' }, data: { actId: 'split' } }), (error) => error.code === 'failed-precondition');
  assert.equal((await db.doc('acts/split').get()).data().status, 'draft');
  directorSupported = true;
  await functions.generateActPdf.run({ auth: { uid: 'william' }, data: { actId: 'split' } });
  assert.equal(lastBody.act.recipient.fullName, 'Colaboradora ficticia');
  assert.equal(lastBody.act.documentDetails.directorSnapshot.fullName, 'Directora ficticia');
  await db.doc('acts/revoked').set(act('fab', 'Fabián Méndez'));
  revokeDuringRender = true;
  await assert.rejects(() => functions.generateActPdf.run({ auth: { uid: 'william' }, data: { actId: 'revoked' } }), (error) => error.code === 'failed-precondition');
  assert.equal((await db.doc('acts/revoked').get()).data().status, 'draft');
  assert.equal((await db.collection('acts/revoked/signatureEvents').get()).size, 0);
  revokeDuringRender = false;
  await db.doc('acts/not-configured').set(act('fab', 'Fabián Méndez'));
  assert.equal((await functions.generateActPdf.run({ auth: { uid: 'william' }, data: { actId: 'not-configured' } })).signatureStatus, 'not-configured');
  assert.equal(lastBody.delivererSignature, undefined);
  await Promise.all(clients.map(async ({ app, clientDb }) => { await terminate(clientDb); await deleteApp(app); }));
  console.log('PASS: renderizador incompatible y firma revocada no emiten el acta');
}
main().then(() => process.exit(0)).catch((error) => { console.error('FAIL:', error); process.exit(1); });
