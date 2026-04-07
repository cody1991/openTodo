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
import { useTranslation } from 'react-i18next';
import useAuthStore from '../../stores/authStore';
import i18n, { SUPPORTED_LANGUAGES } from '../../i18n';
import './LandingPage.css';

const FEATURE_KEYS = [
  { key: 'markdown', icon: <EditOutlined />,     color: '#6366f1', bg: '#eef2ff' },
  { key: 'calendar', icon: <CalendarOutlined />, color: '#0ea5e9', bg: '#e0f2fe' },
  { key: 'wecom',    icon: <BellOutlined />,     color: '#f59e0b', bg: '#fef3c7' },
  { key: 'dashboard',icon: <BarChartOutlined />, color: '#10b981', bg: '#d1fae5' },
  { key: 'bookmarks',icon: <StarOutlined />,     color: '#ec4899', bg: '#fce7f3' },
  { key: 'tags',     icon: <TagsOutlined />,     color: '#f97316', bg: '#fff7ed' },
  { key: 'roles',    icon: <TeamOutlined />,     color: '#8b5cf6', bg: '#f3f0ff' },
];

const STEP_KEYS = ['s1', 's2', 's3'];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const heroRef = useRef(null);
  const { t } = useTranslation();

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
  const mockNav = t('landing.mockNav', { returnObjects: true });

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

          <div className="landing-nav-right">
            {/* Language switcher */}
            <div className="landing-lang-switcher">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.value}
                  className={`landing-lang-btn${i18n.language === lang.value ? ' active' : ''}`}
                  onClick={() => i18n.changeLanguage(lang.value)}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            <Space size={12}>
              {user ? (
                <Button type="primary" className="nav-cta" onClick={goApp} icon={<ArrowRightOutlined />} iconPosition="end">
                  {t('landing.enterApp')}
                </Button>
              ) : (
                <>
                  <Button className="nav-login" onClick={() => navigate('/login')}>{t('landing.login')}</Button>
                  <Button type="primary" className="nav-cta" onClick={goApp}>{t('landing.startNow')}</Button>
                </>
              )}
            </Space>
          </div>
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
            {t('landing.badge')}
          </div>
          <h1 className="hero-title">
            {t('landing.heroTitle1')}<br />
            <span className="hero-gradient">{t('landing.heroTitle2')}</span>
          </h1>
          <p className="hero-sub">{t('landing.heroSub')}</p>
          <Space size={16} wrap className="hero-actions">
            <Button type="primary" size="large" className="hero-btn-primary" onClick={goApp} icon={<ArrowRightOutlined />} iconPosition="end">
              {user ? t('landing.enterApp') : t('landing.getStarted')}
            </Button>
            <Button size="large" className="hero-btn-ghost" href="https://github.com/cody1991/openTodo" target="_blank" icon={<GithubOutlined />}>
              {t('landing.viewSource')}
            </Button>
          </Space>
          {/* mock screenshot card */}
          <div className="hero-card">
            <div className="hero-card-bar">
              <span /><span /><span />
            </div>
            <div className="hero-card-content">
              <div className="mock-sidebar">
                {(Array.isArray(mockNav) ? mockNav : []).map((l, i) => (
                  <div key={i} className={`mock-nav-item ${i === 1 ? 'active' : ''}`}>{l}</div>
                ))}
              </div>
              <div className="mock-main">
                <div className="mock-topbar">
                  <div className="mock-search" />
                  <div className="mock-btn" />
                </div>
                {[
                  { p: 'urgent', done: false, w: 70 },
                  { p: 'high',   done: false, w: 85 },
                  { p: 'medium', done: true,  w: 60 },
                  { p: 'low',    done: true,  w: 50 },
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
          <div className="section-label">{t('landing.featuresLabel')}</div>
          <h2 className="section-title">{t('landing.featuresTitle')}</h2>
          <p className="section-sub">{t('landing.featuresSub')}</p>
          <div className="features-grid">
            {FEATURE_KEYS.map((f) => (
              <div className="feature-card" key={f.key}>
                <div className="feature-icon" style={{ color: f.color, background: f.bg }}>
                  {f.icon}
                </div>
                <div className="feature-title">{t(`landing.features.${f.key}.title`)}</div>
                <div className="feature-desc">{t(`landing.features.${f.key}.desc`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="landing-section landing-steps">
        <div className="section-inner">
          <div className="section-label">{t('landing.stepsLabel')}</div>
          <h2 className="section-title">{t('landing.stepsTitle')}</h2>
          <div className="steps-row">
            {STEP_KEYS.map((key, i) => (
              <div className="step-card" key={key}>
                <div className="step-num">{String(i + 1).padStart(2, '0')}</div>
                <div className="step-title">{t(`landing.steps.${key}.title`)}</div>
                <div className="step-desc">{t(`landing.steps.${key}.desc`)}</div>
                {i < STEP_KEYS.length - 1 && <div className="step-arrow">→</div>}
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
          <h2 className="cta-title">{t('landing.ctaTitle')}</h2>
          <p className="cta-sub">{t('landing.ctaSub')}</p>
          <Button type="primary" size="large" className="cta-btn" onClick={goApp} icon={<ArrowRightOutlined />} iconPosition="end">
            {user ? t('landing.enterApp') : t('landing.ctaBtn')}
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
          <div className="footer-copy">{t('landing.footerCopy')}</div>
        </div>
      </footer>
    </div>
  );
}
