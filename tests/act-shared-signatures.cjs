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
async function edit(db, uid, id, current, count, overrides = {}, directorSnapshot) {
  const now = Math.max(Date.now(), (current.lastEditedAt || 0) + 1);
  const nextRevision = (current.contentRevision || 1) + 1;
  const revisionId = `rev-${nextRevision}`;
  const before = { recipient: current.recipient, observations: current.observations || '', documentDetails: current.documentDetails };
  const after = { ...before, documentDetails: { ...current.documentDetails, discountSignatureCount: count } };
  if (directorSnapshot) after.documentDetails.directorSnapshot = directorSnapshot;
  const reason = 'Modificar espacios de firma';
  const batch = writeBatch(db);
  batch.update(doc(db, 'acts', id), {
    ...after, contentRevision: nextRevision, lastEditId: revisionId, lastEditedAt: now, lastEditedByUid: uid,
    lastEditReason: reason, updatedAt: now, updatedByUid: uid,
    ...(current.status === 'issued' ? { status: 'draft', issuedAt: deleteField(), generatedPdf: null, pdfUrl: null, pdfPath: null, pdfName: null, pdfContentType: null, pdfSize: null } : {}),
    ...overrides,
  });
  batch.set(doc(db, 'acts', id, 'revisions', revisionId), {
    actId: id, revision: nextRevision, reason, fromStatus: current.status, toStatus: 'draft', before, after, createdAt: now, createdByUid: uid,
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
  const sameEditor = { ...draft('admin-test'), status: 'issued', issuedAt: 200, updatedAt: 200, updatedByUid: 'admin-test' };
  await admin.doc('acts/same-editor').set(sameEditor);
  await edit(adminClient, 'admin-test', 'same-editor', sameEditor, 1, {}, { fullName: 'Director ficticio' });
  const firstEdit = (await admin.doc('acts/same-editor').get()).data();
  assert.equal(firstEdit.status, 'draft');
  assert.equal(firstEdit.updatedByUid, 'admin-test');
  assert.equal(firstEdit.documentDetails.directorSnapshot.fullName, 'Director ficticio');
  await edit(adminClient, 'admin-test', 'same-editor', firstEdit, 2);
  const secondEdit = (await admin.doc('acts/same-editor').get()).data();
  assert.equal(secondEdit.contentRevision, 3);
  assert.equal(secondEdit.lastEditReason, firstEdit.lastEditReason);
  assert.equal((await admin.doc('acts/same-editor/revisions/rev-3').get()).data().createdByUid, 'admin-test');
  console.log('CHECK: mismo usuario y mismo motivo conservan historial');
  const validSite = { name: 'Sede ficticia', city: 'Ciudad', address: 'Dirección', prefix: 'TEST', companyId: 'redinsalud', createdAt: 100, createdByUid: 'admin-test' };
  await setDoc(doc(adminClient, 'sites', 'new-site'), { ...validSite, director: { fullName: 'Directora Ficticia', position: 'Directora', documentNumber: '123456', email: 'directora@example.invalid', area: 'Dirección', phone: '3000000000', extension: '1', networkUser: 'usuario' } });
  await setDoc(doc(adminClient, 'sites', 'legacy-site'), validSite);
  await updateDoc(doc(tech, 'sites', 'site'), { name: 'Sede ficticia', city: 'Ciudad', address: 'Dirección', prefix: 'TEST', director: { fullName: 'Directora Ficticia' }, updatedAt: Date.now(), updatedByUid: 'tech-test' });
  await assert.rejects(() => updateDoc(doc(denied, 'sites', 'site'), { director: { fullName: 'Otro' }, updatedAt: Date.now(), updatedByUid: 'tech-denied' }), (error) => error.code === 'permission-denied');
  for (const [index, director] of [{ fullName: 42 }, { fullName: 'X'.repeat(201) }, { unexpected: 'valor' }, 'texto'].entries()) {
    await assert.rejects(() => setDoc(doc(adminClient, 'sites', `invalid-site-${index}`), { ...validSite, director }), (error) => error.code === 'permission-denied');
  }
  console.log('CHECK: directores opcionales, límites y acceso a sedes');
  await setDoc(doc(adminClient, 'acts', 'legacy'), draft('admin-test'));
  console.log('CHECK: acta antigua creada');
  const splitDraft = draft('admin-test', 1);
  splitDraft.documentDetails.directorSnapshot = { fullName: 'Director ficticio' };
  await setDoc(doc(adminClient, 'acts', 'split'), splitDraft);
  console.log('CHECK: acta nueva con director creado');
  const sharedSplit = draft('tech-test', 3);
  sharedSplit.documentDetails.directorSnapshot = { fullName: sharedSplit.recipient.fullName };
  sharedSplit.documentDetails.blankDiscountSigners = true;
  await setDoc(doc(tech, 'acts', 'shared-split'), sharedSplit);
  await edit(tech, 'tech-test', 'shared-split', sharedSplit, 4, {}, { fullName: sharedSplit.recipient.fullName });
  await edit(adminClient, 'admin-test', 'split', splitDraft, 1, {}, { fullName: 'Directora corregida' });
  assert.equal((await admin.doc('acts/split').get()).data().documentDetails.directorSnapshot.fullName, 'Directora corregida');
  assert.equal((await admin.doc('acts/split/revisions/rev-2').get()).data().before.documentDetails.directorSnapshot.fullName, 'Director ficticio');
  for (const [index, snapshot] of ['', { fullName: '' }, { fullName: 'X'.repeat(201) }, { fullName: 'Director', unexpected: true }].entries()) {
    const invalidDirector = draft('admin-test'); invalidDirector.documentDetails.directorSnapshot = snapshot;
    await assert.rejects(() => setDoc(doc(adminClient, 'acts', `invalid-director-${index}`), invalidDirector), (error) => error.code === 'permission-denied');
  }
  console.log('CHECK: director separado, historial y validación');
  console.log('CHECK: creación compatible con actas anteriores');
  for (let count = 1; count <= 5; count++) {
    await setDoc(doc(tech, 'acts', `valid-${count}`), draft('tech-test', count));
    const blankDraft = draft('tech-test', count);
    blankDraft.documentDetails.blankDiscountSigners = true;
    await setDoc(doc(tech, 'acts', `blank-${count}`), blankDraft);
  }
  const invalidBlankDraft = draft('admin-test', 1);
  invalidBlankDraft.documentDetails.blankDiscountSigners = 'true';
  await assert.rejects(() => setDoc(doc(adminClient, 'acts', 'invalid-blank'), invalidBlankDraft), (error) => error.code === 'permission-denied');
  for (const [index, count] of [0, 6, -1, 1.5, true, '5', null].entries()) {
    await assert.rejects(() => setDoc(doc(adminClient, 'acts', `invalid-${index}`), draft('admin-test', count)), (error) => error.code === 'permission-denied');
  }
  await assert.rejects(() => setDoc(doc(denied, 'acts', 'denied'), draft('tech-denied', 5)), (error) => error.code === 'permission-denied');
  console.log('CHECK: límites de firmas y acceso');
  const blankBefore = draft('tech-test', 1);
  blankBefore.documentDetails.blankDiscountSigners = true;
  await edit(tech, 'tech-test', 'blank-1', blankBefore, 2);
  const blankEdited = (await admin.doc('acts/blank-1').get()).data();
  assert.equal(blankEdited.documentDetails.blankDiscountSigners, true);
  assert.equal(blankEdited.documentDetails.discountSignatureCount, 2);
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
  await assert.rejects(() => edit(adminClient, 'admin-test', 'tampered', tampered, 3, { updatedByUid: 'tech-test' }), (error) => error.code === 'permission-denied');
  await assert.rejects(() => edit(adminClient, 'admin-test', 'tampered', tampered, 3, { lastEditedByUid: 'tech-test' }), (error) => error.code === 'permission-denied');
  await assert.rejects(() => edit(adminClient, 'admin-test', 'tampered', tampered, 3, { updatedAt: 1 }), (error) => error.code === 'permission-denied');
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
