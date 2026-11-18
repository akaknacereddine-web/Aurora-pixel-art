import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CloudSyncModal } from './components/CloudSyncModal';
import { EditorWorkspace } from './components/EditorWorkspace';
import { HomeStudio } from './components/HomeStudio';
import {
  createBlankProject,
  loadSavedCustomPalettes,
  saveCustomPalettes,
  uid,
} from './engine/presets';
import {
  applyWebsiteThemeToRoot,
  loadWebsiteThemeConfig,
  resolveWebsiteThemeTokens,
  saveWebsiteThemeConfig,
  type WebsiteThemeConfig,
} from './engine/themes';
import type { PalettePreset, Project, ProjectType } from './engine/types';
import { auth } from './firebase';
import {
  deleteProjectFromVault,
  pushProjectToVault,
  syncVaultProjects,
} from './services/cloudSync';
import { triggerDownload } from './services/exporter';
import {
  deleteProjectFromFirestore,
  ensureUserProfile,
  saveProjectToFirestore,
  signInWithGoogle,
  signOutFromCloud,
  subscribeUserProjects,
} from './services/firebaseSync';
import {
  deleteProjectLocal,
  getSavedVaultCode,
  loadAllProjects,
  saveProjectLocal,
  saveProjectsBulk,
  setSavedVaultCode,
} from './services/storage';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  // Firebase Auth & Real-Time Firestore Sync State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [firebaseSyncedAt, setFirebaseSyncedAt] = useState<number | null>(null);
  const projectsRef = useRef<Project[]>([]);
  projectsRef.current = projects;

  // Custom Saved Color Palettes
  const [customPalettes, setCustomPalettes] = useState<PalettePreset[]>(() =>
    loadSavedCustomPalettes()
  );

  // Whole-Website UI Color Theme
  const [themeConfig, setThemeConfig] = useState<WebsiteThemeConfig>(() =>
    loadWebsiteThemeConfig()
  );

  useEffect(() => {
    applyWebsiteThemeToRoot(resolveWebsiteThemeTokens(themeConfig));
    saveWebsiteThemeConfig(themeConfig);
  }, [themeConfig]);

  // Optional Portable Vault Code State
  const [vaultCode, setVaultCode] = useState<string>(() => getSavedVaultCode());
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncError, setSyncError] = useState('');

  if (fatalError) {
    throw fatalError;
  }

  // Load local IndexedDB library on boot
  useEffect(() => {
    let mounted = true;
    (async () => {
      const loaded = await loadAllProjects();
      if (!mounted) return;
      setProjects(loaded);
      setLoading(false);

      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1' && loaded.length > 0) {
        setActiveProjectId(loaded[0].id);
      }

      const savedCode = getSavedVaultCode();
      if (savedCode) {
        try {
          const synced = await syncVaultProjects(savedCode, loaded);
          if (!mounted) return;
          setProjects(synced.projects);
          await saveProjectsBulk(synced.projects);
          setLastSyncAt(synced.updatedAt);
        } catch {
          // Offline or vault unreachable: keep local copy
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Listen to Firebase Auth state & subscribe to real-time Firestore projects
  useEffect(() => {
    let unsubscribeProjects: (() => void) | null = null;
    let initialMergeDone = false;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeProjects) {
        unsubscribeProjects();
        unsubscribeProjects = null;
      }
      initialMergeDone = false;
      setFirebaseUser(user);

      if (!user) return;

      try {
        await ensureUserProfile(user);
      } catch (err) {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
        return;
      }

      unsubscribeProjects = subscribeUserProjects(
        user.uid,
        async (cloudList) => {
          setFirebaseSyncedAt(Date.now());
          const cloudMap = new Map(cloudList.map((p) => [p.id, p]));

          // On first cloud snapshot after sign-in, push any local projects missing from Firestore
          if (!initialMergeDone) {
            initialMergeDone = true;
            const localMissing = projectsRef.current.filter((lp) => !cloudMap.has(lp.id));
            if (localMissing.length > 0) {
              for (const lp of localMissing) {
                try {
                  await saveProjectToFirestore(user.uid, lp);
                  cloudMap.set(lp.id, lp);
                } catch {
                  // Keep local if oversized or offline
                }
              }
            }
          }

          // Merge local unsaved newer items with cloud items
          const mergedMap = new Map<string, Project>();
          for (const lp of projectsRef.current) {
            mergedMap.set(lp.id, lp);
          }
          for (const cp of cloudList) {
            const existing = mergedMap.get(cp.id);
            if (!existing || cp.updatedAt >= existing.updatedAt) {
              mergedMap.set(cp.id, cp);
            }
          }
          const merged = Array.from(mergedMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
          setProjects(merged);
          await saveProjectsBulk(merged);
        },
        (err) => {
          setFatalError(err);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProjects) unsubscribeProjects();
    };
  }, []);

  const handleSaveProject = useCallback(
    async (proj: Project) => {
      await saveProjectLocal(proj);
      setProjects((prev) => {
        const exists = prev.some((p) => p.id === proj.id);
        const next = exists
          ? prev.map((p) => (p.id === proj.id ? proj : p))
          : [proj, ...prev];
        return next.sort((a, b) => b.updatedAt - a.updatedAt);
      });

      if (firebaseUser) {
        try {
          await saveProjectToFirestore(firebaseUser.uid, proj);
          setFirebaseSyncedAt(Date.now());
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('Missing or insufficient permissions') || msg.includes('operationType')) {
            setFatalError(err instanceof Error ? err : new Error(msg));
          }
        }
      }

      if (vaultCode) {
        try {
          await pushProjectToVault(vaultCode, proj);
          setLastSyncAt(Date.now());
        } catch {
          // Local save already succeeded
        }
      }
    },
    [firebaseUser, vaultCode]
  );

  const handleCreateProject = async (
    name: string,
    type: ProjectType,
    width: number,
    height: number,
    initialPalette?: string[]
  ) => {
    const created = createBlankProject(name, type, width, height, initialPalette);
    await handleSaveProject(created);
    setActiveProjectId(created.id);
  };

  const handleSaveCustomPalette = useCallback((name: string, colors: string[]) => {
    const cleanName = name.trim() || 'Custom Palette';
    const cleanColors = colors.slice(0, 64).map((c) => c.toUpperCase());
    if (cleanColors.length === 0) return;
    setCustomPalettes((prev) => {
      const existing = prev.find((p) => p.name.toLowerCase() === cleanName.toLowerCase());
      const next = existing
        ? prev.map((p) => (p.id === existing.id ? { ...p, name: cleanName, colors: cleanColors } : p))
        : [{ id: uid('pal'), name: cleanName, colors: cleanColors, isBuiltIn: false }, ...prev];
      saveCustomPalettes(next);
      return next;
    });
  }, []);

  const handleDeleteCustomPalette = useCallback((paletteId: string) => {
    setCustomPalettes((prev) => {
      const next = prev.filter((p) => p.id !== paletteId);
      saveCustomPalettes(next);
      return next;
    });
  }, []);

  const handleDuplicateProject = async (projectId: string) => {
    const src = projects.find((p) => p.id === projectId);
    if (!src) return;
    const now = Date.now();
    const copy: Project = {
      ...src,
      id: uid('proj'),
      name: `${src.name} Copy`,
      createdAt: now,
      updatedAt: now,
      frames: src.frames.map((f) => ({
        ...f,
        id: uid('frame'),
        layers: f.layers.map((l) => ({ ...l, id: uid('layer') })),
      })),
    };
    await handleSaveProject(copy);
  };

  const handleDeleteProject = async (projectId: string) => {
    await deleteProjectLocal(projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (activeProjectId === projectId) setActiveProjectId(null);

    if (firebaseUser) {
      deleteProjectFromFirestore(firebaseUser.uid, projectId).catch((err) => {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      });
    }
    if (vaultCode) {
      deleteProjectFromVault(vaultCode, projectId).catch(() => {});
    }
  };

  const handleGoogleSignIn = async () => {
    setSyncing(true);
    setSyncError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      if (!msg.includes('popup-closed-by-user')) {
        setSyncError(msg);
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleGoogleSignOut = async () => {
    setSyncing(true);
    setSyncError('');
    try {
      await signOutFromCloud();
      setFirebaseSyncedAt(null);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sign out failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handlePushAllToFirestore = async () => {
    if (!firebaseUser) return;
    setSyncing(true);
    setSyncError('');
    try {
      for (const proj of projects) {
        await saveProjectToFirestore(firebaseUser.uid, proj);
      }
      setFirebaseSyncedAt(Date.now());
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Cloud sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectAndSync = async (code: string) => {
    setSyncing(true);
    setSyncError('');
    try {
      const result = await syncVaultProjects(code, projects);
      setSavedVaultCode(result.code);
      setVaultCode(result.code);
      setProjects(result.projects);
      await saveProjectsBulk(result.projects);
      setLastSyncAt(result.updatedAt);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Cloud sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnectVault = () => {
    setSavedVaultCode('');
    setVaultCode('');
    setLastSyncAt(null);
    setSyncError('');
  };

  const handleExportBundle = () => {
    const blob = new Blob([JSON.stringify({ version: 1, projects }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `aurora-pixel-art-workspace-${new Date().toISOString().slice(0, 10)}.json`);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleImportProjectFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported: Project[] = Array.isArray(parsed?.projects)
        ? parsed.projects
        : parsed?.id && parsed?.frames
        ? [parsed]
        : [];
      if (imported.length === 0) return;
      for (const p of imported) {
        const cloned: Project = { ...p, id: uid('proj'), updatedAt: Date.now() };
        await handleSaveProject(cloned);
      }
    } catch {
      // Ignore malformed JSON imports gracefully
    }
  };

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;
  const cloudConnected = Boolean(firebaseUser || vaultCode);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--ui-bg-app)] text-[var(--ui-text-muted)] flex items-center justify-center text-sm">
        Loading Aurora Pixel Art studio...
      </div>
    );
  }

  return (
    <>
      {activeProject ? (
        <EditorWorkspace
          key={activeProject.id}
          initialProject={activeProject}
          cloudConnected={cloudConnected}
          cloudLabel={firebaseUser ? firebaseUser.displayName || 'Synced' : vaultCode ? 'Vault' : 'Cloud'}
          customPalettes={customPalettes}
          themeConfig={themeConfig}
          onChangeTheme={setThemeConfig}
          onSaveCustomPalette={handleSaveCustomPalette}
          onDeleteCustomPalette={handleDeleteCustomPalette}
          onSaveProject={handleSaveProject}
          onOpenCloudModal={() => setShowCloudModal(true)}
          onBackHome={(latest) => {
            setProjects((prev) =>
              prev.map((p) => (p.id === latest.id ? latest : p)).sort((a, b) => b.updatedAt - a.updatedAt)
            );
            setActiveProjectId(null);
          }}
        />
      ) : (
        <HomeStudio
          projects={projects}
          customPalettes={customPalettes}
          themeConfig={themeConfig}
          onChangeTheme={setThemeConfig}
          firebaseUser={firebaseUser}
          vaultCode={vaultCode}
          onCreateProject={handleCreateProject}
          onOpenProject={(id) => setActiveProjectId(id)}
          onDuplicateProject={handleDuplicateProject}
          onDeleteProject={handleDeleteProject}
          onOpenCloudModal={() => setShowCloudModal(true)}
          onImportProjectFile={handleImportProjectFile}
        />
      )}

      <CloudSyncModal
        isOpen={showCloudModal}
        firebaseUser={firebaseUser}
        firebaseSyncedAt={firebaseSyncedAt}
        vaultCode={vaultCode}
        lastSyncAt={lastSyncAt}
        syncing={syncing}
        syncError={syncError}
        projects={projects}
        onClose={() => setShowCloudModal(false)}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
        onSyncFirestoreNow={handlePushAllToFirestore}
        onConnectAndSync={handleConnectAndSync}
        onDisconnect={handleDisconnectVault}
        onExportBundle={handleExportBundle}
      />
    </>
  );
}
