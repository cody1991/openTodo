import { useState, useMemo } from 'react';
import {
  Modal, Steps, Button, Input, Checkbox, Select, DatePicker,
  Tag, Space, Typography, Divider, message, Tooltip, Radio,
  Tree, Badge, Empty,
} from 'antd';
import {
  ShareAltOutlined, EyeOutlined, CopyOutlined, CheckOutlined,
  FolderOutlined, FileTextOutlined, ClockCircleOutlined, FilterOutlined,
  SettingOutlined, LinkOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import dayjs from 'dayjs';
import { categoryApi, todoApi, shareApi } from '../../services/api';
import './ShareModal.css';

const { Text, Title, Paragraph } = Typography;
const { RangePicker } = DatePicker;

function CatDot({ color }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 8, height: 8,
      borderRadius: '50%',
      background: color || '#6366f1',
      flexShrink: 0,
    }} />
  );
}

const STATUS_OPTIONS = [
  { label: '待处理', value: 'pending', color: '#faad14' },
  { label: '进行中', value: 'in_progress', color: '#1677ff' },
  { label: '已完成', value: 'completed', color: '#52c41a' },
];

const EXPIRES_OPTIONS = [
  { label: '30 分钟', value: '30m' },
  { label: '1 小时', value: '1h' },
  { label: '1 天', value: '1d' },
  { label: '7 天', value: '7d' },
  { label: '30 天', value: '30d' },
  { label: '3 个月', value: '90d' },
  { label: '6 个月', value: '180d' },
  { label: '1 年', value: '365d' },
  { label: '永久有效', value: 'never' },
];

// Sentinel value used in edit mode to mean "don't change the current expiry"
const KEEP_EXPIRES = '__keep__';

const DATE_FIELD_OPTIONS = [
  { label: '创建时间', value: 'created_at' },
  { label: '更新时间', value: 'updated_at' },
  { label: '完成时间', value: 'completed_at' },
  { label: '截止时间', value: 'due_date' },
];

const STEPS = [
  { title: '基本信息', icon: <SettingOutlined /> },
  { title: '选择分类', icon: <FolderOutlined /> },
  { title: '屏蔽项目', icon: <FileTextOutlined /> },
  { title: '状态 & 时间', icon: <FilterOutlined /> },
  { title: '有效期', icon: <ClockCircleOutlined /> },
];

const THEMES = [
  {
    value: 'light',
    label: '清爽',
    desc: '白底简洁，清晰易读',
    preview: 'linear-gradient(135deg,#f8fafc 0%,#e0e7ff 100%)',
    accent: '#6366f1',
  },
  {
    value: 'dark',
    label: '深色',
    desc: '深蓝背景，科技感强',
    preview: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%)',
    accent: '#818cf8',
  },
  {
    value: 'vibrant',
    label: '鲜艳',
    desc: '彩色卡片，活泼有趣',
    preview: 'linear-gradient(135deg,#fdf4ff 0%,#ffe4e6 50%,#fef9c3 100%)',
    accent: '#ec4899',
  },
  {
    value: 'minimal',
    label: '极简',
    desc: '去除装饰，专注内容',
    preview: 'linear-gradient(135deg,#ffffff 0%,#f1f5f9 100%)',
    accent: '#334155',
  },
];

