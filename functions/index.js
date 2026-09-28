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
const allowedAccessScopes = new Set(['global', 'sites']);

const getCallerProfile = async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }

  const callerSnap = await admin.firestore().doc(`users/${request.auth.uid}`).get();
  const callerData = callerSnap.exists ? callerSnap.data() : null;
  const callerRole = callerData?.role || null;
  const callerActive = callerData?.active !== false;
  if (callerRole !== 'admin' || !callerActive) {
    throw new HttpsError('permission-denied', 'Solo administradores pueden realizar esta acción.');
  }

  return callerData;
};

const assertEmail = (value) => {
  const email = assertString(value, 'email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new HttpsError('invalid-argument', 'El correo electrónico no es válido.');
  }
  return email;
};

const assertPassword = (value) => {
  const password = assertString(value, 'password');
  if (password.length < 8 || password.length > 128) {
    throw new HttpsError('invalid-argument', 'La contraseña debe tener entre 8 y 128 caracteres.');
  }
  return password;
};

const normalizeAccess = async (data) => {
  const accessScope = data.accessScope || 'global';
  if (!allowedAccessScopes.has(accessScope)) {
    throw new HttpsError('invalid-argument', 'Alcance de acceso inválido.');
  }

  const rawSiteIds = Array.isArray(data.siteIds) ? data.siteIds : [];
  const siteIds = [...new Set(rawSiteIds.map((id) => assertString(id, 'siteIds')))].filter(Boolean);
  if (siteIds.length > 30) {
    throw new HttpsError('invalid-argument', 'No se pueden asignar más de 30 sedes a un usuario.');
  }
  if (accessScope === 'sites' && siteIds.length === 0) {
    throw new HttpsError('invalid-argument', 'Selecciona al menos una sede para el alcance restringido.');
  }

  if (siteIds.length > 0) {
    const siteRefs = siteIds.map((siteId) => admin.firestore().doc(`sites/${siteId}`));
    const siteSnapshots = await admin.firestore().getAll(...siteRefs);
    if (siteSnapshots.some((snapshot) => !snapshot.exists)) {
      throw new HttpsError('invalid-argument', 'Una o más sedes no existen.');
    }
  }

  return {
    accessScope,
    siteIds: accessScope === 'sites' ? siteIds : [],
  };
};

exports.createUser = onCall(async (request) => {
  await getCallerProfile(request);

  const callerUid = request.auth.uid;
  const email = assertEmail(request.data.email);
  const password = assertPassword(request.data.password);
  const name = assertString(request.data.name, 'name');
  const role = assertString(request.data.role, 'role');

  if (!allowedRoles.has(role)) {
    throw new HttpsError('invalid-argument', 'Rol inválido.');
  }
  if (!allowedCreateRoles.has(role)) {
    throw new HttpsError('invalid-argument', 'Este rol no se puede crear desde la app.');
  }

  const access = await normalizeAccess(request.data);
  let userRecord;

  try {
    userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    await admin.firestore().doc(`users/${userRecord.uid}`).set({
      email,
      name,
      role,
      active: true,
      ...access,
      createdAt: Date.now(),
      createdByUid: callerUid,
    });

    return { uid: userRecord.uid };
  } catch (error) {
    if (userRecord?.uid) {
      try {
        await admin.auth().deleteUser(userRecord.uid);
      } catch (rollbackError) {
        console.error('No se pudo revertir el usuario creado:', rollbackError);
      }
    }
    console.error('Error creando usuario:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'No se pudo crear el usuario.');
  }
});

exports.setUserStatus = onCall(async (request) => {
  await getCallerProfile(request);

  const uid = assertString(request.data.uid, 'uid');
  const disabled = request.data.disabled === true;
  const callerUid = request.auth.uid;

  if (uid === callerUid) {
    throw new HttpsError('failed-precondition', 'No puedes inactivar tu propio usuario.');
  }

  try {
    await admin.auth().updateUser(uid, { disabled });
    await admin.firestore().doc(`users/${uid}`).set({
      active: !disabled,
      updatedAt: Date.now(),
      updatedByUid: callerUid,
    }, { merge: true });

    return { uid, disabled };
  } catch (error) {
    console.error('Error actualizando estado de usuario:', error);
    throw new HttpsError('internal', 'No se pudo actualizar el estado del usuario.');
  }
});
