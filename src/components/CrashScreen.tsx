import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Top-level error boundary. Without it a render-time throw unmounts the whole
 * tree and leaves an empty iframe on itch.io with no way back but a hard
 * refresh the player may not think of.
 */
export default class CrashScreen extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[crash]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-zinc-950 text-white font-mono p-6 text-center">
        <div className="text-lg font-bold">Something went wrong.</div>
        <div className="text-xs text-white/60 max-w-md break-words">{this.state.error.message}</div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 border border-white/40 rounded hover:border-white text-sm"
        >
          Reload
        </button>
      </div>
    );
  }
}
