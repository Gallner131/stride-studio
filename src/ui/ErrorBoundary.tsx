import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Error boundary — §13 Phase 7.
 *
 * A render crash used to take the whole page to white, losing the design with it. This
 * catches it, keeps the autosaved work reachable, and offers the two things that actually
 * help: reload, or copy the diagnostics so the fault can be reported.
 *
 * The diagnostics are deliberately copy-to-clipboard rather than auto-sent: §2.5 says
 * nothing leaves the device, and that has to hold even when something has gone wrong.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Left in the console on purpose: it is the only record, since nothing is reported home.
    console.error("Stride Studio crashed", error, info.componentStack);
  }

  private diagnostics(): string {
    const { error } = this.state;
    return [
      `Stride Studio ${new Date().toISOString()}`,
      navigator.userAgent,
      `Screen ${window.innerWidth}x${window.innerHeight}`,
      "",
      error?.name ?? "Error",
      error?.message ?? "",
      error?.stack ?? "",
    ].join("\n");
  }

  override render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="crash" role="alert">
        <h2>Something broke</h2>
        <p className="small">
          Your designs are saved on this device, so reloading should not cost you any work.
        </p>
        <pre className="crash-message">{error.message}</pre>
        <div className="btnrow">
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              navigator.clipboard?.writeText(this.diagnostics()).catch(() => {});
            }}
          >
            Copy diagnostics
          </button>
        </div>
        <p className="muted small">
          Nothing is sent anywhere. Copy the diagnostics and paste them into a message if you want this fixed.
        </p>
      </div>
    );
  }
}
