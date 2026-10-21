import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { tx } from '@/lib/i18n/ui';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? tx('Mudar para tema claro') : tx('Mudar para tema escuro')}
      title={dark ? tx('Tema claro (melhor ao sol)') : tx('Tema escuro (jogos à noite)')}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
