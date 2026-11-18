import type { Project } from '../engine/types';

export interface VaultSyncResult {
  code: string;
  updatedAt: number;
  projects: Project[];
}

export function generateVaultCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `APX-${seg(4)}-${seg(4)}`;
}

export async function fetchVaultProjects(code: string): Promise<VaultSyncResult> {
  const res = await fetch(`/api/vault/${encodeURIComponent(code)}/projects`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load cloud vault (${res.status})`);
  }
  return res.json();
}

export async function pushProjectToVault(code: string, project: Project): Promise<void> {
  const res = await fetch(`/api/vault/${encodeURIComponent(code)}/projects/${encodeURIComponent(project.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Cloud sync push failed (${res.status})`);
  }
}

export async function syncVaultProjects(code: string, localProjects: Project[]): Promise<VaultSyncResult> {
  const res = await fetch(`/api/vault/${encodeURIComponent(code)}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projects: localProjects }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Cloud vault sync failed (${res.status})`);
  }
  return res.json();
}

export async function deleteProjectFromVault(code: string, projectId: string): Promise<void> {
  const res = await fetch(`/api/vault/${encodeURIComponent(code)}/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete from cloud vault (${res.status})`);
  }
}
