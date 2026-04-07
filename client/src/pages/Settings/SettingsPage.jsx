import { useState, useRef } from 'react';
import {
  Card, Form, Input, Button, Switch, TimePicker, Select, Typography, message,
  Divider, Space, Alert, Row, Col, Tag,
} from 'antd';
import {
  LockOutlined, BellOutlined, WechatOutlined, SaveOutlined, CheckCircleOutlined,
  CameraOutlined, LoadingOutlined, GlobalOutlined, TranslationOutlined,
} from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import useAuthStore from '../../stores/authStore';
import { authApi, uploadApi } from '../../services/api';
import i18n, { SUPPORTED_LANGUAGES } from '../../i18n';
import './SettingsPage.css';

const { Title, Text } = Typography;

const TIMEZONE_KEYS = [
  'UTC', 'Europe/London', 'Europe/Paris', 'Europe/Amsterdam', 'Europe/Moscow',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore',
  'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland', 'Pacific/Honolulu',
  'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
  'America/Sao_Paulo',
];

export default function SettingsPage() {
  const { user, updateUser, fetchMe } = useAuthStore();
  const [pwdForm] = Form.useForm();
  const [settingsForm] = Form.useForm();
  const { t } = useTranslation();

  const [testSent, setTestSent] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const avatarInputRef = useRef(null);

  const timezoneOptions = TIMEZONE_KEYS.map((tz) => ({
    value: tz,
    label: t(`settings.timezones.${tz.replace(/\//g, '/')}`),
  }));

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      message.error(t('settings.avatarNotImage'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error(t('settings.avatarTooLarge'));
      return;
    }
    setAvatarLoading(true);
    try {
      const res = await uploadApi.image(file);
      const url = res.url;
      await authApi.updateSettings({ avatar: url });
      updateUser({ avatar: url });
      message.success(t('settings.avatarUpdated'));
    } catch (err) {
      message.error(err.message || t('settings.avatarUploadFailed'));
    } finally {
      setAvatarLoading(false);
      e.target.value = '';
    }
  };

  const pwdMutation = useMutation({
    mutationFn: authApi.updatePassword,
    onSuccess: () => {
      message.success(t('settings.passwordChanged'));
      pwdForm.resetFields();
    },
    onError: (e) => message.error(e.message || t('settings.passwordChangeFailed')),
  });

  const settingsMutation = useMutation({
    mutationFn: authApi.updateSettings,
    onSuccess: async () => {
      message.success(t('settings.settingsSaved'));
      await fetchMe();
    },
    onError: (e) => message.error(e.message || t('settings.settingsSaveFailed')),
  });

  const handleLangChange = (lang) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div className="settings-page fade-in">
      <Title level={3} style={{ color: '#e2e8f0', marginBottom: 24 }}>
        <span className="gradient-text">{t('settings.title')}</span>
      </Title>

      <Row gutter={[16, 16]}>
        {/* Password card */}
        <Col xs={24} lg={12}>
          <Card
            className="settings-card"
            title={
              <Space>
                <LockOutlined style={{ color: '#6366f1' }} />
                <span style={{ color: '#e2e8f0' }}>{t('settings.changePassword')}</span>
              </Space>
            }
          >
            <div className="user-info">
              <div
                className="user-avatar user-avatar-upload"
                onClick={() => !avatarLoading && avatarInputRef.current?.click()}
                title={t('settings.clickToChangeAvatar')}
              >
                {avatarLoading ? (
                  <LoadingOutlined style={{ fontSize: 20, color: 'white' }} />
                ) : user?.avatar ? (
                  <img src={user.avatar} alt="avatar" className="user-avatar-img" />
                ) : (
                  user?.username?.[0]?.toUpperCase()
                )}
                <div className="user-avatar-overlay">
                  <CameraOutlined style={{ fontSize: 16, color: 'white' }} />
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleAvatarChange}
                />
              </div>
              <div>
                <Text style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 15 }}>{user?.username}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 13 }}>{user?.email}</Text>
                <br />
                <Tag color={user?.role_name === 'admin' ? 'volcano' : 'blue'} style={{ marginTop: 4 }}>
                  {user?.role_name}
                </Tag>
              </div>
            </div>

            <Divider style={{ borderColor: '#2d2d4e' }} />

            <Form form={pwdForm} layout="vertical" onFinish={(v) => pwdMutation.mutate(v)}>
              <Form.Item name="currentPassword" label={<span style={{ color: '#94a3b8' }}>{t('settings.currentPassword')}</span>}
                rules={[{ required: true, message: t('settings.currentPasswordRequired') }]}>
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
              <Form.Item name="newPassword" label={<span style={{ color: '#94a3b8' }}>{t('settings.newPassword')}</span>}
                rules={[{ required: true, min: 8, message: t('settings.newPasswordMin') }]}>
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
              <Form.Item name="confirm" label={<span style={{ color: '#94a3b8' }}>{t('settings.confirmPassword')}</span>}
                dependencies={['newPassword']}
                rules={[
                  { required: true },
                  ({ getFieldValue }) => ({
                    validator(_, v) {
                      if (!v || getFieldValue('newPassword') === v) return Promise.resolve();
                      return Promise.reject(t('settings.passwordMismatch'));
                    },
                  }),
                ]}>
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={pwdMutation.isPending} icon={<SaveOutlined />}>
                {t('settings.savePassword')}
              </Button>
            </Form>
          </Card>
        </Col>

        {/* Notification + language settings */}
        <Col xs={24} lg={12}>
          {/* Language card */}
          <Card
            className="settings-card"
            style={{ marginBottom: 16 }}
            title={
              <Space>
                <TranslationOutlined style={{ color: '#6366f1' }} />
                <span style={{ color: '#e2e8f0' }}>{t('settings.language')}</span>
              </Space>
            }
          >
            <div className="settings-row">
              <Text style={{ color: '#e2e8f0' }}>{t('settings.languageLabel')}</Text>
              <Select
                value={i18n.language}
                onChange={handleLangChange}
                options={SUPPORTED_LANGUAGES.map((l) => ({ value: l.value, label: l.label }))}
                style={{ width: 160 }}
              />
            </div>
          </Card>

          <Card
            className="settings-card"
            title={
              <Space>
                <BellOutlined style={{ color: '#6366f1' }} />
                <span style={{ color: '#e2e8f0' }}>{t('settings.notifications')}</span>
              </Space>
            }
          >
            <Form
              form={settingsForm}
              layout="vertical"
              initialValues={{
                notifications_enabled: user?.notifications_enabled === 1,
                daily_report_enabled: user?.daily_report_enabled === 1,
                daily_report_time: user?.daily_report_time
                  ? dayjs(user.daily_report_time, 'HH:mm')
                  : dayjs('09:00', 'HH:mm'),
                wecom_webhook: user?.wecom_webhook || '',
                timezone: user?.timezone || 'UTC',
              }}
              onFinish={(values) => {
                settingsMutation.mutate({
                  notifications_enabled: values.notifications_enabled,
                  daily_report_enabled: values.daily_report_enabled,
                  daily_report_time: values.daily_report_time?.format('HH:mm'),
                  wecom_webhook: values.wecom_webhook,
                  timezone: values.timezone,
                });
              }}
            >
              <div className="settings-row">
                <div>
                  <Text style={{ color: '#e2e8f0' }}>{t('settings.enableNotifications')}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>{t('settings.notificationsHint')}</Text>
                </div>
                <Form.Item name="notifications_enabled" valuePropName="checked" style={{ margin: 0 }}>
                  <Switch />
                </Form.Item>
              </div>

              <Divider style={{ borderColor: '#2d2d4e', margin: '12px 0' }} />

              <div className="settings-row">
                <div>
                  <Text style={{ color: '#e2e8f0' }}>{t('settings.dailyReport')}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>{t('settings.dailyReportHint')}</Text>
                </div>
                <Form.Item name="daily_report_enabled" valuePropName="checked" style={{ margin: 0 }}>
                  <Switch />
                </Form.Item>
              </div>

              <Form.Item
                name="daily_report_time"
                label={<span style={{ color: '#94a3b8' }}>{t('settings.reportTime')}</span>}
                style={{ marginTop: 12 }}
              >
                <TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} />
              </Form.Item>

              <Divider style={{ borderColor: '#2d2d4e', margin: '12px 0' }} />

              <Form.Item
                name="timezone"
                label={
                  <Space>
                    <GlobalOutlined style={{ color: '#6366f1' }} />
                    <span style={{ color: '#94a3b8' }}>{t('settings.timezone')}</span>
                  </Space>
                }
                extra={<Text type="secondary" style={{ fontSize: 12 }}>{t('settings.timezoneHint')}</Text>}
              >
                <Select
                  showSearch
                  options={timezoneOptions}
                  optionFilterProp="label"
                  placeholder={t('settings.timezoneSelect')}
                />
              </Form.Item>

              <Divider style={{ borderColor: '#2d2d4e', margin: '12px 0' }} />

              <Form.Item
                name="wecom_webhook"
                label={
                  <Space>
                    <WechatOutlined style={{ color: '#07c160' }} />
                    <span style={{ color: '#94a3b8' }}>{t('settings.wecomWebhook')}</span>
                  </Space>
                }
                extra={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('settings.wecomHint')}
                  </Text>
                }
              >
                <Input placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." />
              </Form.Item>

              {testSent && (
                <Alert
                  message={t('settings.testSent')}
                  type="success"
                  icon={<CheckCircleOutlined />}
                  showIcon
                  style={{ marginBottom: 12 }}
                />
              )}

              <Button
                type="primary"
                htmlType="submit"
                loading={settingsMutation.isPending}
                icon={<SaveOutlined />}
                block
              >
                {t('settings.saveSettings')}
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>

    </div>
  );
}
