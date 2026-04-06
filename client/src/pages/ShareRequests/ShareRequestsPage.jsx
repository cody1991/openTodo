import { useState } from 'react';
import {
  Typography, Table, Button, Space, Tag, Segmented, Modal, Form, Input, Select, DatePicker,
  Switch, message, Popconfirm, Drawer, Tooltip,
} from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dayjs from 'dayjs';
import { shareRequestApi, categoryApi, tagApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { toUTCString, utcToDayjsInTz } from '../../utils/date';
import './ShareRequestsPage.css';

const { Title, Text } = Typography;

const PRIORITY_OPTIONS = [
  { value: 'low', label: '🟢 低' },
  { value: 'medium', label: '🟡 中' },
  { value: 'high', label: '🟠 高' },
  { value: 'urgent', label: '🔴 紧急' },
];

const STATUS_LABEL = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
};

const PRIORITY_LABEL = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

function categoryNameById(categories, id) {
  if (id == null) return null;
  const c = categories.find((x) => x.id === id);
  return c?.name || null;
}

function buildCategoryOptions(allCategories) {
  const rootCats = allCategories.filter((c) => !c.parent_id);
  const childCats = allCategories.filter((c) => c.parent_id);
  const rootsWithChildren = new Set(childCats.map((c) => c.parent_id));

  return rootCats.map((root) => {
    const dotStyle = {
      display: 'inline-block', width: 8, height: 8,
      borderRadius: '50%', background: root.color,
    };
    const rootLabel = <Space size={6}><span style={dotStyle} />{root.name}</Space>;

    if (!rootsWithChildren.has(root.id)) {
      return { value: root.id, label: rootLabel };
    }

    const groupChildren = childCats
      .filter((c) => c.parent_id === root.id)
      .map((child) => ({
        value: child.id,
        label: (
          <Space size={6}>
            <span style={{ ...dotStyle, background: child.color, width: 7, height: 7 }} />
            {child.name}
          </Space>
        ),
      }));

    return {
      label: rootLabel,
      title: root.name,
      options: [
        { value: root.id, label: <Space size={6}><span style={dotStyle} />{root.name}（本分类）</Space> },
        ...groupChildren,
      ],
    };
  });
}

