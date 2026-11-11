// Run with: firebase emulators:exec --project demo-asset-move --only firestore 'node tests/asset-site-move.cjs'
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');

if (process.env.GCLOUD_PROJECT !== 'demo-asset-move' || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('This test requires the demo-asset-move Firestore emulator.');
}

const root = path.resolve(__dirname, '..');
const functionRequire = createRequire(path.join(root, 'functions/index.js'));
const appRequire = createRequire(path.join(root, 'package.json'));
const { initializeApp: initializeAdminApp } = functionRequire('firebase-admin/app');
const { getFirestore: getAdminFirestore } = functionRequire('firebase-admin/firestore');
const { initializeApp, deleteApp } = appRequire('firebase/app');
const { getFirestore, connectFirestoreEmulator, doc, updateDoc, runTransaction, terminate } = appRequire('firebase/firestore');

initializeAdminApp({ projectId: 'demo-asset-move' });
const adminDb = getAdminFirestore();
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const clients = [];

function client(uid) {
  const app = initializeApp({ projectId: 'demo-asset-move', apiKey: 'demo' }, uid || 'anonymous');
  const db = getFirestore(app);
  connectFirestoreEmulator(db, host, Number(port), uid ? { mockUserToken: { sub: uid, user_id: uid } } : undefined);
  clients.push({ app, db });
  return db;
}

const site = (prefix, assetSeq) => ({
  name: 'Sede ficticia', city: 'Puerto Wilches', address: 'Dirección ficticia',
  prefix, assetSeq, releasedAssetSeqs: [], companyId: 'redinsalud', updatedAt: 1, updatedByUid: 'admin-test',
});
const asset = (overrides = {}) => ({
  brand: 'HP', model: 'Modelo ficticio', serial: 'SERIE-PRUEBA', purchaseDate: '2026-10-28',
  cost: 2900000, notes: '', status: 'bodega', type: 'printer', siteId: 'origin',
  fixedAssetId: 'RWIL-005', currentAssignment: null, createdAt: 1, createdByUid: 'admin-test',
  updatedAt: 1, updatedByUid: 'admin-test', ...overrides,
});

const move = (db, uid, assetId, targetId, overrides = {}) => runTransaction(db, async (tx) => {
  const assetRef = doc(db, 'assets', assetId);
  const siteRef = doc(db, 'sites', targetId);
  const [assetSnapshot, siteSnapshot] = await Promise.all([tx.get(assetRef), tx.get(siteRef)]);
  const current = assetSnapshot.data();
  const destination = siteSnapshot.data();
  const now = Date.now();
  const nextSeq = (destination.assetSeq || 0) + 1;
  if (!overrides.skipSequence) tx.update(siteRef, { assetSeq: nextSeq, updatedAt: now, updatedByUid: uid });
  tx.update(assetRef, {
    siteId: targetId,
    fixedAssetId: `${destination.prefix}-${String(nextSeq).padStart(3, '0')}`,
    previousFixedAssetIds: [current.fixedAssetId], movedAt: now, movedFromSiteId: current.siteId,
    updatedAt: now, updatedByUid: uid, ...overrides.fields,
  });
});

const decommission = (db, uid, assetId, overrides = {}) => updateDoc(doc(db, 'assets', assetId), {
  status: 'baja', currentAssignment: null, decommissionReason: 'Baja masiva de equipos en bodega',
  decommissionedAt: Date.now(), decommissionedByUid: uid, updatedAt: Date.now(), updatedByUid: uid, ...overrides,
});

