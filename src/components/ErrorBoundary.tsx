"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-plex-gray border border-white/10 rounded-2xl p-6 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-xl font-medium text-foreground mb-2">
              Something went wrong
            </h2>
            <p className="text-foreground/60 text-sm mb-6">
              An unexpected error occurred. This has been logged for debugging.
            </p>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="bg-black/30 rounded-xl p-4 mb-6 text-left overflow-auto max-h-40">
                <p className="text-red-400 text-xs font-mono break-all">
                  {this.state.error.message}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-foreground/40 text-xs mt-2 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.slice(0, 500)}
                  </pre>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-foreground/60 hover:text-foreground hover:border-white/20 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 px-4 py-2.5 rounded-xl bg-plex-orange text-black font-medium hover:bg-amber-500 transition-colors"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
