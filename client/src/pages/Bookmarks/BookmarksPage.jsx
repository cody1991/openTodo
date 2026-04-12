import { useState, useMemo } from 'react';
import {
  Button, Input, Modal, Form, Select, Tooltip, Popconfirm,
  Empty, Spin, message, Space,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  LinkOutlined, PushpinOutlined, PushpinFilled,
  FolderOutlined, FolderOpenOutlined, GlobalOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { bookmarkApi, bookmarkCategoryApi } from '../../services/api';
import BookmarkShareModal from '../../components/BookmarkShareModal/BookmarkShareModal';
import BookmarkShareLinksModal from '../../components/BookmarkShareLinksModal/BookmarkShareLinksModal';
import './BookmarksPage.css';

const COLOR_PRESETS = [
  '#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316',
  '#eab308','#22c55e','#14b8a6','#0ea5e9','#64748b',
];

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

function CategoryModal({ open, onClose, categories, editingCat }) {
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [color, setColor] = useState('#6366f1');
  const rootCats = categories.filter((c) => !c.parent_id && c.id !== editingCat?.id);

  const catColor = editingCat?.color || '#6366f1';
  if (color !== catColor && open) setColor(catColor);

  const saveMutation = useMutation({
    mutationFn: (vals) =>
      editingCat
        ? bookmarkCategoryApi.update(editingCat.id, vals)
        : bookmarkCategoryApi.create(vals),
    onSuccess: () => {
      message.success(editingCat ? t('bookmarks.categoryUpdated') : t('bookmarks.categoryCreated'));
      qc.invalidateQueries({ queryKey: ['bookmark-categories'] });
      onClose();
    },
    onError: (e) => message.error(e.message || t('bookmarks.operationFailed')),
  });

  return (
    <Modal
      title={editingCat ? t('bookmarks.editCategory') : t('bookmarks.newCategoryTitle')}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editingCat ? t('bookmarks.saveOk') : t('bookmarks.createOk')}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        key={editingCat?.id ?? 'new'}
        initialValues={{
          name: editingCat?.name,
          parent_id: editingCat?.parent_id ?? undefined,
        }}
        onFinish={(v) => saveMutation.mutate({ ...v, color })}
      >
        <Form.Item name="name" label={t('bookmarks.categoryName')} rules={[{ required: true, message: t('bookmarks.categoryNameRequired') }]}>
          <Input placeholder={t('bookmarks.categoryNamePlaceholder')} />
        </Form.Item>
        <Form.Item name="parent_id" label={t('bookmarks.parentCategory')}>
          <Select
            placeholder={t('bookmarks.parentCategoryPlaceholder')}
            allowClear
            options={rootCats.map((c) => ({
              value: c.id,
              label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0, display: 'inline-block' }} />
                  {c.name}
                </span>
              ),
            }))}
          />
        </Form.Item>
        <Form.Item label={t('bookmarks.color')}>
          <div className="color-picker-row">
            {COLOR_PRESETS.map((c) => (
              <div key={c} className={`color-swatch ${color === c ? 'active' : ''}`}
                style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}

function BookmarkModal({ open, onClose, categories, editingBm }) {
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);

  const bmTags = editingBm?.tags || [];
  if (open && JSON.stringify(tags) !== JSON.stringify(bmTags)) setTags(bmTags);

  const saveMutation = useMutation({
    mutationFn: (vals) => {
      const url = /^https?:\/\//.test(vals.url) ? vals.url : `https://${vals.url}`;
      const payload = { ...vals, url, tags, favicon: getFavicon(url) };
      return editingBm ? bookmarkApi.update(editingBm.id, payload) : bookmarkApi.create(payload);
    },
    onSuccess: () => {
      message.success(editingBm ? t('bookmarks.bookmarkUpdated') : t('bookmarks.bookmarkAdded'));
      qc.invalidateQueries({ queryKey: ['bookmarks'] });
      onClose();
    },
    onError: (e) => message.error(e.message || t('bookmarks.operationFailed')),
  });

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) setTags([...tags, tag]);
    setTagInput('');
  };

  const catOptions = useMemo(() => {
    const roots = categories.filter((c) => !c.parent_id);
    return roots.flatMap((root) => {
      const children = categories.filter((c) => c.parent_id === root.id);
      if (children.length === 0) return [{ value: root.id, label: root.name }];
      return [
        { value: root.id, label: `📁 ${root.name}` },
        ...children.map((c) => ({ value: c.id, label: `    └ ${c.name}` })),
      ];
    });
  }, [categories]);

  return (
    <Modal
      title={editingBm ? t('bookmarks.editBookmark') : t('bookmarks.addBookmarkTitle')}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editingBm ? t('bookmarks.saveOk') : t('bookmarks.createOk')}
      width={520}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        key={editingBm?.id ?? 'new'}
        initialValues={{
          title: editingBm?.title,
          url: editingBm?.url,
          description: editingBm?.description || '',
          category_id: editingBm?.category_id ?? undefined,
        }}
        onFinish={(v) => saveMutation.mutate(v)}
      >
        <Form.Item name="url" label={t('bookmarks.urlLabel')} rules={[{ required: true, message: t('bookmarks.urlRequired') }]}>
          <Input prefix={<LinkOutlined />} placeholder="https://example.com" />
        </Form.Item>
        <Form.Item name="title" label={t('bookmarks.titleLabel')} rules={[{ required: true, message: t('bookmarks.titleRequired') }]}>
          <Input placeholder={t('bookmarks.titlePlaceholder')} />
        </Form.Item>
        <Form.Item name="description" label={t('bookmarks.descriptionLabel')}>
          <Input.TextArea placeholder={t('bookmarks.descriptionPlaceholder')} rows={2} />
        </Form.Item>
        <Form.Item name="category_id" label={t('bookmarks.categoryLabel')}>
          <Select placeholder={t('bookmarks.categoryPlaceholder')} allowClear options={catOptions} />
        </Form.Item>
        <Form.Item label={t('bookmarks.tagsLabel')}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <Input
              placeholder={t('bookmarks.tagsPlaceholder')}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onPressEnter={addTag}
              style={{ flex: 1 }}
            />
            <Button onClick={addTag}>{t('bookmarks.addTagBtn')}</Button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tags.map((tag) => (
              <span key={tag} className="bm-tag" style={{ cursor: 'default' }}>
                {tag}
                <span className="bm-tag-close" onClick={() => setTags(tags.filter((x) => x !== tag))}>×</span>
              </span>
            ))}
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}

