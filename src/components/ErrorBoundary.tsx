// Generic React error boundary used to isolate page sections/tabs.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw, ArrowLeft } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Label used in DEV console logs, e.g. "tab Posições". */
  label?: string;
  /** Show a "Voltar" button (history back). */
  showBack?: boolean;
  fallbackTitle?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error(
        `[PlayerDetail] erro em ${this.props.label ?? 'secção'}: ${error.message}`,
        error.stack,
        info.componentStack,
      );
    } else {
      console.error(`[ErrorBoundary] ${this.props.label ?? 'secção'}:`, error.message);
    }
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 mx-auto text-destructive" />
          <p className="font-medium">
            {this.props.fallbackTitle ?? 'Ocorreu um erro nesta secção'}
          </p>
          {(
            <p className="text-xs text-muted-foreground break-words max-w-xl mx-auto">
              {this.props.label ? `${this.props.label}: ` : ''}
              {error.message}
            </p>
          )}
          <div className="flex items-center justify-center gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={this.reset}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Tentar novamente
            </Button>
            {this.props.showBack && (
              <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
}

export default ErrorBoundary;
