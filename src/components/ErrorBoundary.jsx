/* eslint-disable react/prop-types */
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  componentDidCatch(error, info) {
    // Log to console and persist a short copy to localStorage for later inspection
    console.error('ErrorBoundary caught:', error, info);
    try {
      const payload = { error: (error && error.stack) ? error.stack : String(error), info };
      localStorage.setItem('vibesphere_last_error', JSON.stringify(payload));
    } catch (e) {
      // ignore
    }
    this.setState({ error, info });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24 }}>
          <h2 style={{ marginBottom: 8 }}>Something went wrong.</h2>
          <p style={{ color: '#6b7280' }}>An unexpected error occurred. The details have been saved to localStorage.</p>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>
            {this.state.error && (this.state.error.stack || String(this.state.error))}
          </details>
            <div style={{ marginTop: 12 }}>
            <button onClick={() => { try { localStorage.removeItem('vibesphere_last_error'); } catch(e) { /* ignore */ } window.location.reload(); }}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