function BookmarkCard({ bm, categories, onEdit, onDelete, onTogglePin }) {
  const [imgError, setImgError] = useState(false);
  const { t } = useTranslation();
  const favicon = bm.favicon || getFavicon(bm.url);

  const cat = categories.find((c) => c.id === bm.category_id);
  const parentCat = cat?.parent_id ? categories.find((c) => c.id === cat.parent_id) : null;
  const catLabel = parentCat ? `${parentCat.name} › ${cat.name}` : cat?.name;
  const catColor = parentCat?.color || cat?.color;

  return (
    <div className={`bm-card ${bm.is_pinned ? 'pinned' : ''}`}>
      <div className="bm-card-header">
        <div className="bm-favicon">
          {favicon && !imgError
            ? <img src={favicon} alt="" onError={() => setImgError(true)} />
            : <GlobalOutlined style={{ fontSize: 20, color: '#9ca3af' }} />}
        </div>
        <div className="bm-card-actions">
          <Tooltip title={bm.is_pinned ? t('bookmarks.unpin') : t('bookmarks.pin')}>
            <Button type="text" size="small"
              icon={bm.is_pinned ? <PushpinFilled style={{ color: '#6366f1' }} /> : <PushpinOutlined />}
              onClick={() => onTogglePin(bm)} />
          </Tooltip>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEdit(bm)} />
          <Popconfirm
            title={t('bookmarks.deleteConfirm')}
            onConfirm={() => onDelete(bm.id)}
            okText={t('bookmarks.deleteOk')}
            cancelText={t('bookmarks.deleteCancel')}
            okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </div>
      </div>

      <a className="bm-title" href={bm.url} target="_blank" rel="noopener noreferrer">
        {bm.title}
      </a>
      <div className="bm-domain">{getDomain(bm.url)}</div>
      {bm.description && <div className="bm-desc">{bm.description}</div>}

      <div className="bm-footer">
        {catLabel && (
          <span className="bm-cat-badge" style={{ borderColor: `${catColor}40`, color: catColor, background: `${catColor}12` }}>
            {catLabel}
          </span>
        )}
        {bm.tags?.map((tag) => (
          <span key={tag} className="bm-tag">{tag}</span>
        ))}
      </div>
    </div>
  );
}