export default function ShareModal({ open, onClose, editLink = null }) {
  const isEditMode = !!editLink;
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState(0);
  const [copied, setCopied] = useState(false);
  const [createdLink, setCreatedLink] = useState(null);

  // name/headline are kept in explicit state so they survive step navigation
  // (the Form component unmounts when user moves away from step 0)
  const [name, setName] = useState(editLink?.name ?? '我的分享');
  const [headline, setHeadline] = useState(editLink?.headline ?? '');

  // Initialise from editLink when provided (component is remounted via key when editLink changes)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(editLink?.category_ids ?? null);
  const [excludedTodoIds, setExcludedTodoIds] = useState(editLink?.excluded_todo_ids ?? []);
  const [selectedStatuses, setSelectedStatuses] = useState(
    editLink?.statuses ?? ['pending', 'in_progress', 'completed']
  );
  const [dateField, setDateField] = useState(editLink?.date_field ?? 'created_at');
  const [dateRange, setDateRange] = useState(
    editLink?.date_start && editLink?.date_end
      ? [dayjs(editLink.date_start), dayjs(editLink.date_end)]
      : null
  );
  const [expiresIn, setExpiresIn] = useState(isEditMode ? KEEP_EXPIRES : 'never');
  const [theme, setTheme] = useState(editLink?.theme ?? 'light');


  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryApi.list,
  });

  const { data: todosData } = useQuery({
    queryKey: ['todos', { limit: 200 }],
    queryFn: () => todoApi.list({ limit: 200 }),
    enabled: open,
    staleTime: 0,
  });

  const categories = categoriesData?.categories || [];
  const todos = todosData?.todos || [];

  const createMutation = useMutation({
    mutationFn: shareApi.create,
    onSuccess: (link) => {
      setCreatedLink(link);
      queryClient.invalidateQueries({ queryKey: ['share-links'] });
      message.success('分享链接创建成功！');
    },
    onError: (e) => message.error(e.message || '创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => shareApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['share-links'] });
      message.success('分享链接已更新');
      handleClose();
    },
    onError: (e) => message.error(e.message || '保存失败'),
  });

  const rootCategories = categories.filter((c) => !c.parent_id);
  const getSubCategories = (parentId) => categories.filter((c) => c.parent_id === parentId);

  const categoryTreeData = [
    ...rootCategories.map((parent) => ({
      title: (
        <span className="cat-tree-item">
          <CatDot color={parent.color} />
          <span className="cat-tree-name">{parent.name}</span>
        </span>
      ),
      key: `cat-${parent.id}`,
      value: parent.id,
      children: getSubCategories(parent.id).map((sub) => ({
        title: (
          <span className="cat-tree-item cat-tree-item--sub">
            <CatDot color={sub.color || parent.color} />
            <span className="cat-tree-name">{sub.name}</span>
          </span>
        ),
        key: `cat-${sub.id}`,
        value: sub.id,
      })),
    })),
    {
      title: (
        <span className="cat-tree-item cat-tree-item--uncategorized">
          <CatDot color="#475569" />
          <span className="cat-tree-name">未分类</span>
        </span>
      ),
      key: 'cat--1',
      value: -1,
    },
  ];

  const filteredTodos = useMemo(() => todos, [todos]);

  const handleCategoryCheck = (checkedKeys) => {
    const ids = checkedKeys
      .filter((k) => k.startsWith('cat-'))
      .map((k) => parseInt(k.replace('cat-', '')));
    setSelectedCategoryIds(ids.length === 0 ? null : ids);
    setExcludedTodoIds([]);
  };

  const handleCreate = async () => {
    const payload = {
      name: name.trim() || '我的分享',
      headline: headline.trim() || null,
      category_ids: selectedCategoryIds,
      excluded_todo_ids: excludedTodoIds,
      statuses: selectedStatuses,
      date_field: dateField,
      date_start: dateRange ? dateRange[0].format('YYYY-MM-DD') : null,
      date_end: dateRange ? dateRange[1].format('YYYY-MM-DD') : null,
      ...(expiresIn !== KEEP_EXPIRES && { expires_in: expiresIn }),
      theme,
    };
    if (isEditMode) {
      updateMutation.mutate({ id: editLink.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const getShareUrl = (key) => `${window.location.origin}/share/${key}`;

  const handleCopy = (url) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setCurrent(0);
    setCreatedLink(null);
    setName('我的分享');
    setHeadline('');
    setSelectedCategoryIds(null);
    setExcludedTodoIds([]);
    setSelectedStatuses(['pending', 'in_progress', 'completed']);
    setDateField('created_at');
    setDateRange(null);
    setExpiresIn('never');
    setTheme('light');
  };

  const handleClose = () => {
    if (!isEditMode) handleReset();
    onClose();
  };

  const checkedKeys = selectedCategoryIds
    ? selectedCategoryIds.map((id) => `cat-${id}`)
    : [];

  const renderStep = () => {
    switch (current) {
      case 0:
        return (
          <div className="share-step">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ marginBottom: 6, fontSize: 13, color: '#374151' }}>分享名称</div>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="给这次分享起个名字，方便管理"
                  maxLength={50}
                  showCount
                />
              </div>
              <div>
                <div style={{ marginBottom: 6, fontSize: 13, color: '#374151' }}>简介（显示在分享页顶部）</div>
                <Input.TextArea
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="可选：介绍一下你在做什么，如「这是我2026年Q1的工作进展」"
                  rows={3}
                  maxLength={200}
                  showCount
                />
              </div>
              <div>
                <div style={{ marginBottom: 10, fontSize: 13, color: '#374151', fontWeight: 500 }}>页面主题</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {THEMES.map((t) => (
                    <div
                      key={t.value}
                      onClick={() => setTheme(t.value)}
                      style={{
                        borderRadius: 10,
                        border: `2px solid ${theme === t.value ? t.accent : '#e2e8f0'}`,
                        cursor: 'pointer',
                        overflow: 'hidden',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                        boxShadow: theme === t.value ? `0 0 0 3px ${t.accent}22` : 'none',
                      }}
                    >
                      <div style={{ height: 52, background: t.preview }} />
                      <div style={{ padding: '6px 8px', background: '#fff' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: theme === t.value ? t.accent : '#374151' }}>
                          {t.label}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{t.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="share-step">
            <div className="step-hint">
              <Text type="secondary">不选则分享全部分类。勾选后只分享选中的分类。</Text>
            </div>
            <div className="category-tree-wrap">
              {categoryTreeData.length === 0 ? (
                <Empty description="暂无分类" />
              ) : (
                <Tree
                  checkable
                  treeData={categoryTreeData}
                  checkedKeys={checkedKeys}
                  onCheck={handleCategoryCheck}
                  defaultExpandAll
                />
              )}
            </div>
            <div className="selection-summary">
              {selectedCategoryIds === null ? (
                <Tag color="blue">分享全部分类</Tag>
              ) : (
                <Tag color="purple">已选 {selectedCategoryIds.length} 个分类</Tag>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="share-step">
            <div className="step-hint">
              <Text type="secondary">勾选要屏蔽的项目，被屏蔽的项目不会出现在分享页中。</Text>
            </div>
            {filteredTodos.length === 0 ? (
              <Empty description="该筛选条件下没有待分享的 TODO" />
            ) : (
              <Checkbox.Group
                value={excludedTodoIds}
                onChange={setExcludedTodoIds}
                className="exclude-todo-list"
              >
                {filteredTodos.map((todo) => (
                  <div key={todo.id} className="exclude-todo-item">
                    <Checkbox value={todo.id}>
                      <Space size={6}>
                        <span>{todo.title}</span>
                        {todo.category_name && (
                          <Tag
                            color={todo.category_color}
                            style={{ fontSize: 11, padding: '0 4px' }}
                          >
                            {todo.category_name}
                          </Tag>
                        )}
                      </Space>
                    </Checkbox>
                  </div>
                ))}
              </Checkbox.Group>
            )}
            {excludedTodoIds.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <Tag color="red">已屏蔽 {excludedTodoIds.length} 个项目</Tag>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="share-step">
            <div className="share-step-section">
              <Text strong>分享哪些状态</Text>
              <div style={{ marginTop: 8 }}>
                <Checkbox.Group
                  options={STATUS_OPTIONS.map((s) => ({
                    label: <Tag color={s.color}>{s.label}</Tag>,
                    value: s.value,
                  }))}
                  value={selectedStatuses}
                  onChange={setSelectedStatuses}
                />
              </div>
            </div>
            <Divider />
            <div className="share-step-section">
              <Text strong>时间范围筛选（可选）</Text>
              <div style={{ marginTop: 8 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Select
                    value={dateField}
                    onChange={setDateField}
                    options={DATE_FIELD_OPTIONS}
                    style={{ width: 180 }}
                  />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { label: '全部', range: () => null },
                      { label: '今天', range: () => [dayjs().startOf('day'), dayjs().endOf('day')] },
                      { label: '本周', range: () => [dayjs().startOf('week'), dayjs().endOf('week')] },
                      { label: '本月', range: () => [dayjs().startOf('month'), dayjs().endOf('month')] },
                      { label: '最近 7 天', range: () => [dayjs().subtract(6, 'day').startOf('day'), dayjs().endOf('day')] },
                      { label: '最近 30 天', range: () => [dayjs().subtract(29, 'day').startOf('day'), dayjs().endOf('day')] },
                      { label: '最近 3 月', range: () => [dayjs().subtract(3, 'month').startOf('day'), dayjs().endOf('day')] },
                    ].map(({ label, range }) => {
                      const r = range();
                      const isAll = r === null;
                      const active = isAll
                        ? !dateRange
                        : dateRange && dateRange[0] && dateRange[1]
                          && dateRange[0].isSame(r[0], 'day') && dateRange[1].isSame(r[1], 'day');
                      return (
                        <Button
                          key={label}
                          size="small"
                          type={active ? 'primary' : 'default'}
                          onClick={() => setDateRange(isAll ? null : r)}
                          style={{ borderRadius: 12, fontSize: 12 }}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                  <RangePicker
                    value={dateRange}
                    onChange={setDateRange}
                    placeholder={['开始日期', '结束日期']}
                    style={{ width: '100%' }}
                  />
                </Space>
              </div>
            </div>
          </div>
        );

      case 4: {
        const currentExpiry = isEditMode && editLink.expires_at;
        const expiresOptions = isEditMode
          ? [{ label: '保持不变', value: KEEP_EXPIRES }, ...EXPIRES_OPTIONS]
          : EXPIRES_OPTIONS;
        return (
          <div className="share-step">
            <div className="step-hint">
              <Text type="secondary">超过有效期后分享链接将自动失效。</Text>
              {isEditMode && currentExpiry && (
                <div style={{ marginTop: 6 }}>
                  <Tag color={dayjs(editLink.expires_at).isBefore(dayjs()) ? 'red' : 'blue'}>
                    当前有效期至 {dayjs(editLink.expires_at).format('YYYY-MM-DD HH:mm')}
                  </Tag>
                </div>
              )}
              {isEditMode && !currentExpiry && (
                <div style={{ marginTop: 6 }}>
                  <Tag color="green">当前永久有效</Tag>
                </div>
              )}
            </div>
            <Radio.Group
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              className="expires-radio-group"
            >
              {expiresOptions.map((opt) => (
                <Radio.Button key={opt.value} value={opt.value} className="expires-radio-btn">
                  {opt.label}
                </Radio.Button>
              ))}
            </Radio.Group>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <>
      <Modal
        open={open}
        onCancel={handleClose}
        title={
          <Space>
            <ShareAltOutlined style={{ color: '#6366f1' }} />
            <span>{isEditMode ? '编辑分享链接' : '分享我的 TODO'}</span>
          </Space>
        }
        width={640}
        className="share-modal"
        footer={null}
        destroyOnHidden
      >
        {createdLink ? (
          <div className="share-success">
            <div className="share-success-icon">🎉</div>
            <Title level={4} style={{ textAlign: 'center' }}>
              分享链接已生成
            </Title>
            <div className="share-url-box">
              <Input
                readOnly
                value={getShareUrl(createdLink.key)}
                suffix={
                  <Tooltip title={copied ? '已复制！' : '复制链接'}>
                    <Button
                      type="text"
                      size="small"
                      icon={copied ? <CheckOutlined style={{ color: '#52c41a' }} /> : <CopyOutlined />}
                      onClick={() => handleCopy(getShareUrl(createdLink.key))}
                    />
                  </Tooltip>
                }
              />
            </div>
            <div className="share-qr-wrap">
              <QRCodeSVG
                value={getShareUrl(createdLink.key)}
                size={140}
                bgColor="transparent"
                fgColor="#6366f1"
                level="M"
              />
              <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8, fontSize: 12 }}>
                扫码打开分享页
              </Text>
            </div>
            <Space style={{ marginTop: 16, justifyContent: 'center', width: '100%' }}>
              <Button
                type="primary"
                icon={<EyeOutlined />}
                onClick={() => window.open(`/share/${createdLink.key}`, '_blank')}
              >
                预览分享页
              </Button>
              <Button onClick={handleReset}>再创建一个</Button>
              <Button onClick={handleClose}>完成</Button>
            </Space>
          </div>
        ) : (
          <>
            <Steps
              current={current}
              items={STEPS}
              size="small"
              className="share-steps"
            />
            <div className="share-step-content">{renderStep()}</div>
            <div className="share-footer">
              {current > 0 && (
                <Button onClick={() => setCurrent((c) => c - 1)}>上一步</Button>
              )}
              <div style={{ flex: 1 }} />
              {current < STEPS.length - 1 ? (
                <Button type="primary" onClick={() => setCurrent((c) => c + 1)}>
                  下一步
                </Button>
              ) : (
                <Button
                  type="primary"
                  icon={<LinkOutlined />}
                  loading={createMutation.isPending || updateMutation.isPending}
                  onClick={handleCreate}
                >
                  {isEditMode ? '保存修改' : '生成分享链接'}
                </Button>
              )}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
