import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Form, Input, Button, Alert, Tabs } from 'antd';
import {
  UserOutlined, LockOutlined, MailOutlined,
  CheckSquareOutlined, ArrowRightOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';
import './LoginPage.css';

function LoginForm({ onSuccess }) {
  const [error, setError] = useState('');
  const { login, loading } = useAuthStore();

  const onFinish = async (values) => {
    setError('');
    try {
      await login(values);
      onSuccess();
    } catch (err) {
      setError(err.message || '用户名或密码错误');
    }
  };

  return (
    <>
      {error && (
        <Alert message={error} type="error" showIcon
          style={{ marginBottom: 16, borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 13 }}
        />
      )}
      <Form className="login-form" layout="vertical" onFinish={onFinish}>
        <Form.Item name="username" rules={[{ required: true, message: '请输入用户名或邮箱' }]}>
          <Input prefix={<UserOutlined />} placeholder="用户名 / 邮箱" size="large" autoComplete="username" />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
          <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" autoComplete="current-password" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={loading} className="login-btn" size="large">
            {!loading && '登录'}
            {!loading && <ArrowRightOutlined />}
          </Button>
        </Form.Item>
      </Form>
    </>
  );
}

function RegisterForm({ onSuccess }) {
  const [error, setError] = useState('');
  const { register, loading } = useAuthStore();

  const onFinish = async (values) => {
    setError('');
    try {
      await register({ username: values.username, email: values.email, password: values.password });
      onSuccess();
    } catch (err) {
      setError(err.message || '注册失败，请重试');
    }
  };

  return (
    <>
      {error && (
        <Alert message={error} type="error" showIcon
          style={{ marginBottom: 16, borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 13 }}
        />
      )}
      <Form className="login-form" layout="vertical" onFinish={onFinish}>
        <Form.Item name="username" rules={[
          { required: true, message: '请输入用户名' },
          { min: 3, message: '用户名至少 3 位' },
        ]}>
          <Input prefix={<UserOutlined />} placeholder="用户名" size="large" autoComplete="username" />
        </Form.Item>
        <Form.Item name="email" rules={[
          { required: true, message: '请输入邮箱' },
          { type: 'email', message: '邮箱格式不正确' },
        ]}>
          <Input prefix={<MailOutlined />} placeholder="邮箱" size="large" autoComplete="email" />
        </Form.Item>
        <Form.Item name="password" rules={[
          { required: true, message: '请输入密码' },
          { min: 8, message: '密码至少 8 位' },
        ]}>
          <Input.Password prefix={<LockOutlined />} placeholder="密码（至少 8 位）" size="large" autoComplete="new-password" />
        </Form.Item>
        <Form.Item name="confirm" dependencies={['password']} rules={[
          { required: true, message: '请确认密码' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) return Promise.resolve();
              return Promise.reject(new Error('两次密码不一致'));
            },
          }),
        ]}>
          <Input.Password prefix={<LockOutlined />} placeholder="确认密码" size="large" autoComplete="new-password" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={loading} className="login-btn" size="large">
            {!loading && '立即注册'}
            {!loading && <ArrowRightOutlined />}
          </Button>
        </Form.Item>
      </Form>
    </>
  );
}

export default function LoginPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/todos';

  const onSuccess = () => navigate(from, { replace: true });

  const tabs = [
    { key: 'login', label: '登录', children: <LoginForm onSuccess={onSuccess} /> },
    { key: 'register', label: '注册', children: <RegisterForm onSuccess={onSuccess} /> },
  ];

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-orb orb-1" />
        <div className="login-orb orb-2" />
      </div>

      <div className="login-card">
        {user && (
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} size="small"
            style={{ marginBottom: 14, color: '#6366f1', padding: 0, fontWeight: 500 }}
          >
            返回
          </Button>
        )}

        <div className="login-logo">
          <div className="login-logo-icon-wrap">
            <CheckSquareOutlined />
          </div>
          <span className="gradient-text login-logo-text">OpenTodo</span>
        </div>

        <p className="login-subtitle">专注当下，掌控每一个任务</p>

        <Tabs items={tabs} centered className="login-tabs" />
      </div>
    </div>
  );
}
