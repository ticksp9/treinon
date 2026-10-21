import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { languages, READY_LANGUAGES } from '@/lib/i18n';

export function useLanguage() {
  const { i18n } = useTranslation();
  const { user } = useAuth();

  useEffect(() => {
    const loadLanguagePreference = async () => {
      // what was chosen on this device; the account's choice wins when there is one
      let languageToUse = (() => { try { return localStorage.getItem('language') || 'pt'; } catch { return 'pt'; } })();

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
      }
      // only the languages the app is translated into
      if (!(READY_LANGUAGES as readonly string[]).includes(languageToUse)) languageToUse = 'pt';

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
