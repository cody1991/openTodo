import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import ReactMarkdown from 'react-markdown';

dayjs.extend(utc);
dayjs.extend(timezone);
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import './ShareView.css';
import LangSelect from '../../components/LangSelect/LangSelect';
import ShareRequestDrawer from '../../components/ShareRequestDrawer/ShareRequestDrawer';

function Avatar({ username, avatar }) {
  if (avatar) {
    return <img className="sv-avatar" src={avatar} alt={username} />;
  }
  return (
    <div className="sv-avatar sv-avatar-placeholder">
      {username ? username[0].toUpperCase() : '?'}
    </div>
  );
}

function StatusBadge({ status }) {
  const { t } = useTranslation();
  const STATUS_LABEL = {
    pending: t('shareView.status.pending'),
    in_progress: t('shareView.status.in_progress'),
    completed: t('shareView.status.completed'),
  };
  const STATUS_CLASS = {
    pending: 'status-pending',
    in_progress: 'status-inprogress',
    completed: 'status-completed',
  };
  return (
    <span className={`sv-badge ${STATUS_CLASS[status] || ''}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function PriorityDot({ priority }) {
  const { t } = useTranslation();
  const PRIORITY_LABEL = {
    urgent: t('shareView.priority.urgent'),
    high:   t('shareView.priority.high'),
    medium: t('shareView.priority.medium'),
    low:    t('shareView.priority.low'),
  };
  const PRIORITY_CLASS = {
    urgent: 'priority-urgent',
    high: 'priority-high',
    medium: 'priority-medium',
    low: 'priority-low',
  };
  if (!priority) return null;
  return (
    <span className={`sv-priority-dot ${PRIORITY_CLASS[priority] || ''}`} title={PRIORITY_LABEL[priority]} />
  );
}

function TodoCard({ todo, ownerTz = 'UTC' }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  const hasContent = todo.content && todo.content.trim();
  const dueDayjs = todo.due_date ? dayjs.utc(todo.due_date).tz(ownerTz) : null;
  const nowInOwnerTz = dayjs().tz(ownerTz);
  return (
    <div className={`sv-todo-card ${todo.status === 'completed' ? 'sv-todo-completed' : ''}`}>
      <div className="sv-todo-header" onClick={() => hasContent && setExpanded(!expanded)}
        style={{ cursor: hasContent ? 'pointer' : 'default' }}>
        <div className="sv-todo-left">
          <PriorityDot priority={todo.priority} />
          <span className={`sv-todo-title ${todo.status === 'completed' ? 'sv-strikethrough' : ''}`}>
            {todo.title}
          </span>
        </div>
        <div className="sv-todo-meta">
          {dueDayjs && (
            <span className={`sv-due-date ${dueDayjs.isBefore(nowInOwnerTz) && todo.status !== 'completed' ? 'sv-overdue' : ''}`}>
              {t('shareView.dueDate')} {dueDayjs.format('MM/DD')}
            </span>
          )}
          {todo.tags && todo.tags.length > 0 && todo.tags.map((tag) => (
            <span key={tag.id} className="sv-tag" style={{ '--tag-color': tag.color || '#6366f1' }}>
              {tag.name}
            </span>
          ))}
          {hasContent && (
            <span className="sv-expand-btn">{expanded ? t('shareView.collapse') : t('shareView.detail')}</span>
          )}
        </div>
      </div>
      {hasContent && !expanded && (
        <div className="sv-todo-content-preview sv-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {todo.content.split('\n')[0].slice(0, 120) + ((todo.content.length > 120 || todo.content.includes('\n')) ? '…' : '')}
          </ReactMarkdown>
        </div>
      )}
      {expanded && hasContent && (
        <div className="sv-todo-content sv-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{todo.content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function CatDot({ color }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 10, height: 10,
      borderRadius: '50%',
      background: color || '#6366f1',
      flexShrink: 0,
    }} />
  );
}

function SubCategorySection({ sub, todos, ownerTz }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="sv-sub-section">
      <div className="sv-sub-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="sv-sub-left">
          <span className="sv-sub-connector" />
          <CatDot color={sub.color} />
          <span className="sv-sub-name">{sub.name}</span>
          <span className="sv-cat-count">{todos.length}</span>
        </div>
        <span className="sv-collapse-icon">{collapsed ? '▶' : '▼'}</span>
      </div>
      {!collapsed && (
        <div className="sv-todo-list sv-todo-list--sub">
          {todos.map((todo) => <TodoCard key={todo.id} todo={todo} ownerTz={ownerTz} />)}
        </div>
      )}
    </div>
  );
}

function ParentCategorySection({ parent, directTodos, subSections, ownerTz }) {
  const [collapsed, setCollapsed] = useState(false);
  const total = directTodos.length + subSections.reduce((s, sec) => s + sec.todos.length, 0);

  return (
    <div className="sv-category-group">
      <div className="sv-category-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="sv-cat-left">
          <CatDot color={parent.color} />
          <span className="sv-cat-name">{parent.name}</span>
          <span className="sv-cat-count">{total}</span>
        </div>
        <span className="sv-collapse-icon">{collapsed ? '▶' : '▼'}</span>
      </div>
      {!collapsed && (
        <div className="sv-parent-body">
          {directTodos.length > 0 && (
            <div className="sv-todo-list">
              {directTodos.map((todo) => <TodoCard key={todo.id} todo={todo} ownerTz={ownerTz} />)}
            </div>
          )}
          {subSections.map(({ sub, todos }) => (
            <SubCategorySection key={sub.id} sub={sub} todos={todos} ownerTz={ownerTz} />
          ))}
        </div>
      )}
    </div>
  );
}

function buildCategorySections(filteredTodos, rootCats, subsByParent) {
  const todosByCat = {};
  const uncategorized = [];
  filteredTodos.forEach((todo) => {
    if (!todo.category_id) {
      uncategorized.push(todo);
    } else {
      if (!todosByCat[todo.category_id]) todosByCat[todo.category_id] = [];
      todosByCat[todo.category_id].push(todo);
    }
  });
  const parentSections = rootCats
    .map((parent) => {
      const directTodos = todosByCat[parent.id] || [];
      const subs = subsByParent[parent.id] || [];
      const subSections = subs
        .map((sub) => ({ sub, todos: todosByCat[sub.id] || [] }))
        .filter((s) => s.todos.length > 0);
      return { parent, directTodos, subSections };
    })
    .filter((s) => s.directTodos.length > 0 || s.subSections.length > 0);
  return { parentSections, uncategorized };
}

function StatusSection({ statusKey, todos, rootCats, subsByParent, ownerTz }) {
  const { t } = useTranslation();
  const STATUS_SECTION_CONFIG = {
    in_progress: { label: t('shareView.statusSections.in_progress'), icon: '🔵', defaultCollapsed: false },
    pending:     { label: t('shareView.statusSections.pending'),     icon: '🟡', defaultCollapsed: false },
    completed:   { label: t('shareView.statusSections.completed'),   icon: '✅', defaultCollapsed: true  },
  };
  const cfg = STATUS_SECTION_CONFIG[statusKey];
  const [collapsed, setCollapsed] = useState(cfg.defaultCollapsed);
  if (todos.length === 0) return null;

  const { parentSections, uncategorized } = buildCategorySections(todos, rootCats, subsByParent);

  return (
    <div className={`sv-status-section sv-status-section--${statusKey}`}>
      <div className="sv-status-header" onClick={() => setCollapsed((c) => !c)}>
        <div className="sv-status-left">
          <span className="sv-status-icon">{cfg.icon}</span>
          <span className="sv-status-name">{cfg.label}</span>
          <span className="sv-status-count">{todos.length}</span>
        </div>
        <span className="sv-collapse-icon">{collapsed ? '▶' : '▼'}</span>
      </div>
      {!collapsed && (
        <div className="sv-status-body">
          <div className="sv-groups">
            {parentSections.map(({ parent, directTodos, subSections }) => (
              <ParentCategorySection
                key={parent.id}
                parent={parent}
                directTodos={directTodos}
                subSections={subSections}
                ownerTz={ownerTz}
              />
            ))}
            {uncategorized.length > 0 && (
              <ParentCategorySection
                parent={{ id: 'uncategorized', name: t('shareView.uncategorized'), color: '#475569' }}
                directTodos={uncategorized}
                subSections={[]}
                ownerTz={ownerTz}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatsRow({ todos }) {
  const { t } = useTranslation();
  const pending = todos.filter((todo) => todo.status === 'pending').length;
  const inProgress = todos.filter((todo) => todo.status === 'in_progress').length;
  const completed = todos.filter((todo) => todo.status === 'completed').length;
  const total = todos.length;
  const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="sv-stats">
      <div className="sv-stat-item">
        <span className="sv-stat-num sv-stat-total">{total}</span>
        <span className="sv-stat-label">{t('shareView.stats.all')}</span>
      </div>
      <div className="sv-stat-item">
        <span className="sv-stat-num sv-stat-pending">{pending}</span>
        <span className="sv-stat-label">{t('shareView.stats.pending')}</span>
      </div>
      <div className="sv-stat-item">
        <span className="sv-stat-num sv-stat-inprogress">{inProgress}</span>
        <span className="sv-stat-label">{t('shareView.stats.inProgress')}</span>
      </div>
      <div className="sv-stat-item">
        <span className="sv-stat-num sv-stat-done">{completed}</span>
        <span className="sv-stat-label">{t('shareView.stats.completed')}</span>
      </div>
      <div className="sv-stat-divider" />
      <div className="sv-stat-item sv-stat-ring-wrap">
        <svg className="sv-ring" viewBox="0 0 36 36">
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#6366f1" />
              <stop offset="50%"  stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
          <path className="sv-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          <path
            className="sv-ring-fill"
            strokeDasharray={`${completedPct}, 100`}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <text x="18" y="20.35" className="sv-ring-text">{completedPct}%</text>
        </svg>
        <span className="sv-stat-label">{t('shareView.stats.completionRate')}</span>
      </div>
    </div>
  );
}

const DEFAULT_SHARE_NAME = '我的分享';

export default function ShareView() {
  const { key } = useParams();
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requestOpen, setRequestOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const viewTracked = useRef(false);

  const THEME_OPTIONS = [
    { value: 'light',   label: t('shareView.themes.light') },
    { value: 'dark',    label: t('shareView.themes.dark') },
    { value: 'vibrant', label: t('shareView.themes.vibrant') },
    { value: 'minimal', label: t('shareView.themes.minimal') },
  ];

  useEffect(() => {
    axios
      .get(`/api/public/share/${key}`)
      .then((res) => {
        setData(res.data);
        if (res.data?.share?.theme) setTheme(res.data.share.theme);
        setLoading(false);
        if (!viewTracked.current) {
          viewTracked.current = true;
          axios.post(`/api/public/share/${key}/view`).catch(() => {});
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || t('shareView.loading'));
        setLoading(false);
      });
  }, [key]);

  if (loading) {
    return (
      <div className="sv-loading">
        <div className="sv-spinner" />
        <span>{t('shareView.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sv-error">
        <div className="sv-error-icon">🔒</div>
        <h2>{error}</h2>
        <p>{t('shareView.linkExpired')}</p>
      </div>
    );
  }

  const { share, owner, todos, categories, tags = [] } = data;
  const ownerTz = owner.timezone || 'UTC';

  const rootCats = categories.filter((c) => !c.parent_id);
  const subsByParent = {};
  categories.filter((c) => c.parent_id).forEach((sub) => {
    if (!subsByParent[sub.parent_id]) subsByParent[sub.parent_id] = [];
    subsByParent[sub.parent_id].push(sub);
  });

  const inProgressTodos = todos.filter((todo) => todo.status === 'in_progress');
  const pendingTodos    = todos.filter((todo) => todo.status === 'pending');
  const completedTodos  = todos.filter((todo) => todo.status === 'completed');
  const hasContent = todos.length > 0;

  return (
    <div className={`sv-root sv-theme-${theme}`}>
      <div className="sv-container">
        <header className="sv-header">
          <div className="sv-header-top">
            <div className="sv-owner-info">
              <Avatar username={owner.username} avatar={owner.avatar} />
              <div className="sv-owner-text">
                <span className="sv-owner-name">{owner.username}</span>
                <span className="sv-owner-sub">{t('shareView.todoShare')}</span>
              </div>
            </div>
            <div className="sv-header-right">
              <div className="sv-controls-row">
                <LangSelect />
                <div className="sv-theme-switcher">
                  {THEME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`sv-theme-btn${theme === opt.value ? ' sv-theme-btn--active' : ''}`}
                      onClick={() => setTheme(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sv-meta-row">
                <span className="sv-meta-item">👁️ {share.view_count}</span>
                <span className="sv-meta-item">📅 {dayjs(share.created_at).format('MM/DD')} {t('shareView.created')}</span>
                {share.expires_at && (
                  <span className={`sv-meta-item ${dayjs(share.expires_at).isBefore(dayjs().add(3, 'day')) ? 'sv-expiring-soon' : ''}`}>
                    ⏰ {dayjs(share.expires_at).format('MM/DD')}
                  </span>
                )}
              </div>
            </div>
          </div>
          {(share.name && share.name !== DEFAULT_SHARE_NAME || share.headline) && (
            <div className="sv-share-meta">
              {share.name && share.name !== DEFAULT_SHARE_NAME && (
                <h1 className="sv-share-title">{share.name}</h1>
              )}
              {share.headline && (
                <p className="sv-share-headline">{share.headline}</p>
              )}
            </div>
          )}
        </header>

        <div className="sv-cta-wrap">
          <button type="button" className="sv-cta-btn" onClick={() => setRequestOpen(true)}>
            {t('shareView.submitRequest')}
          </button>
          <p className="sv-cta-hint">{t('shareView.requestHint')}</p>
        </div>

        <StatsRow todos={todos} />

        <main className="sv-main">
          {!hasContent ? (
            <div className="sv-empty">
              <span className="sv-empty-icon">✨</span>
              <p>{t('shareView.noTodos')}</p>
            </div>
          ) : (
            <div className="sv-status-sections">
              <StatusSection statusKey="in_progress" todos={inProgressTodos} rootCats={rootCats} subsByParent={subsByParent} ownerTz={ownerTz} />
              <StatusSection statusKey="pending"     todos={pendingTodos}    rootCats={rootCats} subsByParent={subsByParent} ownerTz={ownerTz} />
              <StatusSection statusKey="completed"   todos={completedTodos}  rootCats={rootCats} subsByParent={subsByParent} ownerTz={ownerTz} />
            </div>
          )}
        </main>

        <footer className="sv-footer">
          <div className="sv-footer-cta">
            <span className="sv-footer-cta-text">{t('shareView.footerCta')}</span>
            <a
              href="https://todo.codytang.cn"
              target="_blank"
              rel="noopener noreferrer"
              className="sv-footer-cta-link"
            >
              {t('shareView.footerTryLink')}
            </a>
          </div>
          <div className="sv-footer-powered">
            <span>Powered by </span>
            <a
              href="https://github.com/cody1991/openTodo"
              target="_blank"
              rel="noopener noreferrer"
              className="sv-footer-link"
            >
              OpenTodo
            </a>
          </div>
        </footer>

        <ShareRequestDrawer
          open={requestOpen}
          onClose={() => setRequestOpen(false)}
          shareKey={key}
          categories={categories}
          tags={tags}
          ownerTimezone={ownerTz}
        />
      </div>
    </div>
  );
}
