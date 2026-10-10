import { Component } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[color:var(--color-destructive)]/10 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-[color:var(--color-destructive)]" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. Try refreshing the page.
            </p>
            {this.state.error?.message && (
              <pre className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 text-left overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <Button onClick={() => window.location.reload()} className="mx-auto">
              <RefreshCw className="w-4 h-4" /> Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
