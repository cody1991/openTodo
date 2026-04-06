import { useState, useEffect, useMemo } from 'react';
import {
  Drawer, Form, Input, Select, DatePicker, Button, Space, Tag, Divider, message,
  Row, Col, Switch,
} from 'antd';
import { Editor } from '@bytemd/react';
import gfm from '@bytemd/plugin-gfm';
import highlight from '@bytemd/plugin-highlight';
import axios from 'axios';
import dayjs from 'dayjs';
import { toUTCString } from '../../utils/date';
import 'bytemd/dist/index.css';
import 'highlight.js/styles/github-dark.css';
import '../TodoEditor/TodoEditor.css';

const PRIORITY_OPTIONS = [
  { value: 'low', label: '🟢 低优先级' },
  { value: 'medium', label: '🟡 中优先级' },
  { value: 'high', label: '🟠 高优先级' },
  { value: 'urgent', label: '🔴 紧急' },
];

const plugins = [gfm(), highlight()];

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

export default function ShareRequestDrawer({
  open,
  onClose,
  shareKey,
  categories = [],
  tags = [],
  ownerTimezone = 'UTC',
}) {
  const [form] = Form.useForm();
  const [content, setContent] = useState('');
  const [showExactTime, setShowExactTime] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const categoryOptions = useMemo(() => buildCategoryOptions(categories), [categories]);

  useEffect(() => {
    if (open) {
      form.resetFields();
      setContent('');
      setShowExactTime(false);
      form.setFieldsValue({
        priority: 'high',
        tag_ids: [],
      });
    }
  }, [open, form]);

  const onFinish = async (values) => {
    setSubmitting(true);
    try {
      const due = values.due_date ? toUTCString(values.due_date, ownerTimezone) : null;
      await axios.post(
        `/api/public/share/${shareKey}/requests`,
        {
          title: values.title,
          content: content || '',
          priority: values.priority,
          due_date: due,
          category_id: values.category_id ?? null,
          tag_ids: values.tag_ids || [],
          contact: values.contact?.trim() || null,
        },
        { withCredentials: true }
      );
      message.success('已提交，分享主审核后会处理');
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '提交失败';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      title={<span style={{ fontWeight: 600 }}>提需求</span>}
      open={open}
      onClose={onClose}
      footer={(
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            loading={submitting}
            onClick={() => form.submit()}
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
          >
            提交
          </Button>
        </Space>
      )}
      styles={{ wrapper: { width: 720 }, body: { padding: '16px 24px' } }}
    >
      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ priority: 'high' }}>
        <Form.Item
          name="title"
          label="标题"
          rules={[{ required: true, message: '请输入标题' }]}
        >
          <Input placeholder="简要描述你的需求…" size="large" className="editor-input" />
        </Form.Item>

        <Form.Item name="contact" label="联系方式（选填）">
          <Input placeholder="邮箱或昵称，便于对方回复" maxLength={200} />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="priority" label="优先级">
              <Select options={PRIORITY_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="due_date"
              label={(
                <Space size={6}>
                  <span>期望完成时间</span>
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
                showTime={showExactTime ? { format: 'HH:mm', defaultValue: dayjs('23:59', 'HH:mm') } : false}
                format={showExactTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD'}
                style={{ width: '100%' }}
                placeholder="选择日期"
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

        <Divider style={{ margin: '8px 0 16px' }} />

        <div className="editor-label">内容（Markdown，可粘贴图片链接）</div>
        <div className="bytemd-wrapper">
          <Editor value={content} plugins={plugins} onChange={setContent} />
        </div>
      </Form>
    </Drawer>
  );
}
