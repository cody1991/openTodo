import { useEffect, useRef } from 'react';
import { Button, Space } from 'antd';
import {
  CheckSquareOutlined,
  ArrowRightOutlined,
  EditOutlined,
  CalendarOutlined,
  BellOutlined,
  BarChartOutlined,
  TagsOutlined,
  TeamOutlined,
  CheckCircleFilled,
  GithubOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import './LandingPage.css';

const FEATURES = [
  {
    icon: <EditOutlined />,
    color: '#6366f1',
    bg: '#eef2ff',
    title: 'Markdown 编辑',
    desc: '支持 GFM 扩展语法、代码高亮，嵌入图片一键上传，所见即所得。',
  },
  {
    icon: <CalendarOutlined />,
    color: '#0ea5e9',
    bg: '#e0f2fe',
    title: '日历视图',
    desc: '截止时间一目了然，拖拽任务到对应日期，按月 / 周切换查看。',
  },
  {
    icon: <BellOutlined />,
    color: '#f59e0b',
    bg: '#fef3c7',
    title: '企业微信通知',
    desc: '到期提醒 + 每日工作报告，自动推送到企业微信机器人。',
  },
  {
    icon: <BarChartOutlined />,
    color: '#10b981',
    bg: '#d1fae5',
    title: '数据看板',
    desc: '完成率、趋势折线、分类统计，实时掌握工作进度与效率。',
  },
  {
    icon: <StarOutlined />,
    color: '#ec4899',
    bg: '#fce7f3',
    title: '网站收藏',
    desc: '两级分类整理收藏网站，自动抓取 Favicon，一键直达常用链接。',
  },
  {
    icon: <TagsOutlined />,
    color: '#f97316',
    bg: '#fff7ed',
    title: '分类 & 标签',
    desc: '多维度整理 TODO，按分类筛选，用标签跨分类检索，查找毫秒级。',
  },
  {
    icon: <TeamOutlined />,
    color: '#8b5cf6',
    bg: '#f3f0ff',
    title: '角色权限',
    desc: '内置管理员 / 用户角色，可自定义扩展权限，每人数据完全隔离。',
  },
];

const STEPS = [
  { num: '01', title: '注册 / 登录', desc: '管理员创建账号，设置你的用户名和密码即可开始。' },
  { num: '02', title: '创建 TODO', desc: '写下任务标题和 Markdown 正文，设置优先级与截止时间。' },
  { num: '03', title: '掌控进度', desc: '通过看板、日历、数据看板随时查看任务状态，收到通知提醒。' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const heroRef = useRef(null);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (heroRef.current) {
        heroRef.current.style.setProperty('--scroll-y', `${y * 0.3}px`);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goApp = () => navigate(user ? '/todos' : '/login');

  return (
    <div className="landing">
      {/* ─── Navbar ─── */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="landing-logo-icon">
              <CheckSquareOutlined />
            </div>
            <span className="landing-logo-text">OpenTodo</span>
          </div>
          <Space size={12}>
            {user ? (
              <Button type="primary" className="nav-cta" onClick={goApp} icon={<ArrowRightOutlined />} iconPosition="end">
                进入应用
              </Button>
            ) : (
              <>
                <Button className="nav-login" onClick={() => navigate('/login')}>登录</Button>
                <Button type="primary" className="nav-cta" onClick={goApp}>立即使用</Button>
              </>
            )}
          </Space>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="landing-hero" ref={heroRef}>
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
        <div className="hero-inner">
          <div className="hero-badge">
            <CheckCircleFilled style={{ color: '#6366f1', marginRight: 6 }} />
            开源 · 自托管 · 轻量级任务管理
          </div>
          <h1 className="hero-title">
            让每一项任务<br />
            <span className="hero-gradient">清晰、高效、可追踪</span>
          </h1>
          <p className="hero-sub">
            OpenTodo 是一款为个人与小团队打造的全功能效率应用——<br />
            TODO 管理、网站收藏、日历追踪、智能通知，一站式搞定。
          </p>
          <Space size={16} wrap className="hero-actions">
            <Button type="primary" size="large" className="hero-btn-primary" onClick={goApp} icon={<ArrowRightOutlined />} iconPosition="end">
              {user ? '进入应用' : '立即开始'}
            </Button>
            <Button size="large" className="hero-btn-ghost" href="https://github.com/cody1991/openTodo" target="_blank" icon={<GithubOutlined />}>
              查看源码
            </Button>
          </Space>
          {/* mock screenshot card */}
          <div className="hero-card">
            <div className="hero-card-bar">
              <span /><span /><span />
            </div>
            <div className="hero-card-content">
              <div className="mock-sidebar">
                {['总览', 'TODO 列表', '日历', '网站收藏', '设置'].map((l, i) => (
                  <div key={l} className={`mock-nav-item ${i === 1 ? 'active' : ''}`}>{l}</div>
                ))}
              </div>
              <div className="mock-main">
                <div className="mock-topbar">
                  <div className="mock-search" />
                  <div className="mock-btn" />
                </div>
                {[
                  { p: 'urgent', done: false, w: 70 },
                  { p: 'high', done: false, w: 85 },
                  { p: 'medium', done: true, w: 60 },
                  { p: 'low', done: true, w: 50 },
                  { p: 'medium', done: false, w: 75 },
                ].map((item, i) => (
                  <div key={i} className={`mock-todo ${item.done ? 'done' : ''}`}>
                    <div className={`mock-dot p-${item.p}`} />
                    <div className="mock-line" style={{ width: `${item.w}%` }} />
                    {item.done && <div className="mock-check">✓</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="landing-section landing-features">
        <div className="section-inner">
          <div className="section-label">功能亮点</div>
          <h2 className="section-title">为效率而生的每一个细节</h2>
          <p className="section-sub">从记录到追踪，每个功能都经过打磨，让任务管理不再繁琐。</p>
          <div className="features-grid">
            {FEATURES.map((f) => (
              <div className="feature-card" key={f.title}>
                <div className="feature-icon" style={{ color: f.color, background: f.bg }}>
                  {f.icon}
                </div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="landing-section landing-steps">
        <div className="section-inner">
          <div className="section-label">使用流程</div>
          <h2 className="section-title">三步开始你的高效工作</h2>
          <div className="steps-row">
            {STEPS.map((s, i) => (
              <div className="step-card" key={s.num}>
                <div className="step-num">{s.num}</div>
                <div className="step-title">{s.title}</div>
                <div className="step-desc">{s.desc}</div>
                {i < STEPS.length - 1 && <div className="step-arrow">→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ─── */}
      <section className="landing-cta-banner">
        <div className="cta-orb cta-orb-1" />
        <div className="cta-orb cta-orb-2" />
        <div className="cta-inner">
          <h2 className="cta-title">准备好了吗？</h2>
          <p className="cta-sub">开始使用 OpenTodo，让每一项任务都有迹可循。</p>
          <Button type="primary" size="large" className="cta-btn" onClick={goApp} icon={<ArrowRightOutlined />} iconPosition="end">
            {user ? '进入应用' : '免费开始使用'}
          </Button>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-logo">
            <div className="landing-logo-icon sm">
              <CheckSquareOutlined />
            </div>
            <span>OpenTodo</span>
          </div>
          <div className="footer-copy">© 2026 OpenTodo · 开源任务管理系统</div>
        </div>
      </footer>
    </div>
  );
}
