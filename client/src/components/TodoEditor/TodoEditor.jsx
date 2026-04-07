import { useState, useEffect } from 'react';
import {
  Drawer, Form, Input, Select, DatePicker, Button, Space, Tag, Divider, message,
  Row, Col, Switch,
} from 'antd';
import { Editor } from '@bytemd/react';
import gfm from '@bytemd/plugin-gfm';
import highlight from '@bytemd/plugin-highlight';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { todoApi, categoryApi, tagApi, uploadApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { utcToDayjsInTz, toUTCString } from '../../utils/date';
import 'bytemd/dist/index.css';
import 'highlight.js/styles/github-dark.css';
import './TodoEditor.css';

const plugins = [gfm(), highlight()];

export default function TodoEditor({ todoId, open, onClose, defaultDate, defaultCategoryId }) {
  const [form] = Form.useForm();
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showExactTime, setShowExactTime] = useState(false);
  const queryClient = useQueryClient();
  const tz = useAuthStore((s) => s.user?.timezone || 'UTC');
  const { t } = useTranslation();

  const PRIORITY_OPTIONS = [
    { value: 'low',    label: t('todoEditor.priorityLow') },
    { value: 'medium', label: t('todoEditor.priorityMedium') },
    { value: 'high',   label: t('todoEditor.priorityHigh') },
    { value: 'urgent', label: t('todoEditor.priorityUrgent') },
  ];

  const STATUS_OPTIONS = [
    { value: 'pending',     label: t('todoEditor.statusPending', { defaultValue: t('todo.pending') }) },
    { value: 'in_progress', label: t('todoEditor.statusInProgress', { defaultValue: t('todo.inProgress') }) },
    { value: 'completed',   label: t('todoEditor.statusCompleted', { defaultValue: t('todo.completed') }) },
  ];

  const { data: todoData } = useQuery({
    queryKey: ['todo', todoId],
    queryFn: () => todoApi.get(todoId),
    enabled: !!todoId && open,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryApi.list,
  });

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: tagApi.list,
  });

  const allCategories = categoriesData?.categories || [];
  const tags = tagsData?.tags || [];

  const rootCats = allCategories.filter((c) => !c.parent_id);
  const childCats = allCategories.filter((c) => c.parent_id);
  const rootsWithChildren = new Set(childCats.map((c) => c.parent_id));

  const categoryOptions = rootCats.map((root) => {
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
        { value: root.id, label: <Space size={6}><span style={dotStyle} />{root.name}{t('todoEditor.thisCategory')}</Space> },
        ...groupChildren,
      ],
    };
  });

  useEffect(() => {
    if (todoData?.todo) {
      const todo = todoData.todo;
      const dueDate = utcToDayjsInTz(todo.due_date, tz);
      const hasExactTime = dueDate && !(dueDate.hour() === 0 && dueDate.minute() === 0);
      setShowExactTime(!!hasExactTime);
      form.setFieldsValue({
        title: todo.title,
        category_id: todo.category_id,
        priority: todo.priority,
        status: todo.status,
        due_date: dueDate,
        tag_ids: todo.tags?.map((tag) => tag.id) || [],
        notify_enabled: todo.notify_enabled !== 0,
      });
      setContent(todo.content || '');
    } else if (!todoId) {
      form.resetFields();
      setShowExactTime(false);
      form.setFieldsValue({
        priority: 'high',
        status: 'pending',
        category_id: defaultCategoryId || undefined,
        due_date: defaultDate ? utcToDayjsInTz(defaultDate, tz) : null,
        notify_enabled: true,
      });
      setContent('');
    }
  }, [todoData, todoId, open, defaultCategoryId, defaultDate, tz]);

  const saveMutation = useMutation({
    mutationFn: (values) => {
      const payload = {
        ...values,
        content,
        due_date: values.due_date ? toUTCString(values.due_date, tz) : null,
      };
      return todoId ? todoApi.update(todoId, payload) : todoApi.create(payload);
    },
    onSuccess: () => {
      message.success(todoId ? t('todoEditor.updateSuccess') : t('todoEditor.createSuccess'));
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (todoId) {
        queryClient.invalidateQueries({ queryKey: ['todo', todoId] });
      }
      onClose();
    },
    onError: (err) => message.error(err.message || t('todoEditor.saveFailed')),
  });

  const onFinish = (values) => saveMutation.mutate(values);

  const uploadImages = async (files) => {
    setUploading(true);
    const results = [];
    try {
      for (const file of files) {
        const result = await uploadApi.image(file);
        if (result?.url) {
          results.push({ url: result.url, alt: file.name.replace(/\.[^.]+$/, '') });
          if (result.storage === 'local') {
            message.info(t('todoEditor.imageSavedLocally'), 2);
          }
        }
      }
    } catch (err) {
      message.error(err?.message || t('todoEditor.imageUploadFailed'));
    } finally {
      setUploading(false);
    }
    return results;
  };

  return (
    <Drawer
      title={
        <span style={{ fontWeight: 600 }}>
          {todoId ? t('todoEditor.editTitle') : t('todoEditor.createTitle')}
        </span>
      }
      open={open}
      onClose={onClose}
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            type="primary"
            loading={saveMutation.isPending}
            onClick={() => form.submit()}
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
          >
            {todoId ? t('todoEditor.save') : t('todoEditor.create')}
          </Button>
        </Space>
      }
      styles={{ wrapper: { width: 720 }, body: { padding: '16px 24px' } }}
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item
          name="title"
          label={t('todoEditor.titleLabel')}
          rules={[{ required: true, message: t('todoEditor.titleRequired') }]}
        >
          <Input placeholder={t('todoEditor.titlePlaceholder')} size="large" className="editor-input" />
        </Form.Item>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="priority" label={t('todoEditor.priority')}>
              <Select options={PRIORITY_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="status" label={t('todoEditor.status')}>
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="due_date"
              label={
                <Space size={6}>
                  <span>{t('todoEditor.dueDate')}</span>
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
                    checkedChildren={t('todoEditor.exactTime')}
                    unCheckedChildren={t('todoEditor.exactTime')}
                  />
                </Space>
              }
            >
              <DatePicker
                showTime={showExactTime ? { format: 'HH:mm', defaultValue: dayjs('23:59', 'HH:mm') } : false}
                format={showExactTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD'}
                style={{ width: '100%' }}
                placeholder={t('todoEditor.dueDatePlaceholder')}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="category_id" label={t('todoEditor.category')}>
              <Select
                placeholder={t('todoEditor.categoryPlaceholder')}
                allowClear
                options={categoryOptions}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="tag_ids" label={t('todoEditor.tags')}>
              <Select
                mode="multiple"
                placeholder={t('todoEditor.tagsPlaceholder')}
                allowClear
                maxTagCount={3}
                options={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
                tagRender={({ label, value, closable, onClose }) => {
                  const tag = tags.find((tg) => tg.id === value);
                  return (
                    <Tag
                      color={tag?.color}
                      closable={closable}
                      onClose={onClose}
                      style={{ marginRight: 2 }}
                    >
                      {label}
                    </Tag>
                  );
                }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="notify_enabled" valuePropName="checked" style={{ marginBottom: 8 }}>
          <Switch
            checkedChildren={t('todoEditor.notifyEnabled')}
            unCheckedChildren={t('todoEditor.notifyDisabled')}
          />
        </Form.Item>

        <Divider style={{ margin: '8px 0 16px' }} />

        <div className="editor-label">
          {t('todoEditor.content')}
          {uploading && <span style={{ color: '#6366f1', marginLeft: 8 }}>{t('todoEditor.uploadingImage')}</span>}
        </div>
        <div className="bytemd-wrapper">
          <Editor
            value={content}
            plugins={plugins}
            onChange={setContent}
            uploadImages={uploadImages}
            locale={{ upload_images: t('todoEditor.uploadImages') }}
          />
        </div>
      </Form>
    </Drawer>
  );
}
