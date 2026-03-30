import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Badge, Typography, Space, Button } from 'antd';
import {
  DashboardOutlined, UnorderedListOutlined, CalendarOutlined,
  SettingOutlined, UserOutlined, LogoutOutlined, BellOutlined,
  TeamOutlined, CheckSquareOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import useAuthStore from '../../stores/authStore';
import { notificationApi } from '../../services/api';
import NotificationBell from '../NotificationBell/NotificationBell';
import './AppLayout.css';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const navItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '总览' },
  { key: '/todos', icon: <UnorderedListOutlined />, label: 'TODO 列表' },
  { key: '/calendar', icon: <CalendarOutlined />, label: '日历' },
  { key: '/bookmarks', icon: <StarOutlined />, label: '网站收藏' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
];

const mobileNavItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '总览' },
  { key: '/todos', icon: <UnorderedListOutlined />, label: 'TODO' },
  { key: '/calendar', icon: <CalendarOutlined />, label: '日历' },
  { key: '/bookmarks', icon: <StarOutlined />, label: '收藏' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuthStore();

  const { data: notifData } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => notificationApi.list({ unread_only: true, limit: 5 }),
    refetchInterval: 60000,
  });

  const unreadCount = notifData?.unread_count || 0;

  const userMenuItems = [
    { key: 'who', label: <Text style={{ color: '#94a3b8', fontSize: 12 }}>{user?.email}</Text>, disabled: true },
    { type: 'divider' },
    { key: 'settings', icon: <SettingOutlined />, label: '设置', onClick: () => navigate('/settings') },
    ...(isAdmin() ? [{ key: 'admin', icon: <TeamOutlined />, label: '管理员', onClick: () => navigate('/admin') }] : []),
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true, onClick: async () => { await logout(); navigate('/'); } },
  ];

  const siderItems = [
    ...navItems,
    ...(isAdmin() ? [{ key: '/admin', icon: <TeamOutlined />, label: '管理员' }] : []),
  ];

  return (
    <Layout className="app-layout">
      <Sider
        className="app-sider desktop-sider"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={220}
        collapsedWidth={60}
        trigger={null}
      >
        <div className="sider-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <div className="logo-icon-wrap">
            <CheckSquareOutlined />
          </div>
          {!collapsed && <span className="logo-text gradient-text">OpenTodo</span>}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={siderItems}
          onClick={({ key }) => navigate(key)}
          className="sider-menu"
        />

        <div className="sider-collapse-btn" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </div>
      </Sider>

      <Layout className="main-layout" style={{ marginLeft: collapsed ? 60 : 220 }}>
        <Header className="app-header">
          <div className="mobile-logo">
            <div className="logo-icon-wrap" style={{ width: 28, height: 28, fontSize: 13 }}>
              <CheckSquareOutlined />
            </div>
            <span className="gradient-text" style={{ fontSize: 15, fontWeight: 800 }}>OpenTodo</span>
          </div>

          <Space className="header-right">
            <NotificationBell unreadCount={unreadCount} />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
              <div className="user-trigger">
                <Avatar
                  size={28}
                  src={user?.avatar}
                  style={{ background: 'linear-gradient(135deg, #7c6ef5, #5b4de8)', flexShrink: 0 }}
                >
                  {user?.username?.[0]?.toUpperCase()}
                </Avatar>
                <Text className="username-text">{user?.username}</Text>
              </div>
            </Dropdown>
          </Space>
        </Header>

        <Content className="app-content main-content-with-sider">
          <div className="content-inner bg-grid fade-in">
            <Outlet />
          </div>
        </Content>
      </Layout>

      {/* Mobile bottom nav */}
      <div className="mobile-nav">
        {mobileNavItems.map((item) => (
          <button
            key={item.key}
            className={`mobile-nav-item ${location.pathname === item.key ? 'active' : ''}`}
            onClick={() => navigate(item.key)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </Layout>
  );
}
