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
import './ShareView.css';
import ShareRequestDrawer from '../../components/ShareRequestDrawer/ShareRequestDrawer';

const STATUS_LABEL = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
};
const STATUS_CLASS = {
  pending: 'status-pending',
  in_progress: 'status-inprogress',
  completed: 'status-completed',
};
const PRIORITY_LABEL = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};
const PRIORITY_CLASS = {
  urgent: 'priority-urgent',
  high: 'priority-high',
  medium: 'priority-medium',
  low: 'priority-low',
};

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
  return (
    <span className={`sv-badge ${STATUS_CLASS[status] || ''}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function PriorityDot({ priority }) {
  if (!priority) return null;
  return (
    <span className={`sv-priority-dot ${PRIORITY_CLASS[priority] || ''}`} title={PRIORITY_LABEL[priority]} />
  );
}

function TodoCard({ todo, ownerTz = 'UTC' }) {
  const [expanded, setExpanded] = useState(false);
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
              截止 {dueDayjs.format('MM/DD')}
            </span>
          )}
          {todo.tags && todo.tags.length > 0 && todo.tags.map((tag) => (
            <span key={tag.id} className="sv-tag" style={{ '--tag-color': tag.color || '#6366f1' }}>
              {tag.name}
            </span>
          ))}
          {hasContent && (
            <span className="sv-expand-btn">{expanded ? '收起 ▲' : '详情 ▼'}</span>
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
  const done = todos.filter((t) => t.status === 'completed').length;
  const pct = todos.length > 0 ? Math.round((done / todos.length) * 100) : 0;
  return (
    <div className="sv-sub-section">
      <div className="sv-sub-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="sv-sub-left">
          <span className="sv-sub-connector" />
          <CatDot color={sub.color} />
          <span className="sv-sub-name">{sub.name}</span>
          <span className="sv-cat-count">{todos.length}</span>
        </div>
        <div className="sv-cat-right">
          <div className="sv-progress-bar sv-progress-bar--sm">
            <div className="sv-progress-fill" style={{ width: `${pct}%`, background: sub.color || '#6366f1' }} />
          </div>
          <span className="sv-progress-text">{pct}%</span>
          <span className="sv-collapse-icon">{collapsed ? '▶' : '▼'}</span>
        </div>
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
  const allTodos = [
    ...directTodos,
    ...subSections.flatMap((s) => s.todos),
  ];
  const total = allTodos.length;
  const done = allTodos.filter((t) => t.status === 'completed').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="sv-category-group">
      <div className="sv-category-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="sv-cat-left">
          <CatDot color={parent.color} />
          <span className="sv-cat-name">{parent.name}</span>
          <span className="sv-cat-count">{total}</span>
        </div>
        <div className="sv-cat-right">
          <div className="sv-progress-bar">
            <div className="sv-progress-fill" style={{ width: `${pct}%`, background: parent.color || '#6366f1' }} />
          </div>
          <span className="sv-progress-text">{pct}%</span>
          <span className="sv-collapse-icon">{collapsed ? '▶' : '▼'}</span>
        </div>
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

const STATUS_SECTION_CONFIG = {
  in_progress: { label: '进行中', icon: '🔵', defaultCollapsed: false },
  pending:     { label: '待处理', icon: '🟡', defaultCollapsed: false },
  completed:   { label: '已完成', icon: '✅', defaultCollapsed: true  },
};

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
                parent={{ id: 'uncategorized', name: '未分类', color: '#475569' }}
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
  const pending = todos.filter((t) => t.status === 'pending').length;
  const inProgress = todos.filter((t) => t.status === 'in_progress').length;
  const completed = todos.filter((t) => t.status === 'completed').length;
  const total = todos.length;
  const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="sv-stats">
      <div className="sv-stat-item">
        <span className="sv-stat-num sv-stat-total">{total}</span>
        <span className="sv-stat-label">全部</span>
      </div>
      <div className="sv-stat-item">
        <span className="sv-stat-num sv-stat-pending">{pending}</span>
        <span className="sv-stat-label">待处理</span>
      </div>
      <div className="sv-stat-item">
        <span className="sv-stat-num sv-stat-inprogress">{inProgress}</span>
        <span className="sv-stat-label">进行中</span>
      </div>
      <div className="sv-stat-item">
        <span className="sv-stat-num sv-stat-done">{completed}</span>
        <span className="sv-stat-label">已完成</span>
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
        <span className="sv-stat-label">完成率</span>
      </div>
    </div>
  );
}

export default function ShareView() {
  const { key } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requestOpen, setRequestOpen] = useState(false);
  const viewTracked = useRef(false);

  useEffect(() => {
    axios
      .get(`/api/public/share/${key}`)
      .then((res) => {
        setData(res.data);
        setLoading(false);
        // Only record the view once, even in React StrictMode (which runs effects twice)
        if (!viewTracked.current) {
          viewTracked.current = true;
          axios.post(`/api/public/share/${key}/view`).catch(() => {});
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || '加载失败');
        setLoading(false);
      });
  }, [key]);

  if (loading) {
    return (
      <div className="sv-loading">
        <div className="sv-spinner" />
        <span>加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sv-error">
        <div className="sv-error-icon">🔒</div>
        <h2>{error}</h2>
        <p>该链接可能已过期或不存在</p>
      </div>
    );
  }

  const { share, owner, todos, categories, tags = [] } = data;
  const ownerTz = owner.timezone || 'UTC';

  // Build category maps
  const rootCats = categories.filter((c) => !c.parent_id);
  const subsByParent = {};
  categories.filter((c) => c.parent_id).forEach((sub) => {
    if (!subsByParent[sub.parent_id]) subsByParent[sub.parent_id] = [];
    subsByParent[sub.parent_id].push(sub);
  });

  // Split todos by status
  const inProgressTodos = todos.filter((t) => t.status === 'in_progress');
  const pendingTodos    = todos.filter((t) => t.status === 'pending');
  const completedTodos  = todos.filter((t) => t.status === 'completed');
  const hasContent = todos.length > 0;

  return (
    <div className="sv-root">
      <div className="sv-container">
        {/* Header */}
        <header className="sv-header">
          <div className="sv-header-top">
            <div className="sv-owner-info">
              <Avatar username={owner.username} avatar={owner.avatar} />
              <div className="sv-owner-text">
                <span className="sv-owner-name">{owner.username}</span>
                <span className="sv-owner-sub">的 TODO 分享</span>
              </div>
            </div>
            <div className="sv-meta-row">
              <span className="sv-meta-item">👁️ {share.view_count}</span>
              <span className="sv-meta-item">📅 {dayjs(share.created_at).format('MM/DD')} 创建</span>
              {share.expires_at && (
                <span className={`sv-meta-item ${dayjs(share.expires_at).isBefore(dayjs().add(3, 'day')) ? 'sv-expiring-soon' : ''}`}>
                  ⏰ 至 {dayjs(share.expires_at).format('MM/DD')}
                </span>
              )}
            </div>
          </div>
          {(share.name && share.name !== '我的分享' || share.headline) && (
            <div className="sv-share-meta">
              {share.name && share.name !== '我的分享' && (
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
            提需求
          </button>
          <p className="sv-cta-hint">无需登录，提交后由分享主审核，通过后会加入对方的 TODO</p>
        </div>

        {/* Stats */}
        <StatsRow todos={todos} />

        {/* Content */}
        <main className="sv-main">
          {!hasContent ? (
            <div className="sv-empty">
              <span className="sv-empty-icon">✨</span>
              <p>暂无待分享的 TODO</p>
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
          <span>Powered by </span>
          <a
            href="https://github.com/cody1991/openTodo"
            target="_blank"
            rel="noopener noreferrer"
            className="sv-footer-link"
          >
            OpenTodo
          </a>
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
