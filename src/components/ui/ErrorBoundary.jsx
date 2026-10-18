import React from 'react';

/**
 * Catches render errors below it so one broken part (the map, say) does not blank the whole app.
 * Errors are logged; wire a reporting service in `componentDidCatch` when you add one.
 *
 * @extends {React.Component<{ children: React.ReactNode, fallback: (reset: () => void) => React.ReactNode }, { failed: boolean }>}
 */
export class ErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info.componentStack);
  }

  reset = () => this.setState({ failed: false });

  render() {
    return this.state.failed ? this.props.fallback(this.reset) : this.props.children;
  }
}
