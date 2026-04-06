import { useState, useEffect, Fragment } from 'react';
import {
  Layout, Button, Input, Select, Space, Typography, Empty,
  Spin, message, Tooltip, Row, Col, Badge, Segmented, Modal, Form, Popover, Dropdown,
} from 'antd';
import {
  PlusOutlined, AppstoreOutlined, UnorderedListOutlined, HolderOutlined,
  RightOutlined, DownOutlined, EditOutlined, ShareAltOutlined, UnorderedListOutlined as ListIcon,
  SettingOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { todoApi, categoryApi } from '../../services/api';
import TodoCard from '../../components/TodoCard/TodoCard';
import TodoEditor from '../../components/TodoEditor/TodoEditor';
import ShareModal from '../../components/ShareModal/ShareModal';
import ShareLinksModal from '../../components/ShareLinksModal/ShareLinksModal';
import './TodoList.css';

const { Text, Title } = Typography;
const { Search } = Input;

const STATUS_FILTERS = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
];

const PRIORITY_FILTERS = [
  { value: '', label: '全部优先级' },
  { value: 'urgent', label: '🔴 紧急' },
  { value: 'high', label: '🟠 高' },
  { value: 'medium', label: '🟡 中' },
  { value: 'low', label: '🟢 低' },
];

const PRESET_COLORS = [
  '#6366f1', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b',
];

function randomCategoryColor() {
  return PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
}

