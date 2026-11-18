import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        readable = `${parsed.operationType ? `[${parsed.operationType}] ` : ''}${parsed.error}`;
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Aurora Pixel Art ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--ui-bg-app)] text-[var(--ui-text-primary)] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[var(--ui-bg-panel)] border border-[var(--ui-border-strong)] rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--ui-bg-hover)] border border-[var(--ui-border-strong)] flex items-center justify-center text-[var(--ui-accent)]">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-[var(--ui-text-primary)]">
                  Aurora Pixel Art Recovery
                </h1>
                <p className="text-xs text-[var(--ui-text-muted)]">
                  Something interrupted this studio session.
                </p>
              </div>
            </div>
            <p className="text-xs text-[var(--ui-text-secondary)] bg-[var(--ui-bg-app)] border border-[var(--ui-border)] rounded-lg p-3 font-mono break-words">
              {this.state.message}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, message: '' })}
                className="px-3.5 py-2 rounded-lg bg-[var(--ui-bg-hover)] hover:bg-[var(--ui-bg-hover-strong)] text-xs text-[var(--ui-text-primary)] cursor-pointer"
              >
                Continue Offline
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--ui-accent)] hover:bg-[var(--ui-accent-hover)] text-xs font-semibold text-[var(--ui-accent-contrast)] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reload Studio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
