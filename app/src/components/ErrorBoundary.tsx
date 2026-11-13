import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** What to show in place of the content that broke. `reset` tries to render the content again. */
  fallback: (reset: () => void) => ReactNode;
}

/** Contains a rendering failure: only this part of the screen is replaced, the rest of the app keeps working. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    return this.state.failed ? this.props.fallback(() => this.setState({ failed: false })) : this.props.children;
  }
}
