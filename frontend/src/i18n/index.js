import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './en.json';

// ─────────────────────────────────────────────────────────────────────────────
// i18next setup (the standard React i18n stack: i18next + react-i18next).
//
// All user-facing strings live in the per-locale JSON resource files (en.json
// today), keyed with dot-paths and `{{var}}` interpolation. Components read them
// with `const { t } = useTranslation()`; non-component modules import this
// default instance and call `i18n.t(...)`.
//
// Add a language: import its JSON, add it to `resources`, list it in
// `supportedLngs`. The detector persists the choice to localStorage.
// ─────────────────────────────────────────────────────────────────────────────

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    fallbackLng: 'en',
    supportedLngs: ['en'],
    interpolation: {
      escapeValue: false, // React already escapes against XSS
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'glim.locale',
      caches: ['localStorage'],
    },
  });

export default i18n;
