# Security Specification — Aurora Pixel Art

## 1. Data Invariants
1. **Owner-Only Profile Isolation**: A document at `/users/{userId}` can only be read (`get`), created, or updated by `request.auth.uid == userId` with a verified email (`request.auth.token.email_verified == true`). Listing `/users` is strictly denied (`allow list: if false`).
2. **Master Gate Parent Existence**: A project at `/users/{userId}/projects/{projectId}` cannot be created unless the parent `/users/{userId}` document already exists (`exists(...)`), and `ownerId` strictly equals `request.auth.uid == userId`.
3. **Strict Path & ID Validation**: Every `{userId}` and `{projectId}` must match `^[a-zA-Z0-9_\-]+$` and be `<= 128` characters.
4. **Immutable Ownership & Creation Time**: On update, `id`, `ownerId`, `createdAt`, `width`, and `height` cannot be reassigned or backdated; `updatedAt` must equal `request.time`.
5. **Bounded Arrays & Safe Types**: `frames` (`1..120`), `palette` (`1..64`), and `customBrushes` (`1..32`) are strictly bounded lists; `width` and `height` are integers between `4` and `256`; `type` is `'canvas' | 'video'`.
6. **Zero Shadow Fields**: `keys().hasAll(...)` and `keys().hasOnly(...)` block any extra unapproved fields (`isAdmin`, `role`, etc.).

## 2. The "Dirty Dozen" Attack Payloads
1. **Unauthenticated Read/Write**: `auth = null` attempting `get` or `create` on `/users/u1/projects/p1` -> **DENIED**.
2. **Unverified Email Write**: `auth = { uid: 'u1', token: { email_verified: false } }` creating project -> **DENIED**.
3. **Cross-User Project Read/List**: `auth.uid = 'u2'` reading or listing `/users/u1/projects` -> **DENIED**.
4. **User Directory Scraping**: `auth.uid = 'u1'` calling `list` on `/users` -> **DENIED**.
5. **Identity Spoofing on Create**: `auth.uid = 'u1'` creating `/users/u1/projects/p1` with `ownerId: 'u2'` -> **DENIED**.
6. **Shadow Field Injection**: `auth.uid = 'u1'` creating `/users/u1` with extra `{ isAdmin: true }` -> **DENIED**.
7. **Path ID Poisoning**: Document ID `projectId = "bad/id$123"` failing regex `^[a-zA-Z0-9_\-]+$` -> **DENIED**.
8. **Orphan Project Without User Profile**: Creating `/users/u1/projects/p1` when `/users/u1` does not exist -> **DENIED**.
9. **Client Timestamp Forgery**: Creating project with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> **DENIED**.
10. **Immutable Field Tampering on Update**: Updating project `ownerId` or `createdAt` -> **DENIED**.
11. **Denial-of-Wallet Oversized Canvas**: Creating project with `width: 4096` (> 256) or `name` > 120 chars -> **DENIED**.
12. **Unbounded Array Exhaustion**: Creating project with `frames` length > 120 or `palette` length 0 -> **DENIED**.
