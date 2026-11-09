// Run with Firestore and Storage emulators for the demo-invoice-payments project.
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');

if (process.env.GCLOUD_PROJECT !== 'demo-invoice-payments'
  || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  throw new Error('This test requires the demo-invoice-payments Firestore and Storage emulators.');
}

const root = path.resolve(__dirname, '..');
const functionRequire = createRequire(path.join(root, 'functions/index.js'));
const appRequire = createRequire(path.join(root, 'package.json'));
const { getFirestore: getAdminFirestore } = functionRequire('firebase-admin/firestore');
const { getStorage } = functionRequire('firebase-admin/storage');
const { confirmInvoicePaymentReceipt } = functionRequire('./index.js');
const { initializeApp, deleteApp } = appRequire('firebase/app');
const { getFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc, terminate } = appRequire('firebase/firestore');

const db = getAdminFirestore();
const bucket = getStorage().bucket();
const uid = 'admin-test';
const invoiceId = 'invoice-test';
const basePath = `invoices/${invoiceId}/payment-receipts/`;
const invoice = {
  supplierId: 'supplier-test', number: 'TEST-1', siteId: 'site-test', description: 'Factura ficticia',
  date: '2026-10-01', dueDate: '2026-10-30', total: 100, status: 'paid', createdAt: 1, createdByUid: uid,
};

const putPdf = async (name, contents = '%PDF-1.4\nFicticio\n%%EOF') => {
  const storagePath = basePath + name;
  await bucket.file(storagePath).save(Buffer.from(contents), {
    contentType: 'application/pdf', metadata: { metadata: { uploadedByUid: uid, originalName: name } },
  });
  return storagePath;
};
const confirm = (storagePath, extra = {}) => confirmInvoicePaymentReceipt.run({
  auth: { uid }, data: { invoiceId, storagePath, action: extra.replacePath ? 'replace' : 'add', ...extra },
});

