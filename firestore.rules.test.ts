import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateProjectPayload, validateUserProfilePayload } from './src/services/firestoreValidation';

const VALID_ID = /^[a-zA-Z0-9_\-]+$/;

function simulateRulesDecision(opts: {
  auth: { uid: string; emailVerified: boolean } | null;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  collection: 'users' | 'projects';
  pathUserId: string;
  pathProjectId?: string;
  parentUserExists?: boolean;
  existing?: Record<string, unknown>;
  incoming?: Record<string, unknown>;
  requestTime?: number;
}): 'ALLOW' | 'PERMISSION_DENIED' {
  const {
    auth,
    operation,
    collection,
    pathUserId,
    pathProjectId,
    parentUserExists = true,
    existing,
    incoming,
    requestTime = 1700000000000,
  } = opts;

  if (!auth) return 'PERMISSION_DENIED';
  if (!VALID_ID.test(pathUserId) || pathUserId.length > 128) return 'PERMISSION_DENIED';
  if (collection === 'users') {
    if (operation === 'list' || operation === 'delete') return 'PERMISSION_DENIED';
    if (auth.uid !== pathUserId) return 'PERMISSION_DENIED';
    if (operation === 'get') return 'ALLOW';
    if (!auth.emailVerified || !incoming) return 'PERMISSION_DENIED';
    if (incoming.createdAt !== (operation === 'create' ? requestTime : existing?.createdAt)) {
      return 'PERMISSION_DENIED';
    }
    if (incoming.updatedAt !== requestTime) return 'PERMISSION_DENIED';
    const check = validateUserProfilePayload(incoming, auth.uid);
    return check.ok ? 'ALLOW' : 'PERMISSION_DENIED';
  }

  // Projects subcollection
  if (operation === 'list') {
    return auth.uid === pathUserId && existing?.ownerId === auth.uid ? 'ALLOW' : 'PERMISSION_DENIED';
  }
  if (!pathProjectId || !VALID_ID.test(pathProjectId) || pathProjectId.length > 128) {
    return 'PERMISSION_DENIED';
  }
  if (auth.uid !== pathUserId) return 'PERMISSION_DENIED';
  if (operation === 'get' || operation === 'delete') {
    return existing?.ownerId === auth.uid ? 'ALLOW' : 'PERMISSION_DENIED';
  }
  if (!auth.emailVerified || !incoming) return 'PERMISSION_DENIED';
  if (operation === 'create' && !parentUserExists) return 'PERMISSION_DENIED';
  if (incoming.id !== pathProjectId || incoming.ownerId !== auth.uid) return 'PERMISSION_DENIED';
  if (incoming.createdAt !== (operation === 'create' ? requestTime : existing?.createdAt)) {
    return 'PERMISSION_DENIED';
  }
  if (incoming.updatedAt !== requestTime) return 'PERMISSION_DENIED';
  if (operation === 'update') {
    if (incoming.width !== existing?.width || incoming.height !== existing?.height) {
      return 'PERMISSION_DENIED';
    }
  }
  const check = validateProjectPayload(incoming, auth.uid);
  return check.ok ? 'ALLOW' : 'PERMISSION_DENIED';
}

