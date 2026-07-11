import { Component, type ErrorInfo, type ReactNode } from "react";

type LocalizedErrorBoundaryProps = {
  children: ReactNode;
  resetKey: string;
  fallback: (reset: () => void, error: Error) => ReactNode;
};

type LocalizedErrorBoundaryState = {
  error: Error | null;
};

export class LocalizedErrorBoundary extends Component<LocalizedErrorBoundaryProps, LocalizedErrorBoundaryState> {
  state: LocalizedErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): LocalizedErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Localized UI error", error, info.componentStack);
  }

  componentDidUpdate(previousProps: LocalizedErrorBoundaryProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) return this.props.fallback(this.reset, this.state.error);
    return this.props.children;
  }
}
