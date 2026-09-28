import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { languages, LanguageCode } from '@/lib/i18n';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';

interface LanguageSelectorProps {
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'icon';
  showLabel?: boolean;
}

export function LanguageSelector({ 
  variant = 'outline', 
  size = 'default',
  showLabel = true 
}: LanguageSelectorProps) {
  const { i18n, t } = useTranslation();
  const { user } = useAuth();
  const [isChanging, setIsChanging] = useState(false);

  const currentLanguage = languages.find(l => l.code === i18n.language) || languages[0];

  const handleLanguageChange = async (code: LanguageCode) => {
    if (code === i18n.language) return;
    
    setIsChanging(true);
    
    try {
      // Change language immediately
      await i18n.changeLanguage(code);
      
      // Store in localStorage (for non-authenticated users)
      localStorage.setItem('language', code);
      
      // Update document direction for RTL languages
      const isRtl = languages.find(l => l.code === code)?.rtl;
      document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
      document.documentElement.lang = code;
      
      // If user is authenticated, save to profile
      if (user) {
        const { error } = await supabase
          .from('profiles')
          .update({ language: code })
          .eq('id', user.id);
        
        if (error) {
          console.error('Error saving language preference:', error);
        }
      }
      
      toast({
        title: t('settings.languageUpdated'),
      });
    } catch (error) {
      console.error('Error changing language:', error);
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size}
          disabled={isChanging}
          className="gap-2"
        >
          <Globe className="h-4 w-4" />
          {showLabel && (
            <span className="hidden sm:inline">
              {currentLanguage.flag} {currentLanguage.name}
            </span>
          )}
          {!showLabel && <span>{currentLanguage.flag}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code as LanguageCode)}
            className={`gap-3 cursor-pointer ${i18n.language === lang.code ? 'bg-accent' : ''}`}
          >
            <span className="text-lg">{lang.flag}</span>
            <span>{lang.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
