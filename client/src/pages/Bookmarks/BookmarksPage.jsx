import { useState, useMemo } from 'react';
import {
  Button, Input, Modal, Form, Select, Tooltip, Popconfirm,
  Empty, Spin, message, Space,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  LinkOutlined, PushpinOutlined, PushpinFilled,
  FolderOutlined, FolderOpenOutlined, GlobalOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookmarkApi, bookmarkCategoryApi } from '../../services/api';
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

// ─── Category Modal ────────────────────────────────────────
function CategoryModal({ open, onClose, categories, editingCat }) {
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const [color, setColor] = useState('#6366f1');
  // Only root cats can be parents, and exclude the category being edited itself
  const rootCats = categories.filter((c) => !c.parent_id && c.id !== editingCat?.id);

  const catColor = editingCat?.color || '#6366f1';
  // sync color when modal opens with a different category
  if (color !== catColor && open) setColor(catColor);

  const saveMutation = useMutation({
    mutationFn: (vals) =>
      editingCat
        ? bookmarkCategoryApi.update(editingCat.id, vals)
        : bookmarkCategoryApi.create(vals),
    onSuccess: () => {
      message.success(editingCat ? '分类已更新' : '分类已创建');
      qc.invalidateQueries({ queryKey: ['bookmark-categories'] });
      onClose();
    },
    onError: (e) => message.error(e.message || '操作失败'),
  });

  return (
    <Modal title={editingCat ? '编辑分类' : '新建分类'} open={open}
      onCancel={onClose} onOk={() => form.submit()}
      okText={editingCat ? '保存' : '创建'} destroyOnClose>
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
        <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="例：工具、学习资源" />
        </Form.Item>
        <Form.Item name="parent_id" label="父分类（选择后为二级分类）">
          <Select placeholder="不选则为一级分类" allowClear
            options={rootCats.map((c) => ({
              value: c.id,
              label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0, display: 'inline-block' }} />
                  {c.name}
                </span>
              ),
            }))} />
        </Form.Item>
        <Form.Item label="颜色">
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

