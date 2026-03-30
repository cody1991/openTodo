import { useState, useEffect } from 'react';
import {
  Drawer, Form, Input, Select, DatePicker, Button, Space, Tag, Divider, message,
  Row, Col, Switch,
} from 'antd';
import { Editor } from '@bytemd/react';
import gfm from '@bytemd/plugin-gfm';
import highlight from '@bytemd/plugin-highlight';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { todoApi, categoryApi, tagApi, uploadApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { utcToDayjsInTz, toUTCString } from '../../utils/date';
import 'bytemd/dist/index.css';
import 'highlight.js/styles/github-dark.css';
import './TodoEditor.css';

const PRIORITY_OPTIONS = [
  { value: 'low', label: '🟢 低优先级' },
  { value: 'medium', label: '🟡 中优先级' },
  { value: 'high', label: '🟠 高优先级' },
  { value: 'urgent', label: '🔴 紧急' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: '待处理' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
];

const plugins = [gfm(), highlight()];

export default function TodoEditor({ todoId, open, onClose, defaultDate, defaultCategoryId }) {
  const [form] = Form.useForm();
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showExactTime, setShowExactTime] = useState(false);
  const queryClient = useQueryClient();
  const tz = useAuthStore((s) => s.user?.timezone || 'UTC');

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

  // Build grouped options: roots with children become option groups,
  // standalone roots (no children) become flat options.
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
        { value: root.id, label: <Space size={6}><span style={dotStyle} />{root.name}（本分类）</Space> },
        ...groupChildren,
      ],
    };
  });

  useEffect(() => {
    if (todoData?.todo) {
      const t = todoData.todo;
      const dueDate = utcToDayjsInTz(t.due_date, tz);
      const hasExactTime = dueDate && !(dueDate.hour() === 0 && dueDate.minute() === 0);
      setShowExactTime(!!hasExactTime);
      form.setFieldsValue({
        title: t.title,
        category_id: t.category_id,
        priority: t.priority,
        status: t.status,
        due_date: dueDate,
        tag_ids: t.tags?.map((tag) => tag.id) || [],
        notify_enabled: t.notify_enabled !== 0,
      });
      setContent(t.content || '');
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
      message.success(todoId ? '更新成功' : '创建成功');
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (todoId) {
        queryClient.invalidateQueries({ queryKey: ['todo', todoId] });
      }
      onClose();
    },
    onError: (err) => message.error(err.message || '操作失败'),
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
            message.info('图片已保存到本地服务器', 2);
          }
        }
      }
    } catch (err) {
      message.error(err?.message || '图片上传失败');
    } finally {
      setUploading(false);
    }
    return results;
  };

  return (
    <Drawer
      title={
        <span style={{ fontWeight: 600 }}>
          {todoId ? '编辑 TODO' : '新建 TODO'}
        </span>
      }
      open={open}
      onClose={onClose}

      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            loading={saveMutation.isPending}
            onClick={() => form.submit()}
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
          >
            {todoId ? '保存修改' : '创建'}
          </Button>
        </Space>
      }
      styles={{ wrapper: { width: 720 }, body: { padding: '16px 24px' } }}
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
          name="title"
          label="标题"
          rules={[{ required: true, message: '请输入标题' }]}
        >
          <Input placeholder="输入 TODO 标题..." size="large" className="editor-input" />
        </Form.Item>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="priority" label="优先级">
              <Select options={PRIORITY_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="status" label="状态">
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="due_date"
              label={
                <Space size={6}>
                  <span>截止时间</span>
                  <Switch
                    size="small"
                    checked={showExactTime}
                    onChange={(checked) => {
                      setShowExactTime(checked);
                      // When disabling exact time, strip to midnight
                      if (!checked) {
                        const cur = form.getFieldValue('due_date');
                        if (cur) form.setFieldValue('due_date', cur.startOf('day'));
                      }
                    }}
                    checkedChildren="精确时间"
                    unCheckedChildren="精确时间"
                  />
                </Space>
              }
            >
              <DatePicker
                showTime={showExactTime ? { format: 'HH:mm', defaultValue: dayjs('23:59', 'HH:mm') } : false}
                format={showExactTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD'}
                style={{ width: '100%' }}
                placeholder="选择截止日期"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="category_id" label="分类">
              <Select
                placeholder="选择分类"
                allowClear
                options={categoryOptions}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="tag_ids" label="标签">
              <Select
                mode="multiple"
                placeholder="选择标签"
                allowClear
                maxTagCount={3}
                options={tags.map((t) => ({ value: t.id, label: t.name }))}
                tagRender={({ label, value, closable, onClose }) => {
                  const tag = tags.find((t) => t.id === value);
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
            checkedChildren="推送提醒已开启"
            unCheckedChildren="不加入推送提醒"
          />
        </Form.Item>

        <Divider style={{ margin: '8px 0 16px' }} />

        <div className="editor-label">内容（Markdown）{uploading && <span style={{ color: '#6366f1', marginLeft: 8 }}>上传图片中...</span>}</div>
        <div className="bytemd-wrapper">
          <Editor
            value={content}
            plugins={plugins}
            onChange={setContent}
            uploadImages={uploadImages}
            locale={{ upload_images: '上传图片' }}
          />
        </div>
      </Form>
    </Drawer>
  );
}
