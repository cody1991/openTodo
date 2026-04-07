import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Form, Input, Button, Alert, Tabs } from 'antd';
import {
  UserOutlined, LockOutlined, MailOutlined,
  CheckSquareOutlined, ArrowRightOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../../stores/authStore';
import i18n, { SUPPORTED_LANGUAGES } from '../../i18n';
import './LoginPage.css';

function LoginForm({ onSuccess }) {
  const [error, setError] = useState('');
  const { login, loading } = useAuthStore();
  const { t } = useTranslation();

  const onFinish = async (values) => {
    setError('');
    try {
      await login(values);
      onSuccess();
    } catch (err) {
      setError(err.message || t('login.loginError'));
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
        <Form.Item name="username" rules={[{ required: true, message: t('login.rules.usernameRequired') }]}>
          <Input prefix={<UserOutlined />} placeholder={t('login.username')} size="large" autoComplete="username" />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true, message: t('login.rules.passwordRequired') }]}>
          <Input.Password prefix={<LockOutlined />} placeholder={t('login.password')} size="large" autoComplete="current-password" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={loading} className="login-btn" size="large">
            {!loading && t('login.login')}
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
  const { t } = useTranslation();

  const onFinish = async (values) => {
    setError('');
    try {
      await register({ username: values.username, email: values.email, password: values.password });
      onSuccess();
    } catch (err) {
      setError(err.message || t('login.registerError'));
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
          { required: true, message: t('login.rules.usernameRequired2') },
          { min: 3, message: t('login.rules.usernameMinLength') },
        ]}>
          <Input prefix={<UserOutlined />} placeholder={t('login.usernameOnly')} size="large" autoComplete="username" />
        </Form.Item>
        <Form.Item name="email" rules={[
          { required: true, message: t('login.rules.emailRequired') },
          { type: 'email', message: t('login.rules.emailInvalid') },
        ]}>
          <Input prefix={<MailOutlined />} placeholder={t('login.email')} size="large" autoComplete="email" />
        </Form.Item>
        <Form.Item name="password" rules={[
          { required: true, message: t('login.rules.passwordRequired2') },
          { min: 8, message: t('login.rules.passwordMinLength') },
        ]}>
          <Input.Password prefix={<LockOutlined />} placeholder={t('login.passwordMinLength')} size="large" autoComplete="new-password" />
        </Form.Item>
        <Form.Item name="confirm" dependencies={['password']} rules={[
          { required: true, message: t('login.rules.confirmRequired') },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) return Promise.resolve();
              return Promise.reject(new Error(t('login.rules.passwordMismatch')));
            },
          }),
        ]}>
          <Input.Password prefix={<LockOutlined />} placeholder={t('login.confirmPassword')} size="large" autoComplete="new-password" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={loading} className="login-btn" size="large">
            {!loading && t('login.loginNow')}
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
  const { t } = useTranslation();
  const from = location.state?.from?.pathname || '/todos';

  const onSuccess = () => navigate(from, { replace: true });

  const tabs = [
    { key: 'login', label: t('login.login'), children: <LoginForm onSuccess={onSuccess} /> },
    { key: 'register', label: t('login.register'), children: <RegisterForm onSuccess={onSuccess} /> },
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
            {t('login.back')}
          </Button>
        )}

        <div className="login-logo">
          <div className="login-logo-icon-wrap">
            <CheckSquareOutlined />
          </div>
          <span className="gradient-text login-logo-text">OpenTodo</span>
        </div>

        <p className="login-subtitle">{t('login.subtitle')}</p>

        <Tabs items={tabs} centered className="login-tabs" />

        <div className="login-lang-bar">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              className={`login-lang-btn${i18n.language === lang.value ? ' active' : ''}`}
              onClick={() => i18n.changeLanguage(lang.value)}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
