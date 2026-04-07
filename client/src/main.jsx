import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import zhTW from 'antd/locale/zh_TW';
import enUS from 'antd/locale/en_US';
import jaJP from 'antd/locale/ja_JP';
import nlNL from 'antd/locale/nl_NL';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/zh-tw';
import 'dayjs/locale/en';
import 'dayjs/locale/ja';
import 'dayjs/locale/nl';
import './i18n';
import i18n from './i18n';
import App from './App';
import './index.css';

dayjs.extend(utc);
dayjs.extend(timezone);

const ANTD_LOCALES = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'en':    enUS,
  'ja':    jaJP,
  'nl':    nlNL,
};

const DAYJS_LOCALES = {
  'zh-CN': 'zh-cn',
  'zh-TW': 'zh-tw',
  'en':    'en',
  'ja':    'ja',
  'nl':    'nl',
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30 * 1000 },
  },
});

const lightTheme = {
  token: {
    colorPrimary: '#6366f1',
    colorBgBase: '#f5f6fa',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBorder: '#e8eaf0',
    colorBorderSecondary: '#f0f1f6',
    colorText: '#1a1d2e',
    colorTextSecondary: '#6b7280',
    colorTextTertiary: '#9ca3af',
    borderRadius: 10,
    fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
    boxShadowSecondary: '0 6px 24px rgba(0,0,0,0.08)',
  },
  components: {
    Layout: {
      bodyBg: '#f5f6fa',
      siderBg: '#ffffff',
      headerBg: '#ffffff',
    },
    Menu: {
      itemBg: 'transparent',
      itemHoverBg: '#f0f0ff',
      itemSelectedBg: '#eeedff',
      itemSelectedColor: '#6366f1',
      itemHoverColor: '#6366f1',
      itemColor: '#6b7280',
    },
    Card: {
      colorBgContainer: '#ffffff',
    },
    Table: {
      headerBg: '#f9fafb',
      rowHoverBg: '#f5f6ff',
    },
  },
};

function Root() {
  const [lang, setLang] = useState(i18n.language || 'zh-CN');

  useEffect(() => {
    const handleLangChange = (lng) => {
      const resolved = lng.split('-').length >= 2
        ? lng
        : lng === 'zh' ? 'zh-CN' : lng;
      const finalLang = ANTD_LOCALES[resolved] ? resolved : (ANTD_LOCALES[lng] ? lng : 'zh-CN');
      setLang(finalLang);
      dayjs.locale(DAYJS_LOCALES[finalLang] || 'zh-cn');
    };

    dayjs.locale(DAYJS_LOCALES[lang] || 'zh-cn');

    i18n.on('languageChanged', handleLangChange);
    return () => i18n.off('languageChanged', handleLangChange);
  }, []);

  const antdLocale = ANTD_LOCALES[lang] || zhCN;

  return (
    <ConfigProvider locale={antdLocale} theme={lightTheme}>
      <App />
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <Root />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
