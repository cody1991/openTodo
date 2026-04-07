import { useState } from 'react';
import {
  Card, Button, Input, Space, Typography, Tag, Popconfirm,
  message, Empty, Modal, Form, ColorPicker, Tooltip, Spin, Row, Col,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, TagsOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tagApi } from '../../services/api';
import './TagsPage.css';

const { Title, Text } = Typography;

const PRESET_COLORS = [
  '#f5222d', '#fa541c', '#fa8c16', '#faad14', '#fadb14',
  '#a0d911', '#52c41a', '#13c2c2', '#1677ff', '#2f54eb',
  '#722ed1', '#eb2f96', '#8c8c8c', '#595959',
];

export default function TagsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [form] = Form.useForm();
  const [search, setSearch] = useState('');

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: tagApi.list,
    select: (res) => res.tags || res || [],
  });

  const createMutation = useMutation({
    mutationFn: tagApi.create,
    onSuccess: () => {
      message.success('标签创建成功');
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      closeModal();
    },
    onError: (e) => message.error(e.message || '创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => tagApi.update(id, data),
    onSuccess: () => {
      message.success('标签更新成功');
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      closeModal();
    },
    onError: (e) => message.error(e.message || '更新失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: tagApi.delete,
    onSuccess: () => {
      message.success('标签已删除');
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (e) => message.error(e.message || '删除失败'),
  });

  function openCreate() {
    setEditingTag(null);
    form.setFieldsValue({ name: '', color: '#1677ff' });
    setModalOpen(true);
  }

  function openEdit(tag) {
    setEditingTag(tag);
    form.setFieldsValue({ name: tag.name, color: tag.color });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingTag(null);
    form.resetFields();
  }

  function handleSubmit(values) {
    const color =
      typeof values.color === 'string'
        ? values.color
        : values.color?.toHexString?.() || '#1677ff';
    if (editingTag) {
      updateMutation.mutate({ id: editingTag.id, data: { name: values.name, color } });
    } else {
      createMutation.mutate({ name: values.name, color });
    }
  }

  const filtered = tags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="tags-page fade-in">
      <div className="tags-page-header">
        <Title level={3} style={{ color: '#e2e8f0', margin: 0 }}>
          <TagsOutlined style={{ marginRight: 8 }} />
          <span className="gradient-text">标签管理</span>
        </Title>
        <Space>
          <Input
            placeholder="搜索标签…"
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 180 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建标签
          </Button>
        </Space>
      </div>

      <Card className="tags-card">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : filtered.length === 0 ? (
          <Empty
            description={
              <Text style={{ color: '#94a3b8' }}>
                {search ? '未找到匹配的标签' : '还没有标签，点击「新建标签」开始吧'}
              </Text>
            }
          />
        ) : (
          <Row gutter={[12, 12]}>
            {filtered.map((tag) => (
              <Col key={tag.id} xs={24} sm={12} md={8} lg={6}>
                <div className="tag-item">
                  <Tag
                    style={{
                      fontSize: 13,
                      padding: '4px 10px',
                      borderRadius: 20,
                      background: `${tag.color}20`,
                      borderColor: `${tag.color}50`,
                      color: tag.color,
                      flex: 1,
                      textAlign: 'center',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tag.name}
                  </Tag>
                  <Space size={4}>
                    <Tooltip title="编辑">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => openEdit(tag)}
                        style={{ color: '#6366f1' }}
                      />
                    </Tooltip>
                    <Popconfirm
                      title="确认删除这个标签？"
                      description="删除后，已关联该标签的 TODO 将同步移除此标签。"
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => deleteMutation.mutate(tag.id)}
                    >
                      <Tooltip title="删除">
                        <Button
                          type="text"
                          size="small"
                          icon={<DeleteOutlined />}
                          loading={deleteMutation.isPending && deleteMutation.variables === tag.id}
                          style={{ color: '#f87171' }}
                        />
                      </Tooltip>
                    </Popconfirm>
                  </Space>
                </div>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      <Modal
        title={
          <span style={{ color: '#e2e8f0' }}>
            {editingTag ? '编辑标签' : '新建标签'}
          </span>
        }
        open={modalOpen}
        onCancel={closeModal}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label={<span style={{ color: '#94a3b8' }}>标签名称</span>}
            rules={[{ required: true, message: '请输入标签名称' }, { max: 20, message: '最多 20 个字符' }]}
          >
            <Input placeholder="输入标签名称" maxLength={20} showCount />
          </Form.Item>

          <Form.Item
            name="color"
            label={<span style={{ color: '#94a3b8' }}>标签颜色</span>}
            rules={[{ required: true, message: '请选择颜色' }]}
          >
            <ColorPicker
              presets={[{ label: '预设颜色', colors: PRESET_COLORS }]}
              showText
              format="hex"
            />
          </Form.Item>

          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => {
              const name = getFieldValue('name');
              const color =
                typeof getFieldValue('color') === 'string'
                  ? getFieldValue('color')
                  : getFieldValue('color')?.toHexString?.() || '#1677ff';
              return name ? (
                <div style={{ marginBottom: 16 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>预览：</Text>
                  <br />
                  <Tag
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      padding: '3px 10px',
                      borderRadius: 20,
                      background: `${color}20`,
                      borderColor: `${color}50`,
                      color,
                    }}
                  >
                    {name}
                  </Tag>
                </div>
              ) : null;
            }}
          </Form.Item>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={closeModal}>取消</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editingTag ? '保存' : '创建'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