function makeValidProject(now: number) {
  return {
    id: 'proj_1',
    ownerId: 'u1',
    name: 'Aurora Sprite',
    type: 'canvas',
    width: 32,
    height: 32,
    activeFrameIndex: 0,
    activeLayerId: 'l1',
    onionSkin: {
      enabled: false,
      prevFrames: 1,
      nextFrames: 1,
      opacity: 35,
      tintEnabled: true,
      prevTint: '#EF4444',
      nextTint: '#38BDF8',
    },
    palette: ['#0B142E', '#45F0DF'],
    customBrushes: [{ id: 'b1', name: 'Pixel', size: 1, matrix: [1] }],
    frames: [
      {
        id: 'f1',
        name: 'Frame 1',
        durationMs: 150,
        transition: 'cut',
        transitionMs: 120,
        layers: [
          {
            id: 'l1',
            name: 'Layer 1',
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'normal',
            pixelsRle: '1024*0',
          },
        ],
        effects: [],
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

test('Dirty Dozen security payloads all result in PERMISSION_DENIED', () => {
  const now = 1700000000000;
  const validProj = makeValidProject(now);

  // 1. Unauthenticated access
  assert.equal(
    simulateRulesDecision({
      auth: null,
      operation: 'create',
      collection: 'projects',
      pathUserId: 'u1',
      pathProjectId: 'proj_1',
      incoming: validProj,
      requestTime: now,
    }),
    'PERMISSION_DENIED'
  );

  // 2. Unverified email write
  assert.equal(
    simulateRulesDecision({
      auth: { uid: 'u1', emailVerified: false },
      operation: 'create',
      collection: 'projects',
      pathUserId: 'u1',
      pathProjectId: 'proj_1',
      incoming: validProj,
      requestTime: now,
    }),
    'PERMISSION_DENIED'
  );

  // 3. Cross-user project read
  assert.equal(
    simulateRulesDecision({
      auth: { uid: 'u2', emailVerified: true },
      operation: 'get',
      collection: 'projects',
      pathUserId: 'u1',
      pathProjectId: 'proj_1',
      existing: validProj,
    }),
    'PERMISSION_DENIED'
  );

  // 4. User directory scraping
  assert.equal(
    simulateRulesDecision({
      auth: { uid: 'u1', emailVerified: true },
      operation: 'list',
      collection: 'users',
      pathUserId: 'u1',
    }),
    'PERMISSION_DENIED'
  );

  // 5. Identity spoofing on create
  assert.equal(
    simulateRulesDecision({
      auth: { uid: 'u1', emailVerified: true },
      operation: 'create',
      collection: 'projects',
      pathUserId: 'u1',
      pathProjectId: 'proj_1',
      incoming: { ...validProj, ownerId: 'u2' },
      requestTime: now,
    }),
    'PERMISSION_DENIED'
  );

  // 6. Shadow field injection on UserProfile
  assert.equal(
    simulateRulesDecision({
      auth: { uid: 'u1', emailVerified: true },
      operation: 'create',
      collection: 'users',
      pathUserId: 'u1',
      incoming: {
        uid: 'u1',
        displayName: 'Nacer',
        email: 'user@example.com',
        createdAt: now,
        updatedAt: now,
        isAdmin: true,
      },
      requestTime: now,
    }),
    'PERMISSION_DENIED'
  );

  // 7. Path ID poisoning
  assert.equal(
    simulateRulesDecision({
      auth: { uid: 'u1', emailVerified: true },
      operation: 'create',
      collection: 'projects',
      pathUserId: 'u1',
      pathProjectId: 'bad$id!',
      incoming: { ...validProj, id: 'bad$id!' },
      requestTime: now,
    }),
    'PERMISSION_DENIED'
  );

  // 8. Orphan project without parent user doc
  assert.equal(
    simulateRulesDecision({
      auth: { uid: 'u1', emailVerified: true },
      operation: 'create',
      collection: 'projects',
      pathUserId: 'u1',
      pathProjectId: 'proj_1',
      parentUserExists: false,
      incoming: validProj,
      requestTime: now,
    }),
    'PERMISSION_DENIED'
  );

  // 9. Client timestamp forgery
  assert.equal(
    simulateRulesDecision({
      auth: { uid: 'u1', emailVerified: true },
      operation: 'create',
      collection: 'projects',
      pathUserId: 'u1',
      pathProjectId: 'proj_1',
      incoming: { ...validProj, createdAt: 1000 },
      requestTime: now,
    }),
    'PERMISSION_DENIED'
  );

  // 10. Immutable field tampering on update
  assert.equal(
    simulateRulesDecision({
      auth: { uid: 'u1', emailVerified: true },
      operation: 'update',
      collection: 'projects',
      pathUserId: 'u1',
      pathProjectId: 'proj_1',
      existing: validProj,
      incoming: { ...validProj, width: 64, updatedAt: now + 5000 },
      requestTime: now + 5000,
    }),
    'PERMISSION_DENIED'
  );

  // 11. Oversized canvas (>256px)
  assert.equal(
    simulateRulesDecision({
      auth: { uid: 'u1', emailVerified: true },
      operation: 'create',
      collection: 'projects',
      pathUserId: 'u1',
      pathProjectId: 'proj_1',
      incoming: { ...validProj, width: 4096 },
      requestTime: now,
    }),
    'PERMISSION_DENIED'
  );

  // 12. Unbounded or empty palette/frames
  assert.equal(
    simulateRulesDecision({
      auth: { uid: 'u1', emailVerified: true },
      operation: 'create',
      collection: 'projects',
      pathUserId: 'u1',
      pathProjectId: 'proj_1',
      incoming: { ...validProj, palette: [] },
      requestTime: now,
    }),
    'PERMISSION_DENIED'
  );
});

test('Valid owner project payload passes and firestore.rules contains Eight Pillars guards', () => {
  const now = 1700000000000;
  const validProj = makeValidProject(now);
  assert.equal(
    simulateRulesDecision({
      auth: { uid: 'u1', emailVerified: true },
      operation: 'create',
      collection: 'projects',
      pathUserId: 'u1',
      pathProjectId: 'proj_1',
      parentUserExists: true,
      incoming: validProj,
      requestTime: now,
    }),
    'ALLOW'
  );

  const rulesContent = fs.readFileSync('firestore.rules', 'utf-8');
  assert.ok(rulesContent.includes("rules_version = '2';"));
  assert.ok(rulesContent.includes('match /{document=**}'));
  assert.ok(rulesContent.includes('isValidUserProfile'));
  assert.ok(rulesContent.includes('isValidProject'));
  assert.ok(rulesContent.includes('email_verified == true'));
});
