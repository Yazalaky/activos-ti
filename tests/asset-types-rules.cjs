// Solo emulador: firebase emulators:exec --project demo-asset-types --only firestore 'node tests/asset-types-rules.cjs'
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
if (process.env.GCLOUD_PROJECT !== 'demo-asset-types' || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Esta prueba requiere exclusivamente el emulador demo-asset-types.');
}
const root = path.resolve(__dirname, '..');
const adminRequire = createRequire(path.join(root, 'functions/index.js'));
const appRequire = createRequire(path.join(root, 'package.json'));
const { initializeApp: initializeAdminApp } = adminRequire('firebase-admin/app');
const { getFirestore: getAdminFirestore } = adminRequire('firebase-admin/firestore');
const { initializeApp, deleteApp } = appRequire('firebase/app');
const { getFirestore, connectFirestoreEmulator, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, runTransaction, terminate } = appRequire('firebase/firestore');
initializeAdminApp({ projectId: 'demo-asset-types' });
const adminDb = getAdminFirestore();
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const clients = [];
function client(uid) {
  const app = initializeApp({ projectId: 'demo-asset-types', apiKey: 'demo' }, uid || 'anonymous');
  const db = getFirestore(app);
  connectFirestoreEmulator(db, host, Number(port), uid ? { mockUserToken: { sub: uid, user_id: uid } } : undefined);
  clients.push({ app, db });
  return db;
}
const custom = 'custom_abcdefghijklmnopqrst';
const typeData = (name, active, uid) => ({ name, active, createdAt: 100, createdByUid: uid });
const asset = (type, uid) => ({ fixedAssetId: 'TEST-001', siteId: 'site', type, brand: 'Marca', model: 'Modelo',
  serial: 'SERIE', status: 'bodega', currentAssignment: null, createdAt: 100, createdByUid: uid });
async function main() {
  await Promise.all([
    adminDb.doc('users/admin').set({ role: 'admin', active: true, accessScope: 'global' }),
    adminDb.doc('users/tech').set({ role: 'tech', active: true, accessScope: 'sites', siteIds: ['site'] }),
    adminDb.doc('users/auditor').set({ role: 'auditor', active: true, accessScope: 'global' }),
    adminDb.doc('sites/site').set({ name: 'Sede', city: 'Ciudad', address: 'Dirección', prefix: 'TEST' }),
  ]);
  const admin = client('admin'); const tech = client('tech'); const auditor = client('auditor'); const anon = client(null);
  await getDocs(collection(tech, 'assetTypes'));
  await assert.rejects(() => getDocs(collection(anon, 'assetTypes')), (error) => error.code === 'permission-denied');
  for (const type of ['laptop', 'tablet', 'cellphone']) await setDoc(doc(tech, 'assets', `asset-${type}`), asset(type, 'tech'));
  for (const type of ['tablet', 'cellphone']) {
    const ref = doc(tech, 'assets', `hardware-${type}`);
    const hardware = { processor: 'Procesador ficticio', ram: '8 GB', storage: '128 GB', os: 'Sistema ficticio' };
    await setDoc(ref, { ...asset(type, 'tech'), ...hardware });
    const saved = (await getDoc(ref)).data();
    assert.deepEqual(Object.fromEntries(Object.keys(hardware).map((key) => [key, saved[key]])), hardware);
    await updateDoc(ref, { os: 'Sistema actualizado', updatedAt: 102, updatedByUid: 'tech' });
    assert.equal((await getDoc(ref)).data().os, 'Sistema actualizado');
  }
  await assert.rejects(() => setDoc(doc(tech, 'assets', 'unknown'), asset(custom, 'tech')), (error) => error.code === 'permission-denied');
  await assert.rejects(() => setDoc(doc(tech, 'assetTypes', custom), typeData('Proyector', true, 'tech')), (error) => error.code === 'permission-denied');
  await assert.rejects(() => setDoc(doc(auditor, 'assetTypes', custom), typeData('Proyector', true, 'auditor')), (error) => error.code === 'permission-denied');
  await assert.rejects(() => setDoc(doc(admin, 'assetTypes', 'invalid'), typeData('Inválido', true, 'admin')), (error) => error.code === 'permission-denied');
  await setDoc(doc(admin, 'assetTypes', custom), typeData('Proyector', true, 'admin'));
  await setDoc(doc(tech, 'assets', 'custom-asset'), asset(custom, 'tech'));
  await runTransaction(tech, async (tx) => {
    const siteRef = doc(tech, 'sites', 'site');
    await tx.get(siteRef);
    tx.update(siteRef, { assetSeq: 1, updatedAt: 100, updatedByUid: 'tech' });
    tx.set(doc(tech, 'assets', 'cell-transaction'), asset('cellphone', 'tech'));
  });
  await updateDoc(doc(admin, 'assetTypes', custom), { name: 'Video beam', active: false, updatedAt: 101, updatedByUid: 'admin' });
  await assert.rejects(() => setDoc(doc(tech, 'assets', 'custom-new'), asset(custom, 'tech')), (error) => error.code === 'permission-denied');
  await updateDoc(doc(tech, 'assets', 'custom-asset'), { notes: 'Se conserva', updatedAt: 102, updatedByUid: 'tech' });
  await assert.rejects(() => updateDoc(doc(tech, 'assets', 'asset-tablet'), { type: custom, updatedAt: 102, updatedByUid: 'tech' }), (error) => error.code === 'permission-denied');
  await assert.rejects(() => deleteDoc(doc(admin, 'assetTypes', custom)), (error) => error.code === 'permission-denied');
  await setDoc(doc(admin, 'assetTypes', 'laptop'), typeData('Laptop', false, 'admin'));
  await assert.rejects(() => setDoc(doc(tech, 'assets', 'disabled-laptop'), asset('laptop', 'tech')), (error) => error.code === 'permission-denied');
  await updateDoc(doc(tech, 'assets', 'asset-laptop'), { notes: 'Histórico conservado', updatedAt: 103, updatedByUid: 'tech' });
  await updateDoc(doc(admin, 'assetTypes', custom), { active: true, updatedAt: 104, updatedByUid: 'admin' });
  await setDoc(doc(tech, 'assets', 'reactivated'), asset(custom, 'tech'));
  await Promise.all(clients.map(async ({ app, db }) => { await terminate(db); await deleteApp(app); }));
  console.log('PASS: catálogo protegido, tipos personalizados, desactivación y equipos históricos');
}
main().then(() => process.exit(0)).catch((error) => { console.error('FAIL:', error); process.exit(1); });
