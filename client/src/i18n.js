import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCN from './locales/zh-CN.json';
import zhTW from './locales/zh-TW.json';
import en from './locales/en.json';
import ja from './locales/ja.json';
import nl from './locales/nl.json';

export const SUPPORTED_LANGUAGES = [
  { value: 'zh-CN', label: '简体中文', dayjsLocale: 'zh-cn', antdLocale: 'zhCN' },
  { value: 'zh-TW', label: '繁體中文', dayjsLocale: 'zh-tw', antdLocale: 'zhTW' },
  { value: 'en',    label: 'English',  dayjsLocale: 'en',    antdLocale: 'enUS' },
  { value: 'ja',    label: '日本語',   dayjsLocale: 'ja',    antdLocale: 'jaJP' },
  { value: 'nl',    label: 'Nederlands', dayjsLocale: 'nl',  antdLocale: 'nlNL' },
];

const SUPPORTED_LANG_CODES = SUPPORTED_LANGUAGES.map((l) => l.value);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      'zh-TW': { translation: zhTW },
      en:      { translation: en },
      ja:      { translation: ja },
      nl:      { translation: nl },
    },
    fallbackLng: 'zh-CN',
    supportedLngs: SUPPORTED_LANG_CODES,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'lang',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
