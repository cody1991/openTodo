import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import LangSelect from '../../components/LangSelect/LangSelect';
import '../ShareView/ShareView.css';
import './BookmarkShareView.css';

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

function getFavicon(url) {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch { return null; }
}

function getDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url; }
}

function BookmarkCard({ bm, categories }) {
  const [imgError, setImgError] = useState(false);
  const favicon = bm.favicon || getFavicon(bm.url);
  const cat = categories.find((c) => c.id === bm.category_id);
  const parentCat = cat?.parent_id ? categories.find((c) => c.id === cat.parent_id) : null;
  const catLabel = parentCat ? `${parentCat.name} › ${cat.name}` : cat?.name;
  const catColor = parentCat?.color || cat?.color;

  return (
    <div className={`bsv-card ${bm.is_pinned ? 'bsv-card--pinned' : ''}`}>
      <div className="bsv-card-header">
        <div className="bsv-favicon">
          {favicon && !imgError
            ? <img src={favicon} alt="" onError={() => setImgError(true)} />
            : <span className="bsv-favicon-placeholder">🌐</span>}
        </div>
        {bm.is_pinned ? <span className="bsv-pin-badge">📌</span> : null}
      </div>
      <a className="bsv-card-title" href={bm.url} target="_blank" rel="noopener noreferrer">
        {bm.title}
      </a>
      <div className="bsv-domain">{getDomain(bm.url)}</div>
      {bm.description && <div className="bsv-desc">{bm.description}</div>}
      <div className="bsv-card-footer">
        {catLabel && (
          <span className="bsv-cat-badge" style={{ borderColor: `${catColor}40`, color: catColor, background: `${catColor}12` }}>
            {catLabel}
          </span>
        )}
        {bm.tags?.map((tag) => (
          <span key={tag} className="bsv-tag">{tag}</span>
        ))}
      </div>
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

function CategorySection({ category, bookmarks, categories, children: subSections }) {
  const [collapsed, setCollapsed] = useState(false);
  const total = bookmarks.length + (subSections || []).reduce((s, sec) => s + sec.bookmarks.length, 0);

  if (total === 0) return null;

  return (
    <div className="bsv-category-group">
      <div className="bsv-category-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="bsv-cat-left">
          <CatDot color={category.color} />
          <span className="bsv-cat-name">{category.name}</span>
          <span className="bsv-cat-count">{total}</span>
        </div>
        <span className="bsv-collapse-icon">{collapsed ? '▶' : '▼'}</span>
      </div>
      {!collapsed && (
        <div className="bsv-category-body">
          {bookmarks.length > 0 && (
            <div className="bsv-card-grid">
              {bookmarks.map((bm) => (
                <BookmarkCard key={bm.id} bm={bm} categories={categories} />
              ))}
            </div>
          )}
          {(subSections || []).map(({ sub, bookmarks: subBms }) => (
            subBms.length > 0 && (
              <div key={sub.id} className="bsv-sub-section">
                <div className="bsv-sub-header">
                  <span className="bsv-sub-connector" />
                  <CatDot color={sub.color} />
                  <span className="bsv-sub-name">{sub.name}</span>
                  <span className="bsv-cat-count">{subBms.length}</span>
                </div>
                <div className="bsv-card-grid">
                  {subBms.map((bm) => (
                    <BookmarkCard key={bm.id} bm={bm} categories={categories} />
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

const DEFAULT_SHARE_NAME = '我的书签分享';

export default function BookmarkShareView() {
  const { key } = useParams();
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('light');
  const [search, setSearch] = useState('');
  const viewTracked = useRef(false);

  const THEME_OPTIONS = [
    { value: 'light',   label: t('shareView.themes.light') },
    { value: 'dark',    label: t('shareView.themes.dark') },
    { value: 'vibrant', label: t('shareView.themes.vibrant') },
    { value: 'minimal', label: t('shareView.themes.minimal') },
  ];

  useEffect(() => {
    axios
      .get(`/api/public/bookmark-share/${key}`)
      .then((res) => {
        setData(res.data);
        if (res.data?.share?.theme) setTheme(res.data.share.theme);
        setLoading(false);
        if (!viewTracked.current) {
          viewTracked.current = true;
          axios.post(`/api/public/bookmark-share/${key}/view`).catch(() => {});
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || t('shareView.loading'));
        setLoading(false);
      });
  }, [key]);

  const filteredBookmarks = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data.bookmarks;
    const q = search.toLowerCase();
    return data.bookmarks.filter((bm) =>
      bm.title.toLowerCase().includes(q) ||
      bm.url.toLowerCase().includes(q) ||
      (bm.description || '').toLowerCase().includes(q) ||
      (bm.tags || []).some((tag) => tag.toLowerCase().includes(q))
    );
  }, [data, search]);

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

  const { share, owner, bookmarks, categories } = data;
  const pinnedBookmarks = filteredBookmarks.filter((bm) => bm.is_pinned);
  const unpinnedBookmarks = filteredBookmarks.filter((bm) => !bm.is_pinned);

  const rootCats = categories.filter((c) => !c.parent_id);
  const subsByParent = {};
  categories.filter((c) => c.parent_id).forEach((sub) => {
    if (!subsByParent[sub.parent_id]) subsByParent[sub.parent_id] = [];
    subsByParent[sub.parent_id].push(sub);
  });

  const bmByCat = {};
  const uncategorized = [];
  unpinnedBookmarks.forEach((bm) => {
    if (!bm.category_id) {
      uncategorized.push(bm);
    } else {
      if (!bmByCat[bm.category_id]) bmByCat[bm.category_id] = [];
      bmByCat[bm.category_id].push(bm);
    }
  });

  const categorySections = rootCats
    .map((parent) => {
      const directBms = bmByCat[parent.id] || [];
      const subs = (subsByParent[parent.id] || [])
        .map((sub) => ({ sub, bookmarks: bmByCat[sub.id] || [] }))
        .filter((s) => s.bookmarks.length > 0);
      return { parent, directBms, subs };
    })
    .filter((s) => s.directBms.length > 0 || s.subs.length > 0);

  return (
    <div className={`sv-root sv-theme-${theme}`}>
      <div className="sv-container">
        <header className="sv-header">
          <div className="sv-header-top">
            <div className="sv-owner-info">
              <Avatar username={owner.username} avatar={owner.avatar} />
              <div className="sv-owner-text">
                <span className="sv-owner-name">{owner.username}</span>
                <span className="sv-owner-sub">{t('bookmarkShareView.subtitle')}</span>
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

        <div className="bsv-stats-bar">
          <div className="bsv-stat-item">
            <span className="bsv-stat-num">{bookmarks.length}</span>
            <span className="bsv-stat-label">{t('bookmarkShareView.totalBookmarks')}</span>
          </div>
          <div className="bsv-stat-item">
            <span className="bsv-stat-num">{categories.length}</span>
            <span className="bsv-stat-label">{t('bookmarkShareView.totalCategories')}</span>
          </div>
          <div className="bsv-stat-item">
            <span className="bsv-stat-num">{pinnedBookmarks.length}</span>
            <span className="bsv-stat-label">{t('bookmarkShareView.pinned')}</span>
          </div>
        </div>

        <div className="bsv-search-wrap">
          <input
            className="bsv-search"
            type="text"
            placeholder={t('bookmarkShareView.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <main className="sv-main">
          {filteredBookmarks.length === 0 ? (
            <div className="sv-empty">
              <span className="sv-empty-icon">🔖</span>
              <p>{search ? t('bookmarkShareView.noResults') : t('bookmarkShareView.noBookmarks')}</p>
            </div>
          ) : (
            <div className="bsv-content">
              {pinnedBookmarks.length > 0 && (
                <div className="bsv-pinned-section">
                  <div className="bsv-section-header">
                    <span className="bsv-section-icon">📌</span>
                    <span className="bsv-section-name">{t('bookmarkShareView.pinnedSection')}</span>
                    <span className="bsv-cat-count">{pinnedBookmarks.length}</span>
                  </div>
                  <div className="bsv-card-grid">
                    {pinnedBookmarks.map((bm) => (
                      <BookmarkCard key={bm.id} bm={bm} categories={categories} />
                    ))}
                  </div>
                </div>
              )}

              {categorySections.map(({ parent, directBms, subs }) => (
                <CategorySection
                  key={parent.id}
                  category={parent}
                  bookmarks={directBms}
                  categories={categories}
                >
                  {subs}
                </CategorySection>
              ))}

              {uncategorized.length > 0 && (
                <CategorySection
                  category={{ id: 'uncategorized', name: t('shareView.uncategorized'), color: '#475569' }}
                  bookmarks={uncategorized}
                  categories={categories}
                />
              )}
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
      </div>
    </div>
  );
}