async function main() {
  const legacy = asset();
  delete legacy.status;
  await Promise.all([
    adminDb.doc('users/admin-test').set({ role: 'admin', accessScope: 'global' }),
    adminDb.doc('users/tech-test').set({ role: 'tech', active: true, accessScope: 'sites', siteIds: ['origin', 'dest'] }),
    adminDb.doc('users/tech-limited').set({ role: 'tech', active: true, accessScope: 'sites', siteIds: ['origin'] }),
    adminDb.doc('users/auditor').set({ role: 'auditor', active: true, accessScope: 'global' }),
    adminDb.doc('users/inactive').set({ role: 'admin', active: false, accessScope: 'global' }),
    adminDb.doc('sites/origin').set(site('RWIL', 5)),
    adminDb.doc('sites/dest').set(site('RPWI', 12)),
    adminDb.doc('sites/hundred').set(site('R100', 99)),
    adminDb.doc('assets/legacy-assignment').set(legacy),
    ...['normal', 'tech', 'denied', 'wrong-code', 'no-sequence', 'tampered', 'no-history', 'decom', 'invalid-decom', 'edit', 'hundred', 'assignment', 'photo', 'tech-edit']
      .map((id) => adminDb.doc(`assets/${id}`).set(asset())),
    ...Array.from({ length: 12 }, (_, index) => adminDb.doc(`assets/bulk-${index}`).set(asset())),
  ]);

  const admin = client('admin-test');
  const tech = client('tech-test');
  const limited = client('tech-limited');
  const auditor = client('auditor');
  const inactive = client('inactive');
  const anonymous = client(null);

  await move(admin, 'admin-test', 'normal', 'dest');
  console.log('CHECK: administrador trasladó el activo');
  const moved = (await adminDb.doc('assets/normal').get()).data();
  assert.equal(moved.siteId, 'dest');
  assert.equal(moved.fixedAssetId, 'RPWI-013');
  assert.deepEqual(moved.previousFixedAssetIds, ['RWIL-005']);
  assert.equal(moved.movedFromSiteId, 'origin');
  assert.equal(moved.serial, 'SERIE-PRUEBA');
  assert.equal((await adminDb.doc('sites/dest').get()).data().assetSeq, 13);
  assert.equal((await adminDb.doc('sites/origin').get()).data().assetSeq, 5);

  await move(tech, 'tech-test', 'tech', 'dest');
  console.log('CHECK: técnico trasladó el activo');
  assert.equal((await adminDb.doc('assets/tech').get()).data().fixedAssetId, 'RPWI-014');
  await move(admin, 'admin-test', 'hundred', 'hundred');
  assert.equal((await adminDb.doc('assets/hundred').get()).data().fixedAssetId, 'R100-100');
  await assert.rejects(() => move(limited, 'tech-limited', 'denied', 'dest'), (error) => error.code === 'permission-denied');
  await assert.rejects(() => move(auditor, 'auditor', 'denied', 'dest'), (error) => error.code === 'permission-denied');
  await assert.rejects(() => move(inactive, 'inactive', 'denied', 'dest'), (error) => error.code === 'permission-denied');
  await assert.rejects(() => move(anonymous, 'anonymous', 'denied', 'dest'), (error) => error.code === 'permission-denied');
  await assert.rejects(() => move(admin, 'admin-test', 'wrong-code', 'dest', { fields: { fixedAssetId: 'RPWI-999' } }), (error) => error.code === 'permission-denied');
  await assert.rejects(() => move(admin, 'admin-test', 'no-sequence', 'dest', { skipSequence: true }), (error) => error.code === 'permission-denied');
  await assert.rejects(() => move(admin, 'admin-test', 'tampered', 'dest', { fields: { cost: 1 } }), (error) => error.code === 'permission-denied');
  await assert.rejects(() => move(admin, 'admin-test', 'no-history', 'dest', { fields: { previousFixedAssetIds: [] } }), (error) => error.code === 'permission-denied');
  assert.equal((await adminDb.doc('sites/dest').get()).data().assetSeq, 14);
  for (const id of ['denied', 'wrong-code', 'no-sequence', 'tampered', 'no-history']) {
    assert.equal((await adminDb.doc(`assets/${id}`).get()).data().siteId, 'origin');
  }

  await decommission(admin, 'admin-test', 'decom');
  console.log('CHECK: administrador registró la baja');
  assert.equal((await adminDb.doc('assets/decom').get()).data().status, 'baja');
  await runTransaction(admin, async (tx) => {
    const refs = Array.from({ length: 12 }, (_, index) => doc(admin, 'assets', `bulk-${index}`));
    await Promise.all(refs.map((ref) => tx.get(ref)));
    const now = Date.now();
    for (const ref of refs) tx.update(ref, { status: 'baja', currentAssignment: null, decommissionReason: 'Baja masiva de equipos en bodega', decommissionedAt: now, decommissionedByUid: 'admin-test', updatedAt: now, updatedByUid: 'admin-test' });
  });
  assert.equal((await adminDb.doc('assets/bulk-11').get()).data().status, 'baja');
  await assert.rejects(() => decommission(admin, 'admin-test', 'invalid-decom', { decommissionReason: 'No' }), (error) => error.code === 'permission-denied');
  await assert.rejects(() => decommission(admin, 'admin-test', 'invalid-decom', { decommissionedByUid: 'someone-else' }), (error) => error.code === 'permission-denied');
  await assert.rejects(() => updateDoc(doc(admin, 'assets', 'decom'), { status: 'bodega', updatedAt: Date.now(), updatedByUid: 'admin-test' }), (error) => error.code === 'permission-denied');
  await assert.rejects(() => updateDoc(doc(admin, 'assets', 'decom'), { status: 'asignado', currentAssignment: { assignedToName: 'Usuario', assignedToPosition: 'Cargo', assignedToResponsible: 'Responsable', assignedAt: Date.now() }, updatedAt: Date.now(), updatedByUid: 'admin-test' }), (error) => error.code === 'permission-denied');
  await updateDoc(doc(admin, 'assets', 'edit'), { notes: 'Edición válida', updatedAt: Date.now(), updatedByUid: 'admin-test' });
  await updateDoc(doc(tech, 'assets', 'tech-edit'), { notes: 'Edición válida', updatedAt: Date.now(), updatedByUid: 'tech-test' });
  await updateDoc(doc(tech, 'assets', 'assignment'), { status: 'asignado', currentAssignment: { assignedToName: 'Usuario', assignedToPosition: 'Cargo', assignedToResponsible: 'Responsable', assignedAt: Date.now() }, updatedAt: Date.now(), updatedByUid: 'tech-test' });
  await updateDoc(doc(tech, 'assets', 'legacy-assignment'), { status: 'asignado', currentAssignment: { assignedToName: 'Usuario', assignedToPosition: 'Cargo', assignedToResponsible: 'Responsable', assignedAt: Date.now() }, updatedAt: Date.now(), updatedByUid: 'tech-test' });
  await updateDoc(doc(tech, 'assets', 'photo'), { imageUrl: 'https://example.invalid/foto', imagePath: 'assets/photo/photos/foto.jpg', updatedAt: Date.now(), updatedByUid: 'tech-test' });
  console.log('CHECK: edición ordinaria permitida');
  await assert.rejects(() => updateDoc(doc(admin, 'assets', 'edit'), { fixedAssetId: 'OTRO-001', updatedAt: Date.now(), updatedByUid: 'admin-test' }), (error) => error.code === 'permission-denied');

  await Promise.all(clients.map(async ({ db, app }) => { await terminate(db); await deleteApp(app); }));
  console.log('PASS: traslado atómico, permisos, consecutivo, auditoría, baja y edición ordinaria');
}

main().then(() => process.exit(0)).catch((error) => { console.error('FAIL:', error.stack || error); process.exit(1); });
