import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
}

export function PageHeader({ title, description, icon, actions, badge }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        {icon && (
          <div className="hidden sm:flex w-12 h-12 rounded-xl bg-primary/10 items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display font-bold tracking-tight">{title}</h1>
            {badge}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
