import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          height: '100vh',
          background: '#1e1e1e',
          color: '#ccc',
          padding: 32,
          fontFamily: 'Segoe UI, sans-serif',
          overflow: 'auto',
        }}>
          <h1 style={{ color: '#f48771', marginBottom: 12 }}>Xander AI IDE failed to start</h1>
          <p style={{ marginBottom: 16 }}>{this.state.error.message}</p>
          <pre style={{
            background: '#252526',
            padding: 16,
            borderRadius: 8,
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {this.state.error.stack}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20,
              padding: '8px 16px',
              background: '#0e639c',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
