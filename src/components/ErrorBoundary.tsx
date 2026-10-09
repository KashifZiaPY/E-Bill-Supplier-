import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, ArrowLeft } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App Uncaught Error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCache = () => {
    try {
      localStorage.removeItem('anwar_traders_clients_v2');
      localStorage.removeItem('anwar_traders_docs_v2');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-navy-950 text-white flex items-center justify-center p-4">
          <div className="bg-white text-ink-900 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-line">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-12 h-12 rounded-xl bg-gold-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-gold-700" />
              </span>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight">Something went wrong</h1>
                <p className="text-xs text-ink-400">An unexpected error occurred</p>
              </div>
            </div>

            <div className="p-3.5 bg-paper border border-line rounded-xl text-xs text-[#96291f] font-mono mb-6 overflow-x-auto max-h-36">
              {this.state.error?.message || 'Unknown render error'}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={this.handleReset}
                className="corp-btn-primary flex-1 text-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Home</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="corp-btn-ghost flex-1 text-xs"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearCache}
                className="py-2.5 px-3 bg-red-50 hover:bg-red-100 text-[#b3372f] border border-red-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                title="Clear local cached data & restart"
              >
                <Trash2 className="w-4 h-4" />
                <span>Reset Cache</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