async function main() {
  assert.deepEqual(await confirmInvoicePaymentReceipt.run({ auth: { uid }, data: { action: 'capabilities' } }), { supportsMultipleReceipts: true });
  await assert.rejects(() => confirmInvoicePaymentReceipt.run({ data: { action: 'capabilities' } }), (error) => error.code === 'unauthenticated');
  await Promise.all([
    db.doc(`users/${uid}`).set({ role: 'admin', active: true, accessScope: 'global' }),
    db.doc('users/tech-test').set({ role: 'tech', active: true, accessScope: 'sites', siteIds: ['site-test'] }),
    db.doc('users/tech-other').set({ role: 'tech', active: true, accessScope: 'sites', siteIds: ['other-site'] }),
    db.doc('sites/site-test').set({ name: 'Sede ficticia' }),
    db.doc('suppliers/supplier-test').set({ name: 'Proveedor ficticio' }),
  ]);

  const legacyPath = await putPdf('legacy.pdf');
  const legacy = { path: legacyPath, url: 'https://example.invalid/legacy', name: 'legacy.pdf', contentType: 'application/pdf', size: 20, uploadedAt: 1, uploadedByUid: uid };
  await db.doc(`invoices/${invoiceId}`).set({ ...invoice, paymentReceipt: legacy });
  const secondPath = await putPdf('second.pdf');
  const added = await confirm(secondPath);
  assert.deepEqual(added.paymentReceipts.map((item) => item.path), [legacyPath, secondPath]);
  assert.equal(added.paymentReceipt.path, legacyPath);
  assert.equal((await bucket.file(legacyPath).exists())[0], true);
  assert.equal((await confirm(secondPath)).paymentReceipts.length, 2);

  const replacementPath = await putPdf('replacement.pdf');
  const replaced = await confirm(replacementPath, { replacePath: legacyPath });
  assert.deepEqual(replaced.paymentReceipts.map((item) => item.path), [replacementPath, secondPath]);
  assert.equal((await bucket.file(legacyPath).exists())[0], false);
  assert.equal((await bucket.file(secondPath).exists())[0], true);
  const stalePath = await putPdf('stale.pdf');
  await assert.rejects(() => confirm(stalePath, { replacePath: legacyPath }), (error) => error.code === 'failed-precondition');
  assert.equal((await bucket.file(stalePath).exists())[0], false);
  const invalidPath = await putPdf('invalid.pdf', 'No es un PDF');
  await assert.rejects(() => confirm(invalidPath), (error) => error.code === 'invalid-argument');
  assert.equal((await bucket.file(invalidPath).exists())[0], false);

  const thirdPath = await putPdf('third.pdf');
  const fourthPath = await putPdf('fourth.pdf');
  await Promise.all([confirm(thirdPath), confirm(fourthPath)]);
  const finalInvoice = (await db.doc(`invoices/${invoiceId}`).get()).data();
  assert.equal(finalInvoice.status, 'paid');
  assert.deepEqual(new Set(finalInvoice.paymentReceipts.map((item) => item.path)), new Set([replacementPath, secondPath, thirdPath, fourthPath]));
  const legacyClientPath = await putPdf('legacy-client.pdf');
  const legacyClientResult = await confirmInvoicePaymentReceipt.run({ auth: { uid }, data: { invoiceId, storagePath: legacyClientPath } });
  assert.deepEqual(new Set(legacyClientResult.paymentReceipts.map((item) => item.path)), new Set([legacyClientPath, secondPath, thirdPath, fourthPath]));
  assert.equal((await bucket.file(replacementPath).exists())[0], false);
  assert.equal((await bucket.file(secondPath).exists())[0], true);
  const deniedPath = await putPdf('denied.pdf');
  await assert.rejects(() => confirmInvoicePaymentReceipt.run({ auth: { uid: 'tech-other' }, data: { invoiceId, storagePath: deniedPath } }), (error) => error.code === 'permission-denied');

  await db.doc('invoices/pending-first').set({ ...invoice, status: 'pending' });
  const firstPath = 'invoices/pending-first/payment-receipts/first.pdf';
  await bucket.file(firstPath).save(Buffer.from('%PDF-1.4\nFicticio\n%%EOF'), {
    contentType: 'application/pdf', metadata: { metadata: { uploadedByUid: 'tech-test', originalName: 'first.pdf' } },
  });
  const first = await confirmInvoicePaymentReceipt.run({ auth: { uid: 'tech-test' }, data: { invoiceId: 'pending-first', storagePath: firstPath, action: 'add' } });
  assert.equal(first.paymentReceipts.length, 1);
  assert.equal((await db.doc('invoices/pending-first').get()).data().status, 'paid');

  const client = initializeApp({ projectId: 'demo-invoice-payments', apiKey: 'demo' }, 'rules-client');
  const clientDb = getFirestore(client);
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  connectFirestoreEmulator(clientDb, host, Number(port), { mockUserToken: { sub: uid, user_id: uid } });
  const clientRef = doc(clientDb, 'invoices', invoiceId);
  await updateDoc(clientRef, { description: 'Edición permitida', updatedAt: Date.now(), updatedByUid: uid });
  await setDoc(doc(clientDb, 'invoices', 'normal'), { ...invoice, status: 'pending', createdAt: Date.now() });
  await assert.rejects(() => updateDoc(clientRef, { paymentReceipts: [], updatedAt: Date.now(), updatedByUid: uid }), (error) => error.code === 'permission-denied');
  await assert.rejects(() => updateDoc(clientRef, { status: 'pending', updatedAt: Date.now(), updatedByUid: uid }), (error) => error.code === 'permission-denied');
  await assert.rejects(() => setDoc(doc(clientDb, 'invoices', 'forged'), { ...invoice, status: 'pending', paymentReceipts: [legacy], createdAt: Date.now() }), (error) => error.code === 'permission-denied');
  await terminate(clientDb);
  await deleteApp(client);
  console.log('PASS: soportes anteriores, múltiples PDF, reemplazo, concurrencia y reglas de acceso');
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
