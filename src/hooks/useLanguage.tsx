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
      const stored = (() => { try { return localStorage.getItem('language'); } catch { return null; } })();
      let languageToUse = stored || (i18n.language || 'pt').slice(0, 2);

      // If user is authenticated, fetch from profile
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('language')
          .eq('id', user.id)
          .single();

        // 'pt' is the column's default, not a choice: on a new device the phone's language wins and is saved
        if (profile?.language && (stored || profile.language !== 'pt')) {
          languageToUse = profile.language;
          try { localStorage.setItem('language', profile.language); } catch { /* private mode */ }
        } else if (profile && profile.language !== languageToUse && (READY_LANGUAGES as readonly string[]).includes(languageToUse)) {
          await supabase.from('profiles').update({ language: languageToUse }).eq('id', user.id);
        }
      }
      // only the languages the app is translated into (someone who had German or Chinese gets English)
      if (!(READY_LANGUAGES as readonly string[]).includes(languageToUse)) languageToUse = 'en';

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
