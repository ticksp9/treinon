import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Inbox, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PageLoadingProps {
  message?: string;
}

export function PageLoading({ message = 'A carregar...' }: PageLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function PageLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}

interface PageErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function PageError({ message = 'Ocorreu um erro ao carregar os dados.', onRetry }: PageErrorProps) {
  return (
    <Card className="border-destructive/20">
      <CardContent className="py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-destructive" />
        </div>
        <h3 className="text-lg font-display font-semibold mb-2">Erro</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">{message}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry} size="sm">
            Tentar novamente
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
}

export function EmptyState({ icon, title, description, action, children }: EmptyStateProps) {
  return (
    <Card className="border-dashed border-2 border-border/60">
      <CardContent className="py-16 text-center">
        {icon ? (
          <div className="mb-4">{icon}</div>
        ) : (
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-7 h-7 text-muted-foreground" />
          </div>
        )}
        <h3 className="text-lg font-display font-semibold mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">{description}</p>
        )}
        {action && (
          <Button onClick={action.onClick} size="sm">{action.label}</Button>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

interface AccessDeniedProps {
  title?: string;
  message?: string;
  icon?: ReactNode;
}

export function AccessDenied({
  title = 'Acesso Restrito',
  message = 'Não tem permissões para aceder a esta funcionalidade.',
  icon
}: AccessDeniedProps) {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        {icon ? (
          <div className="mb-4">{icon}</div>
        ) : (
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7 text-muted-foreground" />
          </div>
        )}
        <h3 className="text-lg font-display font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">{message}</p>
      </CardContent>
    </Card>
  );
}
