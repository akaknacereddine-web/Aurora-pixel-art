import type { User } from 'firebase/auth';
import { signInWithPopup, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { Project } from '../engine/types';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { sanitizeProjectForFirestore, validateProjectPayload } from './firestoreValidation';

function timestampToMs(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export async function signInWithGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  await ensureUserProfile(cred.user);
  return cred.user;
}

export async function signOutFromCloud(): Promise<void> {
  await signOut(auth);
}

export async function ensureUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const displayName = (user.displayName || user.email?.split('@')[0] || 'Pixel Creator')
    .trim()
    .slice(0, 80);
  const email = (user.email || 'creator@aurorapixel.app').trim().slice(0, 160);

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!snap.exists()) {
    try {
      await setDoc(userRef, {
        uid: user.uid,
        displayName,
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(userRef, {
        displayName,
        email,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export function subscribeUserProjects(
  uid: string,
  onProjects: (projects: Project[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = `users/${uid}/projects`;
  const q = query(collection(db, 'users', uid, 'projects'), where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Project[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: String(data.id || docSnap.id),
          name: String(data.name || 'Untitled Project'),
          type: data.type === 'video' ? 'video' : 'canvas',
          width: Number(data.width || 32),
          height: Number(data.height || 32),
          createdAt: timestampToMs(data.createdAt),
          updatedAt: timestampToMs(data.updatedAt),
          activeFrameIndex: Number(data.activeFrameIndex || 0),
          activeLayerId: String(data.activeLayerId || ''),
          onionSkin: data.onionSkin,
          palette: Array.isArray(data.palette) ? data.palette : [],
          customBrushes: Array.isArray(data.customBrushes) ? data.customBrushes : [],
          frames: Array.isArray(data.frames) ? data.frames : [],
        });
      });
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      onProjects(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );
}

export async function saveProjectToFirestore(uid: string, project: Project): Promise<void> {
  const sanitized = sanitizeProjectForFirestore(project, uid);
  const path = `users/${uid}/projects/${sanitized.id}`;
  const payloadBytes = new Blob([JSON.stringify(sanitized)]).size;
  if (payloadBytes > 950_000) {
    throw new Error('Project exceeds Firestore 1MB document size limit. Try reducing frame count.');
  }

  const check = validateProjectPayload(
    { ...sanitized, createdAt: Date.now(), updatedAt: Date.now() },
    uid
  );
  if (!check.ok) {
    throw new Error(check.reason || 'Invalid project payload.');
  }

  const projRef = doc(db, 'users', uid, 'projects', sanitized.id);
  let snap;
  try {
    snap = await getDoc(projRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!snap.exists()) {
    try {
      await setDoc(projRef, {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    const existingData = snap.data();
    const updatePayload: Record<string, unknown> = {
      name: sanitized.name,
      activeFrameIndex: sanitized.activeFrameIndex,
      activeLayerId: sanitized.activeLayerId,
      onionSkin: sanitized.onionSkin,
      palette: sanitized.palette,
      customBrushes: sanitized.customBrushes,
      frames: sanitized.frames,
      updatedAt: serverTimestamp(),
    };
    if (existingData?.type === 'canvas' && sanitized.type === 'video') {
      updatePayload.type = 'video';
    }
    try {
      await updateDoc(projRef, updatePayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function deleteProjectFromFirestore(uid: string, projectId: string): Promise<void> {
  const path = `users/${uid}/projects/${projectId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