// ─── Bookmark Modal ────────────────────────────────────────
function BookmarkModal({ open, onClose, categories, editingBm }) {
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);

  const bmTags = editingBm?.tags || [];
  // sync tags when modal opens with a different bookmark
  if (open && JSON.stringify(tags) !== JSON.stringify(bmTags)) setTags(bmTags);

  const saveMutation = useMutation({
    mutationFn: (vals) => {
      const url = /^https?:\/\//.test(vals.url) ? vals.url : `https://${vals.url}`;
      const payload = { ...vals, url, tags, favicon: getFavicon(url) };
      return editingBm ? bookmarkApi.update(editingBm.id, payload) : bookmarkApi.create(payload);
    },
    onSuccess: () => {
      message.success(editingBm ? '书签已更新' : '书签已添加');
      qc.invalidateQueries({ queryKey: ['bookmarks'] });
      onClose();
    },
    onError: (e) => message.error(e.message || '操作失败'),
  });

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  // Build grouped options showing hierarchy
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
    <Modal title={editingBm ? '编辑书签' : '添加书签'} open={open}
      onCancel={onClose} onOk={() => form.submit()}
      okText={editingBm ? '保存' : '添加'} width={520} destroyOnClose>
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
        <Form.Item name="url" label="网址" rules={[{ required: true, message: '请输入网址' }]}>
          <Input prefix={<LinkOutlined />} placeholder="https://example.com" />
        </Form.Item>
        <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
          <Input placeholder="网站标题" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea placeholder="一句话描述这个网站…" rows={2} />
        </Form.Item>
        <Form.Item name="category_id" label="分类">
          <Select placeholder="选择分类" allowClear options={catOptions} />
        </Form.Item>
        <Form.Item label="标签">
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <Input placeholder="输入标签后回车" value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onPressEnter={addTag} style={{ flex: 1 }} />
            <Button onClick={addTag}>添加</Button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tags.map((t) => (
              <span key={t} className="bm-tag" style={{ cursor: 'default' }}>
                {t}
                <span className="bm-tag-close" onClick={() => setTags(tags.filter((x) => x !== t))}>×</span>
              </span>
            ))}
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ─── Bookmark Card ─────────────────────────────────────────
function BookmarkCard({ bm, categories, onEdit, onDelete, onTogglePin }) {
  const [imgError, setImgError] = useState(false);
  const favicon = bm.favicon || getFavicon(bm.url);

  // Build breadcrumb: ParentCat > SubCat  or just Cat
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
          <Tooltip title={bm.is_pinned ? '取消置顶' : '置顶'}>
            <Button type="text" size="small"
              icon={bm.is_pinned ? <PushpinFilled style={{ color: '#6366f1' }} /> : <PushpinOutlined />}
              onClick={() => onTogglePin(bm)} />
          </Tooltip>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEdit(bm)} />
          <Popconfirm title="确定删除这个书签？" onConfirm={() => onDelete(bm.id)}
            okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
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
        {bm.tags?.map((t) => (
          <span key={t} className="bm-tag">{t}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────
export default function BookmarksPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeCatId, setActiveCatId] = useState(null);
  const [bmModalOpen, setBmModalOpen] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingBm, setEditingBm] = useState(null);
  const [editingCat, setEditingCat] = useState(null);

  const { data: catData, isLoading: catsLoading } = useQuery({
    queryKey: ['bookmark-categories'],
    queryFn: bookmarkCategoryApi.list,
  });

  // Always fetch all bookmarks, filter client-side
  const { data: bmData, isLoading: bmsLoading } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => bookmarkApi.list({}),
  });

  const categories = useMemo(() => catData?.categories || [], [catData]);
  const allBookmarks = useMemo(() => bmData?.bookmarks || [], [bmData]);

  // Compute which category IDs are "selected" (includes children when root selected)
  const selectedIds = useMemo(() => {
    if (activeCatId === null) return null; // null means all
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

  // Count per category from all bookmarks
  const allCountMap = useMemo(() => {
    const map = {};
    allBookmarks.forEach((bm) => {
      if (bm.category_id) map[bm.category_id] = (map[bm.category_id] || 0) + 1;
    });
    return map;
  }, [allBookmarks]);


  const deleteMutation = useMutation({
    mutationFn: bookmarkApi.delete,
    onSuccess: () => { message.success('已删除'); qc.invalidateQueries({ queryKey: ['bookmarks'] }); },
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, is_pinned }) => bookmarkApi.update(id, { is_pinned: !is_pinned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookmarks'] }),
  });

  const deleteCatMutation = useMutation({
    mutationFn: bookmarkCategoryApi.delete,
    onSuccess: () => {
      message.success('分类已删除');
      qc.invalidateQueries({ queryKey: ['bookmark-categories'] });
      if (activeCatId !== null) setActiveCatId(null);
    },
  });

  const openAddBm = () => { setEditingBm(null); setBmModalOpen(true); };
  const openEditBm = (bm) => { setEditingBm(bm); setBmModalOpen(true); };
  const openAddCat = () => { setEditingCat(null); setCatModalOpen(true); };
  const openEditCat = (cat) => { setEditingCat(cat); setCatModalOpen(true); };

  const activeCatName = activeCatId === null ? '全部书签'
    : categories.find((c) => c.id === activeCatId)?.name || '书签';

  return (
    <div className="bookmarks-page">
      {/* ─── Sidebar ─── */}
      <aside className="bm-sidebar">
        <div className="bm-sidebar-header">
          <span className="bm-sidebar-title">书签分类</span>
          <Tooltip title="新建分类">
            <Button type="text" size="small" icon={<PlusOutlined />} onClick={openAddCat} />
          </Tooltip>
        </div>

        <div className="bm-cat-list">
          <div className={`bm-cat-item root ${activeCatId === null ? 'active' : ''}`}
            onClick={() => setActiveCatId(null)}>
            <GlobalOutlined className="bm-cat-icon" />
            <span className="bm-cat-name">全部书签</span>
            <span className="bm-cat-count">{allBookmarks.length || ''}</span>
          </div>

          {catsLoading ? (
            <div style={{ padding: '12px', textAlign: 'center' }}><Spin size="small" /></div>
          ) : rootCats.length === 0 ? (
            <div className="bm-cat-empty">暂无分类，点击 + 新建</div>
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
                    <Popconfirm title="删除此分类？子分类也会一起删除。"
                      onConfirm={() => deleteCatMutation.mutate(root.id)}
                      okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
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
                      <Popconfirm title="删除此子分类？"
                        onConfirm={() => deleteCatMutation.mutate(child.id)}
                        okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
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

      {/* ─── Main ─── */}
      <main className="bm-main">
        <div className="bm-topbar">
          <div className="bm-topbar-left">
            <h2 className="bm-page-title">{activeCatName}</h2>
            <span className="bm-count-badge">{bookmarks.length} 个</span>
          </div>
          <Space>
            <Input prefix={<SearchOutlined />} placeholder="搜索书签…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              allowClear style={{ width: 220 }} />
            <Button type="primary" icon={<PlusOutlined />} onClick={openAddBm}
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none' }}>
              添加书签
            </Button>
          </Space>
        </div>

        {bmsLoading ? (
          <div className="bm-loading"><Spin size="large" /></div>
        ) : bookmarks.length === 0 ? (
          <div className="bm-empty">
            <Empty description={search ? '没有找到匹配的书签' : '还没有书签，点击右上角添加吧'}>
              {!search && <Button type="primary" icon={<PlusOutlined />} onClick={openAddBm}>添加第一个书签</Button>}
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
    </div>
  );
}
