import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './ShareView.css';

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

function TodoCard({ todo }) {
  const [expanded, setExpanded] = useState(false);
  const hasContent = todo.content && todo.content.trim();
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
          <StatusBadge status={todo.status} />
          {todo.due_date && (
            <span className={`sv-due-date ${dayjs(todo.due_date).isBefore(dayjs()) && todo.status !== 'completed' ? 'sv-overdue' : ''}`}>
              截止 {dayjs(todo.due_date).format('MM/DD')}
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

function SubCategorySection({ sub, todos }) {
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
          {todos.map((todo) => <TodoCard key={todo.id} todo={todo} />)}
        </div>
      )}
    </div>
  );
}

function ParentCategorySection({ parent, directTodos, subSections }) {
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
              {directTodos.map((todo) => <TodoCard key={todo.id} todo={todo} />)}
            </div>
          )}
          {subSections.map(({ sub, todos }) => (
            <SubCategorySection key={sub.id} sub={sub} todos={todos} />
          ))}
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

  useEffect(() => {
    axios
      .get(`/api/public/share/${key}`)
      .then((res) => {
        setData(res.data);
        setLoading(false);
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

  const { share, owner, todos, categories } = data;

  // Build category maps
  const catMap = {};
  categories.forEach((c) => { catMap[c.id] = c; });

  const rootCats = categories.filter((c) => !c.parent_id);
  const subsByParent = {};
  categories.filter((c) => c.parent_id).forEach((sub) => {
    if (!subsByParent[sub.parent_id]) subsByParent[sub.parent_id] = [];
    subsByParent[sub.parent_id].push(sub);
  });

  // Group todos by category_id
  const todosByCat = {};
  const uncategorized = [];
  todos.forEach((todo) => {
    if (!todo.category_id) {
      uncategorized.push(todo);
    } else {
      if (!todosByCat[todo.category_id]) todosByCat[todo.category_id] = [];
      todosByCat[todo.category_id].push(todo);
    }
  });

  // Build hierarchical sections: parent → subs → todos
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

  return (
    <div className="sv-root">
      {/* Animated background */}
      <div className="sv-bg">
        <div className="sv-blob sv-blob-1" />
        <div className="sv-blob sv-blob-2" />
        <div className="sv-blob sv-blob-3" />
        <div className="sv-grid-overlay" />
      </div>

      <div className="sv-container">
        {/* Header */}
        <header className="sv-header">
          <div className="sv-header-inner">
            <div className="sv-owner-info">
              <Avatar username={owner.username} avatar={owner.avatar} />
              <div className="sv-owner-text">
                <span className="sv-owner-name">{owner.username}</span>
                <span className="sv-owner-sub">的 TODO 分享</span>
              </div>
            </div>
            <div className="sv-share-meta">
              {share.name && share.name !== '我的分享' && (
                <h1 className="sv-share-title">{share.name}</h1>
              )}
              {share.headline && (
                <p className="sv-share-headline">{share.headline}</p>
              )}
              <div className="sv-meta-row">
                <span className="sv-meta-item">
                  👁️ {share.view_count} 次浏览
                </span>
                <span className="sv-meta-item">
                  📅 {dayjs(share.created_at).format('YYYY年MM月DD日')} 创建
                </span>
                {share.expires_at && (
                  <span className={`sv-meta-item ${dayjs(share.expires_at).isBefore(dayjs().add(3, 'day')) ? 'sv-expiring-soon' : ''}`}>
                    ⏰ 有效期至 {dayjs(share.expires_at).format('MM月DD日')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Stats */}
        <StatsRow todos={todos} />

        {/* Content */}
        <main className="sv-main">
          {parentSections.length === 0 && uncategorized.length === 0 ? (
            <div className="sv-empty">
              <span className="sv-empty-icon">✨</span>
              <p>暂无待分享的 TODO</p>
            </div>
          ) : (
            <div className="sv-groups">
              {parentSections.map(({ parent, directTodos, subSections }) => (
                <ParentCategorySection
                  key={parent.id}
                  parent={parent}
                  directTodos={directTodos}
                  subSections={subSections}
                />
              ))}
              {uncategorized.length > 0 && (
                <ParentCategorySection
                  parent={{ id: 'uncategorized', name: '未分类', color: '#475569' }}
                  directTodos={uncategorized}
                  subSections={[]}
                />
              )}
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
      </div>
    </div>
  );
}