export default function ShareRequestsPage() {
  const tz = useAuthStore((s) => s.user?.timezone || 'UTC');
  const [filter, setFilter] = useState('pending'); // pending | approved | rejected | all
  const [previewRow, setPreviewRow] = useState(null);
  const [approveRow, setApproveRow] = useState(null);
  const [form] = Form.useForm();
  const [showExactTime, setShowExactTime] = useState(false);
  const queryClient = useQueryClient();

  const { data: catData } = useQuery({ queryKey: ['categories'], queryFn: categoryApi.list });
  const { data: tagData } = useQuery({ queryKey: ['tags'], queryFn: tagApi.list });
  const categories = catData?.categories || [];
  const allTags = tagData?.tags || [];
  const categoryOptions = buildCategoryOptions(categories);

  const { data, isLoading } = useQuery({
    queryKey: ['share-requests', filter],
    queryFn: () => {
      const params = {};
      if (filter && filter !== 'all') params.status = filter;
      return shareRequestApi.list(params);
    },
  });

  const requests = data?.requests || [];
  const pendingCount = data?.pending_count ?? 0;

  const approveMutation = useMutation({
    mutationFn: ({ id, payload }) => shareRequestApi.approve(id, payload),
    onSuccess: () => {
      message.success('已加入 TODO');
      queryClient.invalidateQueries({ queryKey: ['share-requests'] });
      queryClient.invalidateQueries({ queryKey: ['share-requests', 'badge'] });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      setApproveRow(null);
    },
    onError: (err) => message.error(err?.message || '操作失败'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => shareRequestApi.reject(id),
    onSuccess: () => {
      message.success('已拒绝');
      queryClient.invalidateQueries({ queryKey: ['share-requests'] });
      queryClient.invalidateQueries({ queryKey: ['share-requests', 'badge'] });
    },
    onError: (err) => message.error(err?.message || '操作失败'),
  });

  const openApprove = (row) => {
    setApproveRow(row);
    const due = row.due_date ? utcToDayjsInTz(row.due_date, tz) : null;
    const hasTime = due && !(due.hour() === 0 && due.minute() === 0);
    setShowExactTime(!!hasTime);
    form.setFieldsValue({
      title: row.title,
      priority: row.priority,
      category_id: row.category_id,
      tag_ids: row.tag_ids || [],
      due_date: due,
      notify_enabled: true,
    });
  };

  const submitApprove = () => {
    form.validateFields().then((values) => {
      const due = values.due_date ? toUTCString(values.due_date, tz) : null;
      approveMutation.mutate({
        id: approveRow.id,
        payload: {
          title: values.title,
          priority: values.priority,
          category_id: values.category_id ?? null,
          tag_ids: values.tag_ids || [],
          due_date: due,
          notify_enabled: values.notify_enabled ? 1 : 0,
          content: approveRow.content,
        },
      });
    });
  };

  const openApproveFromPreview = () => {
    const row = previewRow;
    if (!row) return;
    setPreviewRow(null);
    openApprove(row);
  };

  const rejectFromPreview = () => {
    const row = previewRow;
    if (!row) return;
    rejectMutation.mutate(row.id, {
      onSuccess: () => setPreviewRow(null),
    });
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (t, row) => (
        <Button type="link" style={{ padding: 0, height: 'auto', textAlign: 'left' }} onClick={() => setPreviewRow(row)}>
          {t}
        </Button>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 72,
      render: (p) => PRIORITY_LABEL[p] || p,
    },
    {
      title: '来源分享',
      dataIndex: 'share_name',
      key: 'share_name',
      width: 160,
      ellipsis: true,
      render: (name, row) =>
        row.share_key ? (
          <a
            className="share-req-table-share-link"
            href={`/share/${row.share_key}`}
            target="_blank"
            rel="noopener noreferrer"
            title="在新标签页打开分享页"
          >
            {name || '—'}
          </a>
        ) : (
          name || '—'
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s) => <Tag color={s === 'pending' ? 'gold' : s === 'approved' ? 'green' : 'default'}>{STATUS_LABEL[s] || s}</Tag>,
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (d) => (d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '—'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, row) => (
        <Space>
          {row.status === 'pending' && (
            <>
              <Button type="primary" size="small" onClick={() => openApprove(row)}>
                通过
              </Button>
              <Popconfirm title="确定拒绝该需求？" onConfirm={() => rejectMutation.mutate(row.id)}>
                <Button size="small" danger loading={rejectMutation.isPending}>拒绝</Button>
              </Popconfirm>
            </>
          )}
          {row.status === 'approved' && row.result_todo_id && (
            <Text type="secondary" style={{ fontSize: 12 }}>TODO #{row.result_todo_id}</Text>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="share-req-page">
      <div className="share-req-header">
        <Title level={4} style={{ margin: 0 }}>需求收件箱</Title>
        <Text type="secondary">访客在分享页提交的「提需求」，通过后将写入你的 TODO 列表</Text>
      </div>

      <div className="share-req-toolbar">
        <Segmented
          options={[
            { label: `待审核${pendingCount ? ` (${pendingCount})` : ''}`, value: 'pending' },
            { label: '已通过', value: 'approved' },
            { label: '已拒绝', value: 'rejected' },
            { label: '全部', value: 'all' },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      <Table
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={requests}
        pagination={{ pageSize: 20 }}
      />

      <Drawer
        title="需求详情"
        open={!!previewRow}
        onClose={() => setPreviewRow(null)}
        width={600}
        footer={
          previewRow?.status === 'pending' ? (
            <div style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setPreviewRow(null)}>关闭</Button>
                <Button type="primary" onClick={openApproveFromPreview}>
                  通过并加入 TODO
                </Button>
                <Popconfirm
                  title="确定拒绝该需求？"
                  okText="拒绝"
                  okButtonProps={{ danger: true }}
                  onConfirm={rejectFromPreview}
                >
                  <Button danger loading={rejectMutation.isPending}>拒绝</Button>
                </Popconfirm>
              </Space>
            </div>
          ) : (
            <div style={{ textAlign: 'right' }}>
              <Button onClick={() => setPreviewRow(null)}>关闭</Button>
            </div>
          )
        }
      >
        {previewRow && (
          <div className="share-req-preview">
            <Title level={4} className="share-req-preview-title" style={{ marginTop: 0 }}>
              {previewRow.title}
            </Title>

            <div className="share-req-dl">
              <div className="share-req-dl-row">
                <span className="share-req-dl-k">状态</span>
                <span className="share-req-dl-v">
                  <Tag color={previewRow.status === 'pending' ? 'gold' : previewRow.status === 'approved' ? 'green' : 'default'}>
                    {STATUS_LABEL[previewRow.status] || previewRow.status}
                  </Tag>
                </span>
              </div>
              <div className="share-req-dl-row">
                <span className="share-req-dl-k">优先级</span>
                <span className="share-req-dl-v">{PRIORITY_LABEL[previewRow.priority] || previewRow.priority}</span>
              </div>
              <div className="share-req-dl-row">
                <span className="share-req-dl-k">分类</span>
                <span className="share-req-dl-v">
                  {categoryNameById(categories, previewRow.category_id) || '—'}
                </span>
              </div>
              <div className="share-req-dl-row">
                <span className="share-req-dl-k">期望完成</span>
                <span className="share-req-dl-v">
                  {previewRow.due_date
                    ? utcToDayjsInTz(previewRow.due_date, tz).format('YYYY-MM-DD HH:mm')
                    : '—'}
                </span>
              </div>
              <div className="share-req-dl-row">
                <span className="share-req-dl-k">来源分享</span>
                <span className="share-req-dl-v">
                  {previewRow.share_key ? (
                    <a
                      className="share-req-share-link"
                      href={`/share/${previewRow.share_key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="在新标签页打开分享页"
                    >
                      {previewRow.share_name || '—'}
                    </a>
                  ) : (
                    previewRow.share_name || '—'
                  )}
                </span>
              </div>
              {previewRow.share_key && (
                <div className="share-req-dl-row">
                  <span className="share-req-dl-k">分享页</span>
                  <span className="share-req-dl-v">
                    <Space size="small" wrap align="center">
                      <a
                        className="share-req-share-link"
                        href={`/share/${previewRow.share_key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="在新标签页打开分享页"
                      >
                        /share/{previewRow.share_key}
                      </a>
                      <Tooltip title="复制完整链接">
                        <Button
                          type="text"
                          size="small"
                          icon={<CopyOutlined />}
                          aria-label="复制完整链接"
                          onClick={() => {
                            const u = `${window.location.origin}/share/${previewRow.share_key}`;
                            navigator.clipboard.writeText(u).then(
                              () => message.success('已复制链接'),
                              () => message.error('复制失败，请手动复制地址栏链接')
                            );
                          }}
                        />
                      </Tooltip>
                    </Space>
                  </span>
                </div>
              )}
              <div className="share-req-dl-row">
                <span className="share-req-dl-k">提交时间</span>
                <span className="share-req-dl-v">
                  {previewRow.created_at ? dayjs(previewRow.created_at).format('YYYY-MM-DD HH:mm:ss') : '—'}
                </span>
              </div>
              {previewRow.reviewed_at && (
                <div className="share-req-dl-row">
                  <span className="share-req-dl-k">处理时间</span>
                  <span className="share-req-dl-v">
                    {dayjs(previewRow.reviewed_at).format('YYYY-MM-DD HH:mm:ss')}
                  </span>
                </div>
              )}
              {previewRow.contact && (
                <div className="share-req-dl-row">
                  <span className="share-req-dl-k">联系方式</span>
                  <span className="share-req-dl-v">{previewRow.contact}</span>
                </div>
              )}
              <div className="share-req-dl-row share-req-dl-row--tags">
                <span className="share-req-dl-k">标签</span>
                <span className="share-req-dl-v">
                  {(previewRow.tags || []).length > 0
                    ? (previewRow.tags || []).map((t) => (
                      <Tag key={t.id} color={t.color}>{t.name}</Tag>
                    ))
                    : '—'}
                </span>
              </div>
            </div>

            <div className="share-req-section-label">正文（Markdown）</div>
            <div className="share-req-md share-req-md--body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewRow.content?.trim() ? previewRow.content : '*（无正文）*'}</ReactMarkdown>
            </div>

            {previewRow.status === 'approved' && previewRow.result_todo_id && (
              <div className="share-req-after-note">
                <Text type="secondary">
                  已生成 TODO #{previewRow.result_todo_id}，可在 TODO 列表中继续编辑。
                </Text>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        title="通过并加入 TODO"
        open={!!approveRow}
        onCancel={() => setApproveRow(null)}
        onOk={submitApprove}
        confirmLoading={approveMutation.isPending}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="priority" label="优先级">
            <Select options={PRIORITY_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="due_date"
            label={(
              <Space>
                <span>截止时间</span>
                <Switch
                  size="small"
                  checked={showExactTime}
                  onChange={(checked) => {
                    setShowExactTime(checked);
                    if (!checked) {
                      const cur = form.getFieldValue('due_date');
                      if (cur) form.setFieldValue('due_date', cur.startOf('day'));
                    }
                  }}
                  checkedChildren="精确时间"
                  unCheckedChildren="精确时间"
                />
              </Space>
            )}
          >
            <DatePicker
              showTime={showExactTime ? { format: 'HH:mm' } : false}
              format={showExactTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD'}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="category_id" label="分类">
            <Select allowClear placeholder="分类" options={categoryOptions} />
          </Form.Item>
          <Form.Item name="tag_ids" label="标签">
            <Select
              mode="multiple"
              allowClear
              options={allTags.map((t) => ({ value: t.id, label: t.name }))}
              tagRender={({ label, value, closable, onClose }) => {
                const tag = allTags.find((t) => t.id === value);
                return (
                  <Tag color={tag?.color} closable={closable} onClose={onClose} style={{ marginRight: 2 }}>
                    {label}
                  </Tag>
                );
              }}
            />
          </Form.Item>
          <Form.Item name="notify_enabled" valuePropName="checked" label="提醒">
            <Switch checkedChildren="开启推送" unCheckedChildren="关闭" />
          </Form.Item>
          {approveRow && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">正文预览（可在 TODO 列表中继续编辑）</Text>
              <div className="share-req-md share-req-md--compact">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{approveRow.content || ''}</ReactMarkdown>
              </div>
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
}
