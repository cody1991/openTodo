import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import App from './App';
import './index.css';

dayjs.locale('zh-cn');

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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider locale={zhCN} theme={lightTheme}>
          <App />
        </ConfigProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
