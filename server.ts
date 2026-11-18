import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const VAULT_DIR = path.resolve(__dirname, '.cloud-sync');

function ensureVaultDir() {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }
}

function sanitizeVaultCode(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (cleaned.length < 4 || cleaned.length > 40) return null;
  return cleaned;
}

function getVaultFile(code: string): string {
  return path.join(VAULT_DIR, `${code}.json`);
}

interface StoredProject {
  id: string;
  updatedAt: number;
  [key: string]: unknown;
}

interface VaultData {
  code: string;
  updatedAt: number;
  projects: StoredProject[];
}

function readVault(code: string): VaultData {
  ensureVaultDir();
  const file = getVaultFile(code);
  if (!fs.existsSync(file)) {
    return { code, updatedAt: Date.now(), projects: [] };
  }
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw) as VaultData;
    return {
      code,
      updatedAt: parsed.updatedAt || Date.now(),
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    };
  } catch {
    return { code, updatedAt: Date.now(), projects: [] };
  }
}

function writeVault(code: string, data: VaultData): void {
  ensureVaultDir();
  const file = getVaultFile(code);
  const tmpFile = `${file}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data), 'utf-8');
  fs.renameSync(tmpFile, file);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Get all synced projects in a vault
  app.get('/api/vault/:code/projects', (req, res) => {
    const code = sanitizeVaultCode(req.params.code);
    if (!code) {
      res.status(400).json({ error: 'Invalid vault code. Use 4-40 alphanumeric characters.' });
      return;
    }
    const vault = readVault(code);
    res.json(vault);
  });

  // Upsert a single project into a vault
  app.put('/api/vault/:code/projects/:projectId', (req, res) => {
    const code = sanitizeVaultCode(req.params.code);
    if (!code) {
      res.status(400).json({ error: 'Invalid vault code.' });
      return;
    }
    const project = req.body as StoredProject;
    if (!project || typeof project !== 'object' || typeof project.id !== 'string') {
      res.status(400).json({ error: 'Invalid project payload.' });
      return;
    }
    const vault = readVault(code);
    const idx = vault.projects.findIndex((p) => p.id === req.params.projectId);
    const incomingUpdatedAt = typeof project.updatedAt === 'number' ? project.updatedAt : Date.now();
    const record: StoredProject = { ...project, id: req.params.projectId, updatedAt: incomingUpdatedAt };

    if (idx >= 0) {
      vault.projects[idx] = record;
    } else {
      vault.projects.unshift(record);
    }
    vault.updatedAt = Date.now();
    writeVault(code, vault);
    res.json({ ok: true, updatedAt: vault.updatedAt, projectCount: vault.projects.length });
  });

  // Bulk merge/sync local projects with cloud vault
  app.post('/api/vault/:code/sync', (req, res) => {
    const code = sanitizeVaultCode(req.params.code);
    if (!code) {
      res.status(400).json({ error: 'Invalid vault code.' });
      return;
    }
    const incoming = Array.isArray(req.body?.projects) ? (req.body.projects as StoredProject[]) : [];
    const vault = readVault(code);
    const byId = new Map<string, StoredProject>();

    for (const p of vault.projects) {
      if (p && typeof p.id === 'string') byId.set(p.id, p);
    }
    for (const p of incoming) {
      if (!p || typeof p.id !== 'string') continue;
      const existing = byId.get(p.id);
      if (!existing || (p.updatedAt || 0) >= (existing.updatedAt || 0)) {
        byId.set(p.id, p);
      }
    }

    const merged = Array.from(byId.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const nextVault: VaultData = {
      code,
      updatedAt: Date.now(),
      projects: merged,
    };
    writeVault(code, nextVault);
    res.json(nextVault);
  });

  // Delete a project from a vault
  app.delete('/api/vault/:code/projects/:projectId', (req, res) => {
    const code = sanitizeVaultCode(req.params.code);
    if (!code) {
      res.status(400).json({ error: 'Invalid vault code.' });
      return;
    }
    const vault = readVault(code);
    vault.projects = vault.projects.filter((p) => p.id !== req.params.projectId);
    vault.updatedAt = Date.now();
    writeVault(code, vault);
    res.json({ ok: true, updatedAt: vault.updatedAt });
  });

  const httpServer = http.createServer(app);

  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(__dirname, 'dist'));
  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Atelier Pixel server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
