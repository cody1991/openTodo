import { useState } from 'react';
import {
  Tabs, Table, Button, Space, Tag, Modal, Form, Input, Select, Popconfirm,
  Typography, message, Card, Checkbox, Row, Col, Divider,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, LockOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { adminApi } from '../../services/api';
import './AdminPage.css';

const { Title, Text } = Typography;

export default function AdminPage() {
  const { t } = useTranslation();

  const tabItems = [
    { key: 'users', label: t('admin.users'), children: <UsersTab /> },
    { key: 'roles', label: t('admin.roles'), children: <RolesTab /> },
  ];

  return (
    <div className="admin-page fade-in">
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, color: '#e2e8f0' }}>
          <span className="gradient-text">{t('admin.title')}</span>
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
  const { t } = useTranslation();

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
      message.success(t('admin.createUserSuccess'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setModalOpen(false);
    },
    onError: (e) => message.error(e.message || t('admin.createFailed')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => adminApi.updateUser(id, data),
    onSuccess: () => {
      message.success(t('admin.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: () => {
      message.success(t('admin.deleted'));
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
    { title: t('admin.username'), dataIndex: 'username', render: (v) => <Text style={{ color: '#e2e8f0' }}>{v}</Text> },
    { title: t('admin.email'), dataIndex: 'email', render: (v) => <Text type="secondary">{v}</Text> },
    {
      title: t('admin.role'),
      dataIndex: 'role_name',
      render: (v) => <Tag color={v === 'admin' ? 'volcano' : 'blue'}>{v}</Tag>,
    },
    {
      title: t('admin.createdAt'),
      dataIndex: 'created_at',
      render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(v).format('YYYY-MM-DD')}</Text>,
    },
    {
      title: t('admin.actions'),
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} type="text" />
          <Popconfirm title={t('admin.confirmDelete')} onConfirm={() => deleteMutation.mutate(record.id)}>
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
          {t('admin.newUser')}
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
        title={editing ? t('admin.editUser') : t('admin.newUser')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" label={t('admin.usernameLabel')} rules={[{ required: !editing }]}>
            <Input prefix={<UserOutlined />} placeholder={t('admin.usernameLabel')} />
          </Form.Item>
          <Form.Item name="email" label={t('admin.emailLabel')} rules={[{ required: !editing, type: 'email' }]}>
            <Input placeholder={t('admin.emailLabel')} />
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? t('admin.passwordEditLabel') : t('admin.passwordLabel')}
            rules={[{ required: !editing, min: 8 }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder={t('admin.passwordPlaceholder')} />
          </Form.Item>
          <Form.Item name="role_id" label={t('admin.roleLabel')}>
            <Select options={roles.map((r) => ({ value: r.id, label: r.name }))} />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMutation.isPending || updateMutation.isPending}
              block
            >
              {editing ? t('admin.saveBtn') : t('admin.createBtn')}
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
  const { t } = useTranslation();

  const ALL_PERMISSIONS = [
    { group: t('admin.permGroups.TODO'), items: [
      { key: 'todos:read', label: t('admin.perms.read') },
      { key: 'todos:write', label: t('admin.perms.writeEdit') },
      { key: 'todos:delete', label: t('admin.perms.delete') },
    ]},
    { group: t('admin.permGroups.categories'), items: [
      { key: 'categories:read', label: t('admin.perms.read') },
      { key: 'categories:write', label: t('admin.perms.writeEdit') },
      { key: 'categories:delete', label: t('admin.perms.delete') },
    ]},
    { group: t('admin.permGroups.tags'), items: [
      { key: 'tags:read', label: t('admin.perms.read') },
      { key: 'tags:write', label: t('admin.perms.writeEdit') },
      { key: 'tags:delete', label: t('admin.perms.delete') },
    ]},
    { group: t('admin.permGroups.users'), items: [
      { key: 'users:read', label: t('admin.perms.viewUser') },
      { key: 'users:write', label: t('admin.perms.writeUser') },
      { key: 'users:delete', label: t('admin.perms.deleteUser') },
    ]},
    { group: t('admin.permGroups.roles'), items: [
      { key: 'roles:read', label: t('admin.perms.viewRole') },
      { key: 'roles:write', label: t('admin.perms.writeRole') },
      { key: 'roles:delete', label: t('admin.perms.deleteRole') },
    ]},
    { group: t('admin.permGroups.system'), items: [
      { key: 'admin:access', label: t('admin.perms.adminAccess') },
    ]},
  ];

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: adminApi.getRoles,
  });

  const createMutation = useMutation({
    mutationFn: adminApi.createRole,
    onSuccess: () => {
      message.success(t('admin.createRoleSuccess'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      setModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => adminApi.updateRole(id, data),
    onSuccess: () => {
      message.success(t('admin.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      setModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteRole,
    onSuccess: () => {
      message.success(t('admin.deleted'));
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
    if (!roleName.trim()) return message.error(t('admin.roleNameRequired'));
    const payload = { name: roleName, permissions: selectedPerms };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const columns = [
    { title: t('admin.roleName'), dataIndex: 'name', render: (v, r) => (
      <Space>
        <Tag color={r.id === 1 ? 'volcano' : 'blue'}>{v}</Tag>
        {r.id <= 2 && <Text type="secondary" style={{ fontSize: 11 }}>{t('admin.builtIn')}</Text>}
      </Space>
    )},
    {
      title: t('admin.permissions'),
      dataIndex: 'permissions',
      render: (perms) => (
        <Space wrap size={4}>
          {(perms || []).slice(0, 5).map((p) => <Tag key={p} style={{ fontSize: 11 }}>{p}</Tag>)}
          {(perms || []).length > 5 && <Tag>+{perms.length - 5}</Tag>}
        </Space>
      ),
    },
    {
      title: t('admin.actions'),
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} type="text" />
          {record.id > 2 && (
            <Popconfirm title={t('admin.confirmDeleteRole')} onConfirm={() => deleteMutation.mutate(record.id)}>
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
          {t('admin.newRole')}
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
        title={editing ? t('admin.editRole') : t('admin.newRole')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={onSave}
        okText={t('admin.roleSaved')}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={600}
      >
        <Form layout="vertical">
          <Form.Item label={t('admin.roleNameLabel')} required>
            <Input
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder={t('admin.roleNamePlaceholder')}
            />
          </Form.Item>
          <Divider style={{ borderColor: '#2d2d4e' }}>{t('admin.permissionsConfig')}</Divider>
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
