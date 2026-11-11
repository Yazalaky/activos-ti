// Solo emulador: firebase emulators:exec --project demo-act-signatures --only firestore 'node tests/act-shared-signatures.cjs'
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
if (process.env.GCLOUD_PROJECT !== 'demo-act-signatures' || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Esta prueba requiere exclusivamente el emulador demo-act-signatures.');
}
const root = path.resolve(__dirname, '..');
const adminRequire = createRequire(path.join(root, 'functions/index.js'));
const appRequire = createRequire(path.join(root, 'package.json'));
const { initializeApp: initializeAdminApp } = adminRequire('firebase-admin/app');
const { getFirestore: getAdminFirestore } = adminRequire('firebase-admin/firestore');
const { initializeApp, deleteApp } = appRequire('firebase/app');
const { getFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc, deleteField, writeBatch, terminate } = appRequire('firebase/firestore');
initializeAdminApp({ projectId: 'demo-act-signatures' });
const admin = getAdminFirestore();
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const clients = [];
function client(uid) {
  const app = initializeApp({ projectId: 'demo-act-signatures', apiKey: 'demo' }, uid);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, host, Number(port), { mockUserToken: { sub: uid, user_id: uid } });
  clients.push({ app, db });
  return db;
}
const details = () => ({
  deviceTypes: { desktop: false, laptop: false, printer: true, tablet: false, cellphone: false, other: false },
  standardSoftware: { office365: false, antivirus: false, adobeReader: false, sevenZip: false, chrome: false, mozilla: false },
  requestedSoftware: { tns: false, tipificador: false, progsalud: false, ccleaner: false, ipscan: false, anydesk: false },
  discountSources: { fees: false, salary: true, benefits: false }, partyType: 'employee',
  deliveredByName: 'Técnico ficticio', otherDeviceType: '', charger: 'N/A', mouse: 'N/A', monitor: 'N/A',
  license: 'N/A', keyboard: 'N/A', phoneSerial: 'N/A', phoneImei: 'N/A', otherSoftware: '',
  discountAmountWords: 'Dos millones', discountAmountValue: '2000000',
});
const draft = (uid, count) => ({
  assetId: 'asset', siteId: 'site', companyId: 'redinsalud', templateId: 'redinsalud',
  fixedAssetIdSnapshot: 'TEST-001', companyNitSnapshot: '900000000-1',
  assetSnapshot: { type: 'printer', brand: 'Marca', model: 'Modelo', serial: 'SERIAL' },
  recipient: { fullName: 'Receptora Ficticia', position: 'Directora', documentNumber: '123456', email: 'test@example.invalid', area: 'Dirección', phone: '3000000000', extension: '1', networkUser: 'usuario' },
  documentDetails: { ...details(), ...(count === undefined ? {} : { discountSignatureCount: count }) },
  status: 'draft', contentRevision: 1, createdAt: 100, createdByUid: uid,
});
async function edit(db, uid, id, current, count, overrides = {}) {
  const now = Date.now();
  const before = { recipient: current.recipient, observations: '', documentDetails: current.documentDetails };
  const after = { ...before, documentDetails: { ...current.documentDetails, discountSignatureCount: count } };
  const reason = 'Modificar espacios de firma';
  const batch = writeBatch(db);
  batch.update(doc(db, 'acts', id), {
    ...after, contentRevision: 2, lastEditId: 'rev-2', lastEditedAt: now, lastEditedByUid: uid,
    lastEditReason: reason, updatedAt: now, updatedByUid: uid,
    ...(current.status === 'issued' ? { status: 'draft', issuedAt: deleteField(), generatedPdf: null, pdfUrl: null, pdfPath: null, pdfName: null, pdfContentType: null, pdfSize: null } : {}),
    ...overrides,
  });
  batch.set(doc(db, 'acts', id, 'revisions', 'rev-2'), {
    actId: id, revision: 2, reason, fromStatus: current.status, toStatus: 'draft', before, after, createdAt: now, createdByUid: uid,
  });
  await batch.commit();
}
async function main() {
  await Promise.all([
    admin.doc('users/admin-test').set({ role: 'admin', accessScope: 'global' }),
    admin.doc('users/tech-test').set({ role: 'tech', active: true, accessScope: 'sites', siteIds: ['site'] }),
    admin.doc('users/tech-denied').set({ role: 'tech', active: true, accessScope: 'sites', siteIds: ['other'] }),
    admin.doc('sites/site').set({ name: 'Sede ficticia', companyId: 'redinsalud' }),
    admin.doc('assets/asset').set({ siteId: 'site', status: 'asignado', currentAssignment: { assignedToName: 'Receptora Ficticia', assignedToPosition: 'Directora', assignedToResponsible: 'Responsable' } }),
  ]);
  const adminClient = client('admin-test');
  const tech = client('tech-test');
  const denied = client('tech-denied');
  await setDoc(doc(adminClient, 'acts', 'legacy'), draft('admin-test'));
  console.log('CHECK: creación compatible con actas anteriores');
  for (let count = 1; count <= 5; count++) {
    await setDoc(doc(tech, 'acts', `valid-${count}`), draft('tech-test', count));
  }
  for (const [index, count] of [0, 6, -1, 1.5, true, '5', null].entries()) {
    await assert.rejects(() => setDoc(doc(adminClient, 'acts', `invalid-${index}`), draft('admin-test', count)), (error) => error.code === 'permission-denied');
  }
  await assert.rejects(() => setDoc(doc(denied, 'acts', 'denied'), draft('tech-denied', 5)), (error) => error.code === 'permission-denied');
  console.log('CHECK: límites de firmas y acceso');
  const before = draft('admin-test');
  await edit(adminClient, 'admin-test', 'legacy', before, 5);
  assert.equal((await admin.doc('acts/legacy').get()).data().documentDetails.discountSignatureCount, 5);
  assert.equal((await admin.doc('acts/legacy/revisions/rev-2').get()).data().after.documentDetails.discountSignatureCount, 5);
  console.log('CHECK: corrección de borrador con datos completos');
  const invalidEdit = draft('admin-test');
  await setDoc(doc(adminClient, 'acts', 'invalid-edit'), invalidEdit);
  await assert.rejects(() => edit(adminClient, 'admin-test', 'invalid-edit', invalidEdit, 6), (error) => error.code === 'permission-denied');
  for (const [index, value] of [1, 0, 'true', null].entries()) {
    const invalidCheckbox = draft('admin-test');
    invalidCheckbox.documentDetails.deviceTypes.printer = value;
    await admin.doc(`acts/invalid-checkbox-${index}`).set(invalidCheckbox);
    await assert.rejects(() => edit(adminClient, 'admin-test', `invalid-checkbox-${index}`, invalidCheckbox, 3), (error) => error.code === 'permission-denied');
  }
  console.log('CHECK: correcciones inválidas rechazadas');
  const issued = { ...draft('tech-test'), status: 'issued', issuedAt: 200 };
  await admin.doc('acts/issued').set(issued);
  await edit(tech, 'tech-test', 'issued', issued, 3);
  console.log('CHECK: técnico corrigió acta emitida');
  const editedIssued = (await admin.doc('acts/issued').get()).data();
  assert.equal(editedIssued.status, 'draft');
  assert.equal(editedIssued.documentDetails.discountSignatureCount, 3);
  assert.equal(editedIssued.issuedAt, undefined);
  const tampered = draft('admin-test');
  await admin.doc('acts/tampered').set(tampered);
  await assert.rejects(() => edit(adminClient, 'admin-test', 'tampered', tampered, 3, { siteId: 'other' }), (error) => error.code === 'permission-denied');
  await assert.rejects(() => edit(denied, 'tech-denied', 'tampered', tampered, 3), (error) => error.code === 'permission-denied');
  await assert.rejects(() => updateDoc(doc(adminClient, 'acts', 'tampered'), { 'documentDetails.discountSignatureCount': 3, updatedAt: Date.now(), updatedByUid: 'admin-test' }), (error) => error.code === 'permission-denied');
  const signed = { ...draft('admin-test'), status: 'signed', signatureMethod: 'uploaded_pdf' };
  await admin.doc('acts/signed').set(signed);
  await assert.rejects(() => edit(adminClient, 'admin-test', 'signed', signed, 3), (error) => error.code === 'permission-denied');
  console.log('CHECK: corrección emitida, técnico, auditoría y bloqueos');
  console.log('PASS: creación, corrección con historial, 1 a 5 firmas, compatibilidad y permisos');
  await Promise.all(clients.map(async ({ app, db }) => { await terminate(db); await deleteApp(app); }));
}
main().catch((error) => { console.error('FAIL:', error); process.exit(1); });
