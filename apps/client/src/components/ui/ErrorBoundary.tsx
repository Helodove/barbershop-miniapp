import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-bg">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-white font-display text-xl mb-2">Что-то пошло не так</h2>
          <p className="text-white/50 text-sm mb-6">{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-gold text-black font-semibold py-3 px-6 rounded-xl"
          >
            Обновить
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