export default function BookmarksPage() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [activeCatId, setActiveCatId] = useState(null);
  const [bmModalOpen, setBmModalOpen] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingBm, setEditingBm] = useState(null);
  const [editingCat, setEditingCat] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareLinksOpen, setShareLinksOpen] = useState(false);

  const { data: catData, isLoading: catsLoading } = useQuery({
    queryKey: ['bookmark-categories'],
    queryFn: bookmarkCategoryApi.list,
  });

  const { data: bmData, isLoading: bmsLoading } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => bookmarkApi.list({}),
  });

  const categories = useMemo(() => catData?.categories || [], [catData]);
  const allBookmarks = useMemo(() => bmData?.bookmarks || [], [bmData]);

  const selectedIds = useMemo(() => {
    if (activeCatId === null) return null;
    const children = categories.filter((c) => c.parent_id === activeCatId).map((c) => c.id);
    return new Set([activeCatId, ...children]);
  }, [activeCatId, categories]);

  const bookmarks = useMemo(() => {
    let list = allBookmarks;
    if (selectedIds !== null) list = list.filter((bm) => selectedIds.has(bm.category_id));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((bm) =>
        bm.title.toLowerCase().includes(q) ||
        bm.url.toLowerCase().includes(q) ||
        (bm.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [allBookmarks, selectedIds, search]);

  const rootCats = categories.filter((c) => !c.parent_id);

  const allCountMap = useMemo(() => {
    const map = {};
    allBookmarks.forEach((bm) => {
      if (bm.category_id) map[bm.category_id] = (map[bm.category_id] || 0) + 1;
    });
    return map;
  }, [allBookmarks]);

  const deleteMutation = useMutation({
    mutationFn: bookmarkApi.delete,
    onSuccess: () => { message.success(t('bookmarks.deleted')); qc.invalidateQueries({ queryKey: ['bookmarks'] }); },
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, is_pinned }) => bookmarkApi.update(id, { is_pinned: !is_pinned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookmarks'] }),
  });

  const deleteCatMutation = useMutation({
    mutationFn: bookmarkCategoryApi.delete,
    onSuccess: () => {
      message.success(t('bookmarks.categoryDeleted'));
      qc.invalidateQueries({ queryKey: ['bookmark-categories'] });
      if (activeCatId !== null) setActiveCatId(null);
    },
  });

  const openAddBm = () => { setEditingBm(null); setBmModalOpen(true); };
  const openEditBm = (bm) => { setEditingBm(bm); setBmModalOpen(true); };
  const openAddCat = () => { setEditingCat(null); setCatModalOpen(true); };
  const openEditCat = (cat) => { setEditingCat(cat); setCatModalOpen(true); };

  const activeCatName = activeCatId === null
    ? t('bookmarks.allBookmarks')
    : categories.find((c) => c.id === activeCatId)?.name || t('bookmarks.allBookmarks');

  return (
    <div className="bookmarks-page">
      <aside className="bm-sidebar">
        <div className="bm-sidebar-header">
          <span className="bm-sidebar-title">{t('bookmarks.title')}</span>
          <Tooltip title={t('bookmarks.newCategory')}>
            <Button type="text" size="small" icon={<PlusOutlined />} onClick={openAddCat} />
          </Tooltip>
        </div>

        <div className="bm-cat-list">
          <div className={`bm-cat-item root ${activeCatId === null ? 'active' : ''}`}
            onClick={() => setActiveCatId(null)}>
            <GlobalOutlined className="bm-cat-icon" />
            <span className="bm-cat-name">{t('bookmarks.allBookmarks')}</span>
            <span className="bm-cat-count">{allBookmarks.length || ''}</span>
          </div>

          {catsLoading ? (
            <div style={{ padding: '12px', textAlign: 'center' }}><Spin size="small" /></div>
          ) : rootCats.length === 0 ? (
            <div className="bm-cat-empty">{t('bookmarks.emptyCategories')}</div>
          ) : rootCats.map((root) => {
            const children = categories.filter((c) => c.parent_id === root.id);
            const rootDirect = allCountMap[root.id] || 0;
            const childTotal = children.reduce((s, c) => s + (allCountMap[c.id] || 0), 0);
            const total = rootDirect + childTotal;

            return (
              <div key={root.id}>
                <div className={`bm-cat-item root ${activeCatId === root.id ? 'active' : ''}`}
                  onClick={() => setActiveCatId(root.id)}>
                  <span className="bm-cat-dot" style={{ background: root.color }} />
                  {children.length > 0
                    ? <FolderOpenOutlined style={{ color: root.color, fontSize: 14 }} />
                    : <FolderOutlined style={{ color: root.color, fontSize: 14 }} />}
                  <span className="bm-cat-name">{root.name}</span>
                  {total > 0 && <span className="bm-cat-count">{total}</span>}
                  <div className="bm-cat-ops" onClick={(e) => e.stopPropagation()}>
                    <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditCat(root)} />
                    <Popconfirm
                      title={t('bookmarks.deleteCategoryConfirm')}
                      onConfirm={() => deleteCatMutation.mutate(root.id)}
                      okText={t('bookmarks.deleteOk')}
                      cancelText={t('bookmarks.deleteCancel')}
                      okButtonProps={{ danger: true }}
                    >
                      <Button type="text" size="small" icon={<DeleteOutlined />} danger />
                    </Popconfirm>
                  </div>
                </div>

                {children.map((child) => (
                  <div key={child.id}
                    className={`bm-cat-item child ${activeCatId === child.id ? 'active' : ''}`}
                    onClick={() => setActiveCatId(child.id)}>
                    <span style={{ width: 16, flexShrink: 0 }} />
                    <span className="bm-cat-dot" style={{ background: child.color }} />
                    <span className="bm-cat-name">{child.name}</span>
                    {allCountMap[child.id] > 0 && <span className="bm-cat-count">{allCountMap[child.id]}</span>}
                    <div className="bm-cat-ops" onClick={(e) => e.stopPropagation()}>
                      <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditCat(child)} />
                      <Popconfirm
                        title={t('bookmarks.deleteSubCategoryConfirm')}
                        onConfirm={() => deleteCatMutation.mutate(child.id)}
                        okText={t('bookmarks.deleteOk')}
                        cancelText={t('bookmarks.deleteCancel')}
                        okButtonProps={{ danger: true }}
                      >
                        <Button type="text" size="small" icon={<DeleteOutlined />} danger />
                      </Popconfirm>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </aside>

      <main className="bm-main">
        <div className="bm-topbar">
          <div className="bm-topbar-left">
            <h2 className="bm-page-title">{activeCatName}</h2>
            <span className="bm-count-badge">{t('bookmarks.count', { count: bookmarks.length })}</span>
          </div>
          <Space>
            <Input
              prefix={<SearchOutlined />}
              placeholder={t('bookmarks.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ width: 220 }}
            />
            <Tooltip title={t('bookmarkShare.newShare')}>
              <Button icon={<ShareAltOutlined />} onClick={() => setShareModalOpen(true)} />
            </Tooltip>
            <Tooltip title={t('bookmarkShare.manageLinks')}>
              <Button icon={<LinkOutlined />} onClick={() => setShareLinksOpen(true)} />
            </Tooltip>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openAddBm}
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none' }}
            >
              {t('bookmarks.addBookmark')}
            </Button>
          </Space>
        </div>

        {bmsLoading ? (
          <div className="bm-loading"><Spin size="large" /></div>
        ) : bookmarks.length === 0 ? (
          <div className="bm-empty">
            <Empty description={search ? t('bookmarks.notFound') : t('bookmarks.emptyBookmarks')}>
              {!search && (
                <Button type="primary" icon={<PlusOutlined />} onClick={openAddBm}>
                  {t('bookmarks.addFirstBookmark')}
                </Button>
              )}
            </Empty>
          </div>
        ) : (
          <div className="bm-grid">
            {bookmarks.map((bm) => (
              <BookmarkCard key={bm.id} bm={bm} categories={categories}
                onEdit={openEditBm}
                onDelete={(id) => deleteMutation.mutate(id)}
                onTogglePin={(bm) => pinMutation.mutate(bm)} />
            ))}
          </div>
        )}
      </main>

      <BookmarkModal open={bmModalOpen}
        onClose={() => { setBmModalOpen(false); setEditingBm(null); }}
        categories={categories} editingBm={editingBm} />
      <CategoryModal open={catModalOpen}
        onClose={() => { setCatModalOpen(false); setEditingCat(null); }}
        categories={categories} editingCat={editingCat} />
      <BookmarkShareModal open={shareModalOpen} onClose={() => setShareModalOpen(false)} />
      <BookmarkShareLinksModal open={shareLinksOpen} onClose={() => setShareLinksOpen(false)} />
    </div>
  );
}
