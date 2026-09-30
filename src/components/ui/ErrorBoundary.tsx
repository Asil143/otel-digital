import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Otel Digital crashed', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-crash">
          <h1>Something went wrong</h1>
          <p>The workspace hit an unexpected error. Reloading usually fixes it.</p>
          <button type="button" className="primary-button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
