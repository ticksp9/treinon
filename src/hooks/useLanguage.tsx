import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { languages } from '@/lib/i18n';

export function useLanguage() {
  const { i18n } = useTranslation();
  const { user } = useAuth();

  useEffect(() => {
    const loadLanguagePreference = async () => {
      let languageToUse = 'pt';

      // If user is authenticated, fetch from profile
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('language')
          .eq('id', user.id)
          .single();

        if (profile?.language) {
          languageToUse = profile.language;
          // Also update localStorage
          localStorage.setItem('language', profile.language);
        }
      } else {
        // For non-authenticated users, use localStorage
        const storedLanguage = localStorage.getItem('language');
        if (storedLanguage) {
          languageToUse = storedLanguage;
        }
      }

      // Apply language
      if (languageToUse !== i18n.language) {
        await i18n.changeLanguage(languageToUse);
      }

      // Set RTL if needed
      const isRtl = languages.find(l => l.code === languageToUse)?.rtl;
      document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
      document.documentElement.lang = languageToUse;
    };

    loadLanguagePreference();
  }, [user, i18n]);

  return { currentLanguage: i18n.language };
}
