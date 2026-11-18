import type { User } from 'firebase/auth';
import { Check, Cloud, Copy, Download, LogIn, LogOut, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import type { Project } from '../engine/types';
import { generateVaultCode } from '../services/cloudSync';

interface CloudSyncModalProps {
  isOpen: boolean;
  firebaseUser: User | null;
  firebaseSyncedAt: number | null;
  vaultCode: string;
  lastSyncAt: number | null;
  syncing: boolean;
  syncError: string;
  projects: Project[];
  onClose: () => void;
  onGoogleSignIn: () => Promise<void>;
  onGoogleSignOut: () => Promise<void>;
  onSyncFirestoreNow: () => Promise<void>;
  onConnectAndSync: (code: string) => Promise<void>;
  onDisconnect: () => void;
  onExportBundle: () => void;
}

export function CloudSyncModal({
  isOpen,
  firebaseUser,
  firebaseSyncedAt,
  vaultCode,
  lastSyncAt,
  syncing,
  syncError,
  projects,
  onClose,
  onGoogleSignIn,
  onGoogleSignOut,
  onSyncFirestoreNow,
  onConnectAndSync,
  onDisconnect,
  onExportBundle,
}: CloudSyncModalProps) {
  const [inputCode, setInputCode] = useState(vaultCode || '');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!vaultCode) return;
    navigator.clipboard.writeText(vaultCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleCreateNew = async () => {
    const fresh = generateVaultCode();
    setInputCode(fresh);
    await onConnectAndSync(fresh);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = inputCode.trim().toUpperCase();
    if (!cleaned) return;
    await onConnectAndSync(cleaned);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cloud-sync-title"
    >
      <div className="w-full max-w-lg bg-[var(--ui-bg-panel)] border border-[var(--ui-border-strong)] rounded-xl overflow-hidden shadow-2xl text-[var(--ui-text-primary)]">
        <div className="px-5 py-4 border-b border-[var(--ui-border)] flex items-center justify-between bg-[var(--ui-bg-bar)]">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-4 h-4 text-[var(--ui-accent)]" />
            <h2 id="cloud-sync-title" className="text-sm font-semibold text-[var(--ui-text-primary)]">
              Aurora Cloud Sync
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)] cursor-pointer"
            aria-label="Close Cloud Sync dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Primary Firebase Cloud Sync via Google Account */}
          <div className="p-4 rounded-xl bg-[var(--ui-bg-app)] border border-[var(--ui-border-strong)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[var(--ui-accent)]" />
                <span className="text-xs font-semibold text-[var(--ui-text-primary)]">
                  Firebase Cloud Account
                </span>
              </div>
              {firebaseUser && (
                <span className="text-[11px] font-mono text-[var(--ui-accent)]">
                  {firebaseSyncedAt
                    ? `Live · ${new Date(firebaseSyncedAt).toLocaleTimeString()}`
                    : 'Connected'}
                </span>
              )}
            </div>

            {firebaseUser ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 bg-[var(--ui-bg-panel)] border border-[var(--ui-border)] rounded-lg px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[var(--ui-text-primary)] truncate">
                      {firebaseUser.displayName || 'Aurora Creator'}
                    </div>
                    <div className="text-[11px] text-[var(--ui-text-muted)] truncate">
                      {firebaseUser.email}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-[var(--ui-accent-secondary)] shrink-0 tabular-nums">
                    {projects.length} works
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={syncing}
                    onClick={onGoogleSignOut}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--ui-bg-hover)] hover:bg-[var(--ui-bg-hover-strong)] text-xs text-[var(--ui-text-secondary)] cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                  <button
                    type="button"
                    disabled={syncing}
                    onClick={onSyncFirestoreNow}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--ui-accent)] hover:bg-[var(--ui-accent-hover)] disabled:opacity-50 text-xs font-semibold text-[var(--ui-accent-contrast)] cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Sync All Now'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[var(--ui-text-muted)] leading-relaxed">
                  Sign in with Google to sync your pixel canvases, animations, layers, and custom
                  brushes in real time across every device using Cloud Firestore.
                </p>
                <button
                  type="button"
                  disabled={syncing}
                  onClick={onGoogleSignIn}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--ui-accent)] hover:bg-[var(--ui-accent-hover)] disabled:opacity-50 text-xs font-semibold text-[var(--ui-accent-contrast)] transition-colors cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  {syncing ? 'Connecting Google Account...' : 'Sign in with Google for Cloud Sync'}
                </button>
              </div>
            )}
          </div>

          {/* Secondary Portable Vault Code Option */}
          <div className="pt-1 space-y-3">
            <div className="text-xs font-medium text-[var(--ui-text-secondary)]">
              Portable Vault Code (Cross-Browser Quick Link)
            </div>
            {vaultCode ? (
              <div className="p-3.5 rounded-lg bg-[var(--ui-bg-app)] border border-[var(--ui-border)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--ui-text-muted)]">Connected Vault Code</span>
                  <span className="text-xs font-mono text-[var(--ui-accent)]">
                    {lastSyncAt ? `Synced ${new Date(lastSyncAt).toLocaleTimeString()}` : 'Active'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono text-sm font-semibold text-[var(--ui-text-primary)] tracking-wider">
                    {vaultCode}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--ui-bg-hover)] hover:bg-[var(--ui-bg-hover-strong)] text-xs text-[var(--ui-text-primary)] cursor-pointer"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-[var(--ui-accent)]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copied ? 'Copied' : 'Copy Code'}
                  </button>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--ui-border)]">
                  <button
                    type="button"
                    onClick={onDisconnect}
                    className="px-3 py-1.5 rounded-md text-xs text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)] cursor-pointer"
                  >
                    Disconnect
                  </button>
                  <button
                    type="button"
                    disabled={syncing}
                    onClick={() => onConnectAndSync(vaultCode)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--ui-accent)] hover:bg-[var(--ui-accent-hover)] disabled:opacity-50 text-xs font-semibold text-[var(--ui-accent-contrast)] cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    Sync Vault
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-2.5">
                <div className="flex gap-2">
                  <input
                    id="vault-code-input"
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="Enter Vault Code (e.g. APX-7K9M-24Q8)"
                    className="flex-1 px-3 py-2 rounded-lg bg-[var(--ui-bg-app)] border border-[var(--ui-border-strong)] font-mono text-xs text-[var(--ui-text-primary)] placeholder-[var(--ui-text-faint)] focus:outline-none focus:border-[var(--ui-accent)]"
                  />
                  <button
                    type="submit"
                    disabled={syncing || inputCode.trim().length < 4}
                    className="px-3.5 py-2 rounded-lg bg-[var(--ui-bg-hover)] hover:bg-[var(--ui-bg-hover-strong)] disabled:opacity-50 text-xs font-medium text-[var(--ui-text-primary)] border border-[var(--ui-border-strong)] cursor-pointer"
                  >
                    Link Code
                  </button>
                </div>
                <button
                  type="button"
                  disabled={syncing}
                  onClick={handleCreateNew}
                  className="text-[11px] text-[var(--ui-accent)] hover:underline cursor-pointer"
                >
                  + Generate a new Vault Code
                </button>
              </form>
            )}
          </div>

          {syncError && (
            <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/40 text-xs text-red-400">
              {syncError}
            </div>
          )}

          <div className="pt-3 border-t border-[var(--ui-border)] flex items-center justify-between">
            <span className="text-xs text-[var(--ui-text-muted)]">Offline portable backup (.json)</span>
            <button
              type="button"
              onClick={onExportBundle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--ui-bg-hover)] hover:bg-[var(--ui-bg-hover-strong)] text-xs text-[var(--ui-text-primary)] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Workspace Backup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
