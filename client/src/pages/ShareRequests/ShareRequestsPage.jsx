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
import { useTranslation } from 'react-i18next';
import { shareRequestApi, categoryApi, tagApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { toUTCString, utcToDayjsInTz } from '../../utils/date';
import './ShareRequestsPage.css';

const { Title, Text } = Typography;

function categoryNameById(categories, id) {
  if (id == null) return null;
  const c = categories.find((x) => x.id === id);
  return c?.name || null;
}

function buildCategoryOptions(allCategories, thisCategory) {
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
        { value: root.id, label: <Space size={6}><span style={dotStyle} />{root.name}{thisCategory}</Space> },
        ...groupChildren,
      ],
    };
  });
}

export default function ShareRequestsPage() {
  const { t } = useTranslation();
  const tz = useAuthStore((s) => s.user?.timezone || 'UTC');
  const [filter, setFilter] = useState('pending');
  const [previewRow, setPreviewRow] = useState(null);
  const [approveRow, setApproveRow] = useState(null);
  const [form] = Form.useForm();
  const [showExactTime, setShowExactTime] = useState(false);
  const queryClient = useQueryClient();

  const { data: catData } = useQuery({ queryKey: ['categories'], queryFn: categoryApi.list });
  const { data: tagData } = useQuery({ queryKey: ['tags'], queryFn: tagApi.list });
  const categories = catData?.categories || [];
  const allTags = tagData?.tags || [];
  const categoryOptions = buildCategoryOptions(categories, t('shareRequests.thisCategory'));

  const PRIORITY_OPTIONS = [
    { value: 'low', label: t('shareRequests.priorityLow') },
    { value: 'medium', label: t('shareRequests.priorityMedium') },
    { value: 'high', label: t('shareRequests.priorityHigh') },
    { value: 'urgent', label: t('shareRequests.priorityUrgent') },
  ];

  const STATUS_LABEL = {
    pending: t('shareRequests.statusPending'),
    approved: t('shareRequests.statusApproved'),
    rejected: t('shareRequests.statusRejected'),
  };

  const PRIORITY_LABEL = {
    urgent: t('shareRequests.priorityUrgent').replace(/^[^ ]+ /, ''),
    high: t('shareRequests.priorityHigh').replace(/^[^ ]+ /, ''),
    medium: t('shareRequests.priorityMedium').replace(/^[^ ]+ /, ''),
    low: t('shareRequests.priorityLow').replace(/^[^ ]+ /, ''),
  };

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
      message.success(t('shareRequests.approvedMsg'));
      queryClient.invalidateQueries({ queryKey: ['share-requests'] });
      queryClient.invalidateQueries({ queryKey: ['share-requests', 'badge'] });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      setApproveRow(null);
    },
    onError: (err) => message.error(err?.message || t('shareRequests.opFailed')),
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => shareRequestApi.reject(id),
    onSuccess: () => {
      message.success(t('shareRequests.rejectedMsg'));
      queryClient.invalidateQueries({ queryKey: ['share-requests'] });
      queryClient.invalidateQueries({ queryKey: ['share-requests', 'badge'] });
    },
    onError: (err) => message.error(err?.message || t('shareRequests.opFailed')),
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
      title: t('shareRequests.colTitle'),
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (val, row) => (
        <Button type="link" style={{ padding: 0, height: 'auto', textAlign: 'left' }} onClick={() => setPreviewRow(row)}>
          {val}
        </Button>
      ),
    },
    {
      title: t('shareRequests.colPriority'),
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (p) => PRIORITY_LABEL[p] || p,
    },
    {
      title: t('shareRequests.colShareSource'),
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
            title={t('shareRequests.openSharePage')}
          >
            {name || '—'}
          </a>
        ) : (
          name || '—'
        ),
    },
    {
      title: t('shareRequests.colStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s) => <Tag color={s === 'pending' ? 'gold' : s === 'approved' ? 'green' : 'default'}>{STATUS_LABEL[s] || s}</Tag>,
    },
    {
      title: t('shareRequests.colSubmittedAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (d) => (d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '—'),
    },
    {
      title: t('shareRequests.colActions'),
      key: 'actions',
      width: 220,
      render: (_, row) => (
        <Space>
          {row.status === 'pending' && (
            <>
              <Button type="primary" size="small" onClick={() => openApprove(row)}>
                {t('shareRequests.approve')}
              </Button>
              <Popconfirm title={t('shareRequests.rejectConfirm')} onConfirm={() => rejectMutation.mutate(row.id)}>
                <Button size="small" danger loading={rejectMutation.isPending}>{t('shareRequests.reject')}</Button>
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
        <Title level={4} style={{ margin: 0 }}>{t('shareRequests.pageTitle')}</Title>
        <Text type="secondary">{t('shareRequests.pageDesc')}</Text>
      </div>

      <div className="share-req-toolbar">
        <Segmented
          options={[
            { label: `${t('shareRequests.statusPending')}${pendingCount ? ` (${pendingCount})` : ''}`, value: 'pending' },
            { label: t('shareRequests.statusApproved'), value: 'approved' },
            { label: t('shareRequests.statusRejected'), value: 'rejected' },
            { label: t('shareRequests.statusAll'), value: 'all' },
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
        title={t('shareRequests.drawerTitle')}
        open={!!previewRow}
        onClose={() => setPreviewRow(null)}
        width={600}
        footer={
          previewRow?.status === 'pending' ? (
            <div style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setPreviewRow(null)}>{t('shareRequests.close')}</Button>
                <Button type="primary" onClick={openApproveFromPreview}>
                  {t('shareRequests.approveAndAdd')}
                </Button>
                <Popconfirm
                  title={t('shareRequests.rejectConfirm')}
                  okText={t('shareRequests.reject')}
                  okButtonProps={{ danger: true }}
                  onConfirm={rejectFromPreview}
                >
                  <Button danger loading={rejectMutation.isPending}>{t('shareRequests.reject')}</Button>
                </Popconfirm>
              </Space>
            </div>
          ) : (
            <div style={{ textAlign: 'right' }}>
              <Button onClick={() => setPreviewRow(null)}>{t('shareRequests.close')}</Button>
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
                <span className="share-req-dl-k">{t('shareRequests.detailStatus')}</span>
                <span className="share-req-dl-v">
                  <Tag color={previewRow.status === 'pending' ? 'gold' : previewRow.status === 'approved' ? 'green' : 'default'}>
                    {STATUS_LABEL[previewRow.status] || previewRow.status}
                  </Tag>
                </span>
              </div>
              <div className="share-req-dl-row">
                <span className="share-req-dl-k">{t('shareRequests.detailPriority')}</span>
                <span className="share-req-dl-v">{PRIORITY_LABEL[previewRow.priority] || previewRow.priority}</span>
              </div>
              <div className="share-req-dl-row">
                <span className="share-req-dl-k">{t('shareRequests.detailCategory')}</span>
                <span className="share-req-dl-v">
                  {categoryNameById(categories, previewRow.category_id) || '—'}
                </span>
              </div>
              <div className="share-req-dl-row">
                <span className="share-req-dl-k">{t('shareRequests.detailDue')}</span>
                <span className="share-req-dl-v">
                  {previewRow.due_date
                    ? utcToDayjsInTz(previewRow.due_date, tz).format('YYYY-MM-DD HH:mm')
                    : '—'}
                </span>
              </div>
              <div className="share-req-dl-row">
                <span className="share-req-dl-k">{t('shareRequests.detailShareSource')}</span>
                <span className="share-req-dl-v">
                  {previewRow.share_key ? (
                    <a
                      className="share-req-share-link"
                      href={`/share/${previewRow.share_key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t('shareRequests.openSharePage')}
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
                  <span className="share-req-dl-k">{t('shareRequests.detailSharePage')}</span>
                  <span className="share-req-dl-v">
                    <Space size="small" wrap align="center">
                      <a
                        className="share-req-share-link"
                        href={`/share/${previewRow.share_key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t('shareRequests.openSharePage')}
                      >
                        /share/{previewRow.share_key}
                      </a>
                      <Tooltip title={t('shareRequests.detailCopyLink')}>
                        <Button
                          type="text"
                          size="small"
                          icon={<CopyOutlined />}
                          aria-label={t('shareRequests.detailCopyLink')}
                          onClick={() => {
                            const u = `${window.location.origin}/share/${previewRow.share_key}`;
                            navigator.clipboard.writeText(u).then(
                              () => message.success(t('shareRequests.detailCopied')),
                              () => message.error(t('shareRequests.detailCopyFailed'))
                            );
                          }}
                        />
                      </Tooltip>
                    </Space>
                  </span>
                </div>
              )}
              <div className="share-req-dl-row">
                <span className="share-req-dl-k">{t('shareRequests.detailSubmittedAt')}</span>
                <span className="share-req-dl-v">
                  {previewRow.created_at ? dayjs(previewRow.created_at).format('YYYY-MM-DD HH:mm:ss') : '—'}
                </span>
              </div>
              {previewRow.reviewed_at && (
                <div className="share-req-dl-row">
                  <span className="share-req-dl-k">{t('shareRequests.detailReviewedAt')}</span>
                  <span className="share-req-dl-v">
                    {dayjs(previewRow.reviewed_at).format('YYYY-MM-DD HH:mm:ss')}
                  </span>
                </div>
              )}
              {previewRow.contact && (
                <div className="share-req-dl-row">
                  <span className="share-req-dl-k">{t('shareRequests.detailContact')}</span>
                  <span className="share-req-dl-v">{previewRow.contact}</span>
                </div>
              )}
              <div className="share-req-dl-row share-req-dl-row--tags">
                <span className="share-req-dl-k">{t('shareRequests.detailTags')}</span>
                <span className="share-req-dl-v">
                  {(previewRow.tags || []).length > 0
                    ? (previewRow.tags || []).map((tag) => (
                      <Tag key={tag.id} color={tag.color}>{tag.name}</Tag>
                    ))
                    : '—'}
                </span>
              </div>
            </div>

            <div className="share-req-section-label">{t('shareRequests.detailContent')}</div>
            <div className="share-req-md share-req-md--body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {previewRow.content?.trim() ? previewRow.content : t('shareRequests.detailNoContent')}
              </ReactMarkdown>
            </div>

            {previewRow.status === 'approved' && previewRow.result_todo_id && (
              <div className="share-req-after-note">
                <Text type="secondary">
                  {t('shareRequests.detailTodoCreated', { id: previewRow.result_todo_id })}
                </Text>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        title={t('shareRequests.modalTitle')}
        open={!!approveRow}
        onCancel={() => setApproveRow(null)}
        onOk={submitApprove}
        confirmLoading={approveMutation.isPending}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label={t('shareRequests.formTitle')} rules={[{ required: true, message: t('shareRequests.formTitleRequired') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="priority" label={t('shareRequests.formPriority')}>
            <Select options={PRIORITY_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="due_date"
            label={(
              <Space>
                <span>{t('shareRequests.formDueDate')}</span>
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
                  checkedChildren={t('shareRequests.formExactTime')}
                  unCheckedChildren={t('shareRequests.formExactTime')}
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
          <Form.Item name="category_id" label={t('shareRequests.formCategory')}>
            <Select allowClear placeholder={t('shareRequests.formCategoryPlaceholder')} options={categoryOptions} />
          </Form.Item>
          <Form.Item name="tag_ids" label={t('shareRequests.formTags')}>
            <Select
              mode="multiple"
              allowClear
              options={allTags.map((tag) => ({ value: tag.id, label: tag.name }))}
              tagRender={({ label, value, closable, onClose }) => {
                const tag = allTags.find((tg) => tg.id === value);
                return (
                  <Tag color={tag?.color} closable={closable} onClose={onClose} style={{ marginRight: 2 }}>
                    {label}
                  </Tag>
                );
              }}
            />
          </Form.Item>
          <Form.Item name="notify_enabled" valuePropName="checked" label={t('shareRequests.formNotify')}>
            <Switch checkedChildren={t('shareRequests.formNotifyOn')} unCheckedChildren={t('shareRequests.formNotifyOff')} />
          </Form.Item>
          {approveRow && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">{t('shareRequests.formContentPreview')}</Text>
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