function ColorSwatches({ value, onChange }) {
  return (
    <div className="color-swatches">
      {PRESET_COLORS.map((c) => (
        <span
          key={c}
          className={`color-swatch${value === c ? ' color-swatch--active' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}

export default function TodoList() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filters, setFilters] = useState({ status: '', priority: '', search: '' });
  const [viewMode, setViewMode] = useState('list');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [localCategories, setLocalCategories] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [addingSubFor, setAddingSubFor] = useState(null);
  const [newSubCatName, setNewSubCatName] = useState('');
  const [editingCat, setEditingCat] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareLinksModalOpen, setShareLinksModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryApi.list,
  });

  // When a root category is selected, also fetch todos from its sub-categories
  const selectedCat = localCategories.find((c) => String(c.id) === selectedCategory);
  const isRootSelected = selectedCat && !selectedCat.parent_id;

  const queryParams = {
    ...filters,
    ...(selectedCategory === 'uncategorized'
      ? { uncategorized: 'true' }
      : selectedCategory !== 'all'
        ? { category_id: selectedCategory }
        : {}),
    ...(isRootSelected ? { include_subcategories: 'true' } : {}),
    limit: 100,
  };

  const { data: todosData, isLoading } = useQuery({
    queryKey: ['todos', queryParams],
    queryFn: () => todoApi.list(queryParams),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => todoApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: todoApi.delete,
    onSuccess: () => {
      message.success('已删除');
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const addSubCatMutation = useMutation({
    mutationFn: ({ name, parentId, color }) =>
      categoryApi.create({ name, parent_id: parentId, color }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setAddingSubFor(null);
      setNewSubCatName('');
      setExpandedCategories((prev) => new Set([...prev, variables.parentId]));
    },
    onError: () => message.error('创建失败'),
  });

  const editCatMutation = useMutation({
    mutationFn: ({ id, data }) => categoryApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setEditingCat(null);
    },
    onError: (err) => message.error(err?.response?.data?.message || '更新失败'),
  });

  const categories = categoriesData?.categories || [];
  const uncategorizedPendingCount = categoriesData?.uncategorized_pending_count ?? 0;
  const totalPendingCount = categories.reduce((sum, c) => sum + (c.pending_count || 0), 0) + uncategorizedPendingCount;
  const todos = todosData?.todos || [];

  useEffect(() => {
    if (categories.length) {
      const isFirstLoad = localCategories.length === 0;
      setLocalCategories(categories);
      if (isFirstLoad) {
        const childParentIds = new Set(categories.filter((c) => c.parent_id).map((c) => c.parent_id));
        setExpandedCategories(new Set(categories.filter((c) => !c.parent_id && childParentIds.has(c.id)).map((c) => c.id)));
      }
    }
  }, [categories]);

  // Derive tree structure
  const roots = localCategories.filter((c) => !c.parent_id);
  const getChildren = (parentId) => localCategories.filter((c) => c.parent_id === parentId);

  const handleCategoryDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = roots.findIndex((c) => c.id === active.id);
    const newIndex = roots.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reorderedRoots = arrayMove(roots, oldIndex, newIndex);
    const children = localCategories.filter((c) => c.parent_id);
    setLocalCategories([...reorderedRoots, ...children]);
    reorderedRoots.forEach((cat, idx) => {
      categoryApi.update(cat.id, { sort_order: idx + 1 });
    });
  };

  const handleChildDragEnd = (parentId) => ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const siblings = localCategories.filter((c) => c.parent_id === parentId);
    const oldIndex = siblings.findIndex((c) => c.id === active.id);
    const newIndex = siblings.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(siblings, oldIndex, newIndex);
    const others = localCategories.filter((c) => c.parent_id !== parentId);
    setLocalCategories([...others, ...reordered]);
    reordered.forEach((cat, idx) => categoryApi.update(cat.id, { sort_order: idx + 1 }));
  };

  const handleSelectCategory = (id) => {
    setSelectedCategory(id);
    // Auto-expand parent when a child is selected
    const cat = localCategories.find((c) => String(c.id) === id);
    if (cat?.parent_id) {
      setExpandedCategories((prev) => new Set([...prev, cat.parent_id]));
    }
  };

  const handleToggleExpand = (catId) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(catId) ? next.delete(catId) : next.add(catId);
      return next;
    });
  };

  const handleStartAddSub = (cat) => {
    setAddingSubFor(cat.id);
    setNewSubCatName('');
    setExpandedCategories((prev) => new Set([...prev, cat.id]));
  };

  const handleSubmitSubCat = (parentCat) => {
    if (newSubCatName.trim()) {
      addSubCatMutation.mutate({
        name: newSubCatName.trim(),
        parentId: parentCat.id,
        color: randomCategoryColor(),
      });
    }
  };

  const handleEdit = (todo) => {
    setEditingTodoId(todo.id);
    setEditorOpen(true);
  };

  const handleNew = () => {
    setEditingTodoId(null);
    setEditorOpen(true);
  };

  const currentCategoryColor = localCategories.find((c) => String(c.id) === selectedCategory)?.color;
  const currentCategoryName = localCategories.find((c) => String(c.id) === selectedCategory)?.name;

  return (
    <div className="todo-list-page fade-in">
      <Layout style={{ background: 'transparent', gap: 16 }}>
        {/* Category sidebar */}
        <Layout.Sider width={260} className="category-sider" style={{ background: 'transparent' }}>
          <div className="category-panel">
            <div className="category-header">
              <span className="category-header-label">分类</span>
              <AddCategoryButton onAdd={() => queryClient.invalidateQueries({ queryKey: ['categories'] })} />
            </div>
            <nav className="category-nav">
              {/* All */}
              <div
                className={`cat-nav-item${selectedCategory === 'all' ? ' cat-nav-item--selected' : ''}`}
                onClick={() => handleSelectCategory('all')}
              >
                <div className="cat-nav-item-left">
                  <span className="cat-expand-toggle" style={{ visibility: 'hidden' }} />
                  <UnorderedListOutlined className="cat-nav-icon" style={{ fontSize: 12 }} />
                  <span>全部</span>
                </div>
                {totalPendingCount > 0 && (
                  <span className="cat-count">{totalPendingCount}</span>
                )}
              </div>

              {/* Root categories (sortable) */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleCategoryDragEnd}
              >
                <SortableContext
                  items={roots.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {roots.map((cat) => {
                    const children = getChildren(cat.id);
                    const isExpanded = expandedCategories.has(cat.id);
                    return (
                      <Fragment key={cat.id}>
                        <SortableRootCatItem
                          cat={cat}
                          selected={selectedCategory === String(cat.id)}
                          onClick={() => handleSelectCategory(String(cat.id))}
                          hasChildren={children.length > 0}
                          isExpanded={isExpanded}
                          onToggle={() => handleToggleExpand(cat.id)}
                          onAddSub={() => handleStartAddSub(cat)}
                          onEdit={() => setEditingCat(cat)}
                        />
                        {/* Children (visible when expanded) */}
                        {isExpanded && (
                          <>
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={handleChildDragEnd(cat.id)}
                            >
                              <SortableContext
                                items={children.map((c) => c.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                {children.map((child) => (
                                  <SortableChildCatItem
                                    key={child.id}
                                    cat={child}
                                    selected={selectedCategory === String(child.id)}
                                    onClick={() => handleSelectCategory(String(child.id))}
                                    onEdit={() => setEditingCat(child)}
                                  />
                                ))}
                              </SortableContext>
                            </DndContext>
                            {/* Inline sub-category input */}
                            {addingSubFor === cat.id && (
                              <div className="cat-nav-item cat-nav-item--child cat-nav-item--adding">
                                <Input
                                  size="small"
                                  placeholder="子分类名称"
                                  value={newSubCatName}
                                  onChange={(e) => setNewSubCatName(e.target.value)}
                                  onPressEnter={() => handleSubmitSubCat(cat)}
                                  onBlur={() => {
                                    if (!newSubCatName.trim()) {
                                      setAddingSubFor(null);
                                    }
                                  }}
                                  autoFocus
                                  style={{ fontSize: 12 }}
                                />
                                <Button
                                  size="small"
                                  type="text"
                                  style={{ color: '#6366f1', padding: '0 4px' }}
                                  onClick={() => handleSubmitSubCat(cat)}
                                  loading={addSubCatMutation.isPending}
                                >
                                  确认
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </Fragment>
                    );
                  })}
                </SortableContext>
              </DndContext>

              {/* Uncategorized (fixed, always at bottom) */}
              <div
                className={`cat-nav-item cat-nav-item--uncategorized${selectedCategory === 'uncategorized' ? ' cat-nav-item--selected' : ''}`}
                onClick={() => handleSelectCategory('uncategorized')}
              >
                <div className="cat-nav-item-left">
                  <span className="cat-expand-toggle" style={{ visibility: 'hidden' }} />
                  <span className="cat-dot cat-dot--uncategorized" />
                  <span>未分类</span>
                </div>
                {uncategorizedPendingCount > 0 && (
                  <span className="cat-count" style={{ background: '#f1f5f9', color: '#9ca3af' }}>
                    {uncategorizedPendingCount}
                  </span>
                )}
              </div>
            </nav>
          </div>
        </Layout.Sider>

        {/* Main content */}
        <Layout.Content>
          <div className="todo-toolbar">
            <div className="toolbar-left">
              <div className="page-title">
                {selectedCategory === 'all' ? (
                  <Title level={4} style={{ margin: 0, color: '#e2e8f0' }}>全部 TODO</Title>
                ) : selectedCategory === 'uncategorized' ? (
                  <Title level={4} style={{ margin: 0, color: '#e2e8f0' }}>未分类</Title>
                ) : (
                  <Title level={4} style={{ margin: 0, color: '#e2e8f0' }}>
                    <span className="cat-badge" style={{ background: currentCategoryColor }} />
                    {currentCategoryName || '分类'}
                  </Title>
                )}
              </div>
            </div>
            <Space wrap className="toolbar-right">
              <Search
                placeholder="搜索..."
                allowClear
                style={{ width: 180 }}
                onSearch={(v) => setFilters((f) => ({ ...f, search: v }))}
                onChange={(e) => !e.target.value && setFilters((f) => ({ ...f, search: '' }))}
              />
              <Select
                value={filters.status}
                onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
                options={STATUS_FILTERS}
                style={{ width: 110 }}
              />
              <Select
                value={filters.priority}
                onChange={(v) => setFilters((f) => ({ ...f, priority: v }))}
                options={PRIORITY_FILTERS}
                style={{ width: 120 }}
              />
              <Segmented
                value={viewMode}
                onChange={setViewMode}
                options={[
                  { value: 'list', icon: <UnorderedListOutlined /> },
                  { value: 'kanban', icon: <AppstoreOutlined /> },
                ]}
              />
              <Button
                icon={<ShareAltOutlined />}
                onClick={() => setShareModalOpen(true)}
                style={{ color: '#22c55e', borderColor: '#22c55e' }}
              >
                新建分享
              </Button>
              <Button
                icon={<SettingOutlined />}
                onClick={() => setShareLinksModalOpen(true)}
                style={{ color: '#22c55e', borderColor: '#22c55e' }}
              >
                管理链接
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleNew}
                className="btn-primary"
              >
                新建
              </Button>
            </Space>
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', paddingTop: 60 }}>
              <Spin size="large" />
            </div>
          ) : todos.length === 0 ? (
            <Empty
              description={<Text type="secondary">暂无 TODO，点击新建开始吧</Text>}
              style={{ paddingTop: 80 }}
            >
              <Button type="primary" onClick={handleNew} icon={<PlusOutlined />}>
                新建 TODO
              </Button>
            </Empty>
          ) : viewMode === 'list' ? (
            <ListView
              todos={todos}
              onEdit={handleEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
              onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
            />
          ) : (
            <KanbanView
              todos={todos}
              onEdit={handleEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
              onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
            />
          )}
        </Layout.Content>
      </Layout>

      <TodoEditor
        todoId={editingTodoId}
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingTodoId(null); }}
        defaultCategoryId={
          selectedCategory !== 'all' && selectedCategory !== 'uncategorized'
            ? Number(selectedCategory)
            : undefined
        }
      />

      <CategoryEditModal
        cat={editingCat}
        allCategories={localCategories}
        open={!!editingCat}
        onClose={() => setEditingCat(null)}
        onSave={(id, data) => editCatMutation.mutate({ id, data })}
        saving={editCatMutation.isPending}
      />

      <ShareModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />

      <ShareLinksModal
        open={shareLinksModalOpen}
        onClose={() => setShareLinksModalOpen(false)}
      />
    </div>
  );
}

function ListView({ todos, onEdit, onDelete, onStatusChange }) {
  const grouped = {
    urgent: todos.filter((t) => t.priority === 'urgent' && t.status !== 'completed'),
    active: todos.filter((t) => t.priority !== 'urgent' && t.status !== 'completed'),
    completed: todos.filter((t) => t.status === 'completed'),
  };

  return (
    <div className="list-view">
      {grouped.urgent.length > 0 && (
        <div className="todo-group">
          <div className="group-header">
            <div className="group-dot" style={{ background: '#ff4d6d' }} />
            紧急 ({grouped.urgent.length})
          </div>
          {grouped.urgent.map((todo) => (
            <TodoCard
              key={todo.id}
              todo={todo}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}
      {grouped.active.length > 0 && (
        <div className="todo-group">
          <div className="group-header">
            <div className="group-dot" style={{ background: '#7c6ef5' }} />
            待完成 ({grouped.active.length})
          </div>
          {grouped.active.map((todo) => (
            <TodoCard
              key={todo.id}
              todo={todo}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}
      {grouped.completed.length > 0 && (
        <div className="todo-group">
          <div className="group-header">
            <div className="group-dot" style={{ background: '#06d6a0' }} />
            已完成 ({grouped.completed.length})
          </div>
          {grouped.completed.map((todo) => (
            <TodoCard
              key={todo.id}
              todo={todo}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KanbanView({ todos, onEdit, onDelete, onStatusChange }) {
  const columns = [
    { key: 'pending', title: '待处理', color: '#94a3b8', todos: todos.filter((t) => t.status === 'pending') },
    { key: 'in_progress', title: '进行中', color: '#6366f1', todos: todos.filter((t) => t.status === 'in_progress') },
    { key: 'completed', title: '已完成', color: '#22c55e', todos: todos.filter((t) => t.status === 'completed') },
  ];

  return (
    <Row gutter={12} className="kanban-view">
      {columns.map((col) => (
        <Col key={col.key} xs={24} sm={8}>
          <div className="kanban-column">
            <div className="kanban-header" style={{ borderLeft: `3px solid ${col.color}` }}>
              <Text style={{ color: col.color, fontWeight: 600 }}>{col.title}</Text>
              <Badge count={col.todos.length} showZero color={col.color} />
            </div>
            <div className="kanban-items">
              {col.todos.length === 0 ? (
                <div className="kanban-empty">暂无任务</div>
              ) : (
                col.todos.map((todo) => (
                  <TodoCard
                    key={todo.id}
                    todo={todo}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onStatusChange={onStatusChange}
                    compact
                  />
                ))
              )}
            </div>
          </div>
        </Col>
      ))}
    </Row>
  );
}

// Sortable root category item
function SortableRootCatItem({ cat, selected, onClick, hasChildren, isExpanded, onToggle, onAddSub, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 };

  const actionMenu = {
    items: [
      { key: 'edit', icon: <EditOutlined />, label: '编辑分类', onClick: () => onEdit() },
      { key: 'add', icon: <PlusOutlined />, label: '新增子分类', onClick: () => onAddSub() },
    ],
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className={`cat-nav-item${selected ? ' cat-nav-item--selected' : ''}`} onClick={onClick}>
        <div className="cat-nav-item-left">
          <span
            className="cat-expand-toggle"
            style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
          >
            {isExpanded ? <DownOutlined /> : <RightOutlined />}
          </span>
          <span className="cat-dot" style={{ background: cat.color }} />
          <span className="cat-nav-label">{cat.name}</span>
        </div>
        <div className="cat-nav-item-right">
          {cat.pending_count > 0 && (
            <span className="cat-count" style={{ background: `${cat.color}18`, color: cat.color }}>
              {cat.pending_count}
            </span>
          )}
          <Dropdown menu={actionMenu} trigger={['click']} placement="bottomRight">
            <span className="cat-action-btn cat-more-btn" onClick={(e) => e.stopPropagation()}>
              ···
            </span>
          </Dropdown>
          <span className="cat-drag-handle" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
            <HolderOutlined />
          </span>
        </div>
      </div>
    </div>
  );
}

// Sortable child category item
function SortableChildCatItem({ cat, selected, onClick, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 };

  const actionMenu = {
    items: [
      { key: 'edit', icon: <EditOutlined />, label: '编辑分类', onClick: () => onEdit() },
    ],
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className={`cat-nav-item cat-nav-item--child${selected ? ' cat-nav-item--selected' : ''}`} onClick={onClick}>
        <div className="cat-nav-item-left">
          <span className="cat-expand-toggle" style={{ visibility: 'hidden' }} />
          <span className="cat-dot" style={{ background: cat.color }} />
          <span className="cat-nav-label">{cat.name}</span>
        </div>
        <div className="cat-nav-item-right">
          {cat.pending_count > 0 && (
            <span className="cat-count" style={{ background: `${cat.color}18`, color: cat.color }}>
              {cat.pending_count}
            </span>
          )}
          <Dropdown menu={actionMenu} trigger={['click']} placement="bottomRight">
            <span className="cat-action-btn cat-more-btn" onClick={(e) => e.stopPropagation()}>
              ···
            </span>
          </Dropdown>
          <span className="cat-drag-handle" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
            <HolderOutlined />
          </span>
        </div>
      </div>
    </div>
  );
}

function CategoryEditModal({ cat, allCategories, open, onClose, onSave, saving }) {
  const [form] = Form.useForm();
  const [color, setColor] = useState(cat?.color || PRESET_COLORS[0]);

  useEffect(() => {
    if (open && cat) {
      setColor(cat.color || PRESET_COLORS[0]);
      form.setFieldsValue({
        name: cat.name,
        parent_id: cat.parent_id ?? 'none',
      });
    }
  }, [open, cat, form]);

  const hasChildren = allCategories.some((c) => c.parent_id === cat?.id);
  // Root options: all roots except self
  const rootOptions = allCategories
    .filter((c) => !c.parent_id && c.id !== cat?.id)
    .map((c) => ({
      value: c.id,
      label: (
        <Space size={6}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c.color }} />
          {c.name}
        </Space>
      ),
    }));

  const handleOk = () => {
    form.validateFields().then((values) => {
      const data = { name: values.name, color };
      if (values.parent_id !== undefined) {
        data.parent_id = values.parent_id === 'none' ? null : values.parent_id;
      }
      onSave(cat.id, data);
    });
  };

  return (
    <Modal
      title={
        <Space size={8}>
          <span className="cat-dot" style={{ background: color, width: 10, height: 10, display: 'inline-block', borderRadius: '50%' }} />
          编辑分类
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="保存"
      cancelText="取消"
      confirmLoading={saving}
      width={360}
      forceRender
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入分类名称' }]}>
          <Input placeholder="分类名称" />
        </Form.Item>
        <Form.Item label="颜色">
          <ColorSwatches value={color} onChange={setColor} />
        </Form.Item>
        <Form.Item
          name="parent_id"
          label="归属父分类"
          extra={hasChildren ? '该分类已有子分类，不能再移入其他分类下' : '设为顶层分类，或选择一个父分类将其移入'}
        >
          <Select disabled={hasChildren} options={[{ value: 'none', label: '顶层分类（无父级）' }, ...rootOptions]} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function AddCategoryButton({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(() => randomCategoryColor());
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data) => categoryApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setOpen(false);
      setName('');
      setColor(randomCategoryColor());
      onAdd?.();
    },
    onError: () => message.error('创建失败'),
  });

  const handleCreate = () => {
    if (name.trim()) mutation.mutate({ name: name.trim(), color });
  };

  const handleOpenChange = (v) => {
    if (v) setColor(randomCategoryColor());
    else setName('');
    setOpen(v);
  };

  const content = (
    <div style={{ width: 172 }}>
      <Input
        size="small"
        placeholder="分类名称"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onPressEnter={handleCreate}
        autoFocus
        prefix={<span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
        <Button size="small" onClick={() => { setOpen(false); setName(''); }}>取消</Button>
        <Button size="small" type="primary" onClick={handleCreate} loading={mutation.isPending}>创建</Button>
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
      placement="bottomRight"
    >
      <Tooltip title="新建分类">
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          style={{ color: '#6366f1' }}
        />
      </Tooltip>
    </Popover>
  );
}
