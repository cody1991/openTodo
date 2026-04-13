import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Draggable from 'react-draggable';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Badge, Typography, Space, Button } from 'antd';
import {
  DashboardOutlined, UnorderedListOutlined, CalendarOutlined,
  SettingOutlined, LogoutOutlined, BellOutlined,
  TeamOutlined, CheckSquareOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  StarOutlined, InboxOutlined, TagsOutlined, GlobalOutlined, CheckOutlined, ScheduleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../../stores/authStore';
import i18n, { SUPPORTED_LANGUAGES } from '../../i18n';
import { notificationApi, shareRequestApi } from '../../services/api';
import NotificationBell from '../NotificationBell/NotificationBell';
import './AppLayout.css';

const { Sider, Content } = Layout;
const { Text } = Typography;

function shareReqNavIcon(count) {
  if (count > 0) {
    return (
      <Badge count={count} size="small" offset={[6, 0]}>
        <InboxOutlined />
      </Badge>
    );
  }
  return <InboxOutlined />;
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuthStore();
  const { t } = useTranslation();

  const { data: notifData } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => notificationApi.list({ unread_only: true, limit: 5 }),
    refetchInterval: 60000,
  });

  const { data: shareReqData } = useQuery({
    queryKey: ['share-requests', 'badge'],
    queryFn: () => shareRequestApi.list({ status: 'pending' }),
    staleTime: 30000,
    refetchInterval: 120000,
  });

  const unreadCount = notifData?.unread_count || 0;
  const pendingShareReqCount = shareReqData?.pending_count || 0;

  // ── Scroll to top on route change ───────────────────────────
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  // ── Draggable pill ──────────────────────────────────────────
  const pillNodeRef = useRef(null);
  const [pillPos, setPillPos] = useState(() => {
    try {
      const s = localStorage.getItem('opentodo-pill-pos-v2');
      if (s) return JSON.parse(s);
    } catch {}
    return { x: 0, y: 0 };
  });
  // Incrementing this key forces Draggable to remount with the updated defaultPosition
  const [pillKey, setPillKey] = useState(0);

  const PILL_MARGIN = 8; // minimum gap between pill edge and any boundary

  // Compute dx/dy needed to bring the pill's current DOM rect within safe bounds.
  const calcClampDelta = useCallback((rect) => {
    let dx = 0;
    let dy = 0;
    if (rect.right  > window.innerWidth  - PILL_MARGIN) dx = window.innerWidth  - PILL_MARGIN - rect.right;
    if (rect.left   < PILL_MARGIN)                       dx = PILL_MARGIN - rect.left;
    if (rect.bottom > window.innerHeight - PILL_MARGIN)  dy = window.innerHeight - PILL_MARGIN - rect.bottom;
    if (rect.top    < PILL_MARGIN)                       dy = PILL_MARGIN - rect.top;
    return { dx, dy };
  }, []);

  // Nudge the pill back into safe bounds on mount and window resize.
  // Does NOT write to localStorage — preserves the user's intended drag position
  // so the pill returns to the original spot when the window is enlarged again.
  const reclamp = useCallback(() => {
    const el = pillNodeRef.current;
    if (!el) return;
    const { dx, dy } = calcClampDelta(el.getBoundingClientRect());
    if (dx !== 0 || dy !== 0) {
      setPillPos((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setPillKey((k) => k + 1);
    }
  }, [calcClampDelta]);

  useEffect(() => {
    reclamp();
    window.addEventListener('resize', reclamp);
    return () => window.removeEventListener('resize', reclamp);
  }, [reclamp]);

  const onPillStop = (_, data) => {
    const el = pillNodeRef.current;
    const rect = el?.getBoundingClientRect() ?? { left: 0, top: 0, right: 0, bottom: 0 };
    const { dx, dy } = calcClampDelta(rect);
    const pos = { x: data.x + dx, y: data.y + dy };
    setPillPos(pos);
    if (dx !== 0 || dy !== 0) setPillKey((k) => k + 1);
    localStorage.setItem('opentodo-pill-pos-v2', JSON.stringify(pos));
  };

  const navItems = useMemo(
    () => [
      { key: '/dashboard', icon: <DashboardOutlined />, label: t('nav.overview') },
      { key: '/todos', icon: <UnorderedListOutlined />, label: t('nav.todoList') },
      { key: '/calendar', icon: <CalendarOutlined />, label: t('nav.calendar') },
      { key: '/holidays', icon: <ScheduleOutlined />, label: t('nav.holidays') },
      { key: '/tags', icon: <TagsOutlined />, label: t('nav.tagManagement') },
      { key: '/share-requests', icon: shareReqNavIcon(pendingShareReqCount), label: t('nav.inbox') },
      { key: '/bookmarks', icon: <StarOutlined />, label: t('nav.bookmarks') },
      { key: '/settings', icon: <SettingOutlined />, label: t('nav.settings') },
    ],
    [pendingShareReqCount, t]
  );

  const mobileNavItems = useMemo(
    () => [
      { key: '/dashboard', icon: <DashboardOutlined />, label: t('nav.overview') },
      { key: '/todos', icon: <UnorderedListOutlined />, label: t('nav.todo') },
      { key: '/calendar', icon: <CalendarOutlined />, label: t('nav.calendar') },
      { key: '/holidays', icon: <ScheduleOutlined />, label: t('nav.holidays') },
      { key: '/tags', icon: <TagsOutlined />, label: t('nav.tags') },
      { key: '/share-requests', icon: shareReqNavIcon(pendingShareReqCount), label: t('nav.inbox_short') },
      { key: '/bookmarks', icon: <StarOutlined />, label: t('nav.favorites') },
      { key: '/settings', icon: <SettingOutlined />, label: t('nav.settings') },
    ],
    [pendingShareReqCount, t]
  );

  const userMenuItems = [
    { key: 'who', label: <Text style={{ color: '#94a3b8', fontSize: 12 }}>{user?.email}</Text>, disabled: true },
    { type: 'divider' },
    { key: 'settings', icon: <SettingOutlined />, label: t('nav.settings'), onClick: () => navigate('/settings') },
    ...(isAdmin() ? [{ key: 'admin', icon: <TeamOutlined />, label: t('nav.admin'), onClick: () => navigate('/admin') }] : []),
    {
      key: 'language',
      icon: <GlobalOutlined />,
      label: t('nav.language'),
      children: SUPPORTED_LANGUAGES.map((lang) => ({
        key: `lang-${lang.value}`,
        label: (
          <Space>
            {lang.label}
            {i18n.language === lang.value && <CheckOutlined style={{ color: '#6366f1', fontSize: 11 }} />}
          </Space>
        ),
        onClick: () => i18n.changeLanguage(lang.value),
        style: i18n.language === lang.value ? { color: '#6366f1', fontWeight: 500 } : {},
      })),
    },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: t('nav.logout'), danger: true, onClick: async () => { await logout(); navigate('/'); } },
  ];

  const siderItems = useMemo(() => {
    const admin = isAdmin();
    return [
      ...navItems,
      ...(admin ? [{ key: '/admin', icon: <TeamOutlined />, label: t('nav.admin') }] : []),
    ];
  }, [navItems, user?.role_name, t]);

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
        <Draggable
          key={pillKey}
          nodeRef={pillNodeRef}
          defaultPosition={pillPos}
          onStop={onPillStop}

          cancel="button, a, .ant-dropdown-trigger, .ant-popover-open, [role='menuitem']"
        >
        <div ref={pillNodeRef} className="app-header">
          <div className="mobile-logo">
            <div className="logo-icon-wrap" style={{ width: 28, height: 28, fontSize: 13 }}>
              <CheckSquareOutlined />
            </div>
            <span className="gradient-text" style={{ fontSize: 15, fontWeight: 800 }}>OpenTodo</span>
          </div>

          <Space className="header-right">
            <NotificationBell unreadCount={unreadCount} />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
              <Avatar
                size={32}
                src={user?.avatar}
                className="user-avatar-btn"
                style={{ background: 'linear-gradient(135deg, #7c6ef5, #5b4de8)', flexShrink: 0, cursor: 'pointer' }}
              >
                {user?.username?.[0]?.toUpperCase()}
              </Avatar>
            </Dropdown>
          </Space>
        </div>
        </Draggable>

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
