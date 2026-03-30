import { useState } from 'react';
import {
  Tabs, Table, Button, Space, Tag, Modal, Form, Input, Select, Popconfirm,
  Typography, message, Card, Checkbox, Row, Col, Divider,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, LockOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { adminApi } from '../../services/api';
import './AdminPage.css';

const { Title, Text } = Typography;

const ALL_PERMISSIONS = [
  { group: 'TODO', items: [
    { key: 'todos:read', label: '查看' },
    { key: 'todos:write', label: '创建/编辑' },
    { key: 'todos:delete', label: '删除' },
  ]},
  { group: '分类', items: [
    { key: 'categories:read', label: '查看' },
    { key: 'categories:write', label: '创建/编辑' },
    { key: 'categories:delete', label: '删除' },
  ]},
  { group: '标签', items: [
    { key: 'tags:read', label: '查看' },
    { key: 'tags:write', label: '创建/编辑' },
    { key: 'tags:delete', label: '删除' },
  ]},
  { group: '用户管理', items: [
    { key: 'users:read', label: '查看用户' },
    { key: 'users:write', label: '创建/编辑用户' },
    { key: 'users:delete', label: '删除用户' },
  ]},
  { group: '角色管理', items: [
    { key: 'roles:read', label: '查看角色' },
    { key: 'roles:write', label: '创建/编辑角色' },
    { key: 'roles:delete', label: '删除角色' },
  ]},
  { group: '系统', items: [
    { key: 'admin:access', label: '管理员访问' },
  ]},
];

export default function AdminPage() {
  const tabItems = [
    { key: 'users', label: '用户管理', children: <UsersTab /> },
    { key: 'roles', label: '角色管理', children: <RolesTab /> },
  ];

  return (
    <div className="admin-page fade-in">
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, color: '#e2e8f0' }}>
          <span className="gradient-text">管理员后台</span>
        </Title>
      </div>
      <Tabs items={tabItems} className="admin-tabs" />
    </div>
  );
}

function UsersTab() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminApi.getUsers,
  });

  const { data: rolesData } = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: adminApi.getRoles,
  });

  const createMutation = useMutation({
    mutationFn: adminApi.createUser,
    onSuccess: () => {
      message.success('用户创建成功');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setModalOpen(false);
    },
    onError: (e) => message.error(e.message || '创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => adminApi.updateUser(id, data),
    onSuccess: () => {
      message.success('更新成功');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: () => {
      message.success('已删除');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e) => message.error(e.message),
  });

  const roles = rolesData?.roles || [];
  const users = data?.users || [];

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (user) => {
    setEditing(user);
    form.setFieldsValue({ username: user.username, email: user.email, role_id: user.role_id });
    setModalOpen(true);
  };

  const onFinish = (values) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...values });
    } else {
      createMutation.mutate(values);
    }
  };

  const columns = [
    { title: '用户名', dataIndex: 'username', render: (v) => <Text style={{ color: '#e2e8f0' }}>{v}</Text> },
    { title: '邮箱', dataIndex: 'email', render: (v) => <Text type="secondary">{v}</Text> },
    {
      title: '角色',
      dataIndex: 'role_name',
      render: (v) => (
        <Tag color={v === 'admin' ? 'volcano' : 'blue'}>{v}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(v).format('YYYY-MM-DD')}</Text>,
    },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} type="text" />
          <Popconfirm title="确认删除？" onConfirm={() => deleteMutation.mutate(record.id)}>
            <Button size="small" icon={<DeleteOutlined />} type="text" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card className="admin-card">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建用户
        </Button>
      </div>
      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        className="admin-table"
      />
      <Modal
        title={editing ? '编辑用户' : '新建用户'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" label="用户名" rules={[{ required: !editing }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: !editing, type: 'email' }]}>
            <Input placeholder="邮箱" />
          </Form.Item>
          <Form.Item name="password" label={editing ? '新密码（不填则不修改）' : '密码'} rules={[{ required: !editing, min: 8 }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码（至少8位）" />
          </Form.Item>
          <Form.Item name="role_id" label="角色">
            <Select options={roles.map((r) => ({ value: r.id, label: r.name }))} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={createMutation.isPending || updateMutation.isPending} block>
              {editing ? '保存' : '创建'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

function RolesTab() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedPerms, setSelectedPerms] = useState([]);
  const [roleName, setRoleName] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: adminApi.getRoles,
  });

  const createMutation = useMutation({
    mutationFn: adminApi.createRole,
    onSuccess: () => {
      message.success('角色创建成功');
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      setModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => adminApi.updateRole(id, data),
    onSuccess: () => {
      message.success('更新成功');
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      setModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteRole,
    onSuccess: () => {
      message.success('已删除');
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
    },
    onError: (e) => message.error(e.message),
  });

  const roles = data?.roles || [];

  const openCreate = () => {
    setEditing(null);
    setRoleName('');
    setSelectedPerms([]);
    setModalOpen(true);
  };

  const openEdit = (role) => {
    setEditing(role);
    setRoleName(role.name);
    setSelectedPerms(role.permissions || []);
    setModalOpen(true);
  };

  const onSave = () => {
    if (!roleName.trim()) return message.error('请输入角色名称');
    const payload = { name: roleName, permissions: selectedPerms };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const columns = [
    { title: '角色名', dataIndex: 'name', render: (v, r) => (
      <Space>
        <Tag color={r.id === 1 ? 'volcano' : 'blue'}>{v}</Tag>
        {r.id <= 2 && <Text type="secondary" style={{ fontSize: 11 }}>内置</Text>}
      </Space>
    )},
    {
      title: '权限',
      dataIndex: 'permissions',
      render: (perms) => (
        <Space wrap size={4}>
          {(perms || []).slice(0, 5).map((p) => <Tag key={p} style={{ fontSize: 11 }}>{p}</Tag>)}
          {(perms || []).length > 5 && <Tag>+{perms.length - 5}</Tag>}
        </Space>
      ),
    },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} type="text" />
          {record.id > 2 && (
            <Popconfirm title="确认删除该角色？" onConfirm={() => deleteMutation.mutate(record.id)}>
              <Button size="small" icon={<DeleteOutlined />} type="text" danger />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card className="admin-card">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建角色
        </Button>
      </div>
      <Table
        dataSource={roles}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        className="admin-table"
      />
      <Modal
        title={editing ? '编辑角色' : '新建角色'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={onSave}
        okText="保存"
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={600}
      >
        <Form layout="vertical">
          <Form.Item label="角色名称" required>
            <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="如：editor" />
          </Form.Item>
          <Divider style={{ borderColor: '#2d2d4e' }}>权限配置</Divider>
          {ALL_PERMISSIONS.map((group) => (
            <div key={group.group} style={{ marginBottom: 12 }}>
              <Text style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 6 }}>
                {group.group}
              </Text>
              <Row gutter={8}>
                {group.items.map((perm) => (
                  <Col key={perm.key} span={8}>
                    <Checkbox
                      checked={selectedPerms.includes(perm.key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPerms((p) => [...p, perm.key]);
                        } else {
                          setSelectedPerms((p) => p.filter((x) => x !== perm.key));
                        }
                      }}
                    >
                      <Text style={{ fontSize: 12, color: '#e2e8f0' }}>{perm.label}</Text>
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </div>
          ))}
        </Form>
      </Modal>
    </Card>
  );
}
