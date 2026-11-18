import { createSeedProjects } from '../engine/presets';
import type { Project } from '../engine/types';

const DB_NAME = 'atelier_pixel_studio_db';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const SEEDED_FLAG = 'atelier_pixel_seeded_v1';
const VAULT_CODE_KEY = 'atelier_pixel_vault_code';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadAllProjects(): Promise<Project[]> {
  try {
    const db = await openDb();
    const existing = await new Promise<Project[]>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as Project[]) || []);
      req.onerror = () => reject(req.error);
    });

    if (existing.length === 0 && !localStorage.getItem(SEEDED_FLAG)) {
      const seeds = createSeedProjects();
      await saveProjectsBulk(seeds);
      localStorage.setItem(SEEDED_FLAG, '1');
      return seeds;
    }
    return existing.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    // Fallback to localStorage if IndexedDB unavailable
    const raw = localStorage.getItem('atelier_pixel_projects_fallback');
    if (raw) {
      try {
        return JSON.parse(raw) as Project[];
      } catch {
        return createSeedProjects();
      }
    }
    const seeds = createSeedProjects();
    localStorage.setItem('atelier_pixel_projects_fallback', JSON.stringify(seeds));
    return seeds;
  }
}

export async function saveProjectLocal(project: Project): Promise<void> {
  const stamped: Project = { ...project, updatedAt: Date.now() };
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      tx.objectStore(STORE_PROJECTS).put(stamped);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const list = await loadAllProjects();
    const next = [stamped, ...list.filter((p) => p.id !== stamped.id)];
    localStorage.setItem('atelier_pixel_projects_fallback', JSON.stringify(next));
  }
}

export async function saveProjectsBulk(projects: Project[]): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      for (const p of projects) {
        store.put(p);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.setItem('atelier_pixel_projects_fallback', JSON.stringify(projects));
  }
}

export async function deleteProjectLocal(projectId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      tx.objectStore(STORE_PROJECTS).delete(projectId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const list = await loadAllProjects();
    localStorage.setItem(
      'atelier_pixel_projects_fallback',
      JSON.stringify(list.filter((p) => p.id !== projectId))
    );
  }
}

export function getSavedVaultCode(): string {
  return localStorage.getItem(VAULT_CODE_KEY) || '';
}

export function setSavedVaultCode(code: string): void {
  if (!code) {
    localStorage.removeItem(VAULT_CODE_KEY);
  } else {
    localStorage.setItem(VAULT_CODE_KEY, code.trim().toUpperCase());
  }
}
