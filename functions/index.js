const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

admin.initializeApp();

const assertString = (value, field) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpsError('invalid-argument', `Campo inválido: ${field}`);
  }
  return value.trim();
};

const allowedRoles = new Set(['admin', 'tech', 'auditor', 'management']);
const allowedCreateRoles = new Set(['tech', 'management']);

exports.createUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }

  const callerUid = request.auth.uid;
  const callerSnap = await admin.firestore().doc(`users/${callerUid}`).get();
  const callerRole = callerSnap.exists ? callerSnap.data().role : null;

  if (callerRole !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo administradores pueden crear usuarios.');
  }

  const email = assertString(request.data.email, 'email');
  const password = assertString(request.data.password, 'password');
  const name = assertString(request.data.name, 'name');
  const role = assertString(request.data.role, 'role');

  if (!allowedRoles.has(role)) {
    throw new HttpsError('invalid-argument', 'Rol inválido.');
  }
  if (!allowedCreateRoles.has(role)) {
    throw new HttpsError('invalid-argument', 'Este rol no se puede crear desde la app.');
  }

  const userRecord = await admin.auth().createUser({
    email,
    password,
    displayName: name,
  });

  await admin.firestore().doc(`users/${userRecord.uid}`).set({
    email,
    name,
    role,
  });

  return { uid: userRecord.uid };
});

