import { useState, useRef } from 'react';
import {
  Card, Form, Input, Button, Switch, TimePicker, Select, Typography, message,
  Divider, Space, Alert, Row, Col, Tag,
} from 'antd';
import {
  LockOutlined, BellOutlined, WechatOutlined, SaveOutlined, CheckCircleOutlined,
  CameraOutlined, LoadingOutlined, GlobalOutlined,
} from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import useAuthStore from '../../stores/authStore';
import { authApi, uploadApi } from '../../services/api';
import './SettingsPage.css';

const { Title, Text } = Typography;

const TIMEZONE_OPTIONS = [
  { value: 'UTC',                label: 'UTC+0  协调世界时 (UTC)' },
  { value: 'Europe/London',      label: 'UTC+0  伦敦 (GMT/BST)' },
  { value: 'Europe/Paris',       label: 'UTC+1/+2  巴黎 (CET/CEST)' },
  { value: 'Europe/Amsterdam',   label: 'UTC+1/+2  阿姆斯特丹 (CET/CEST)' },
  { value: 'Europe/Moscow',      label: 'UTC+3  莫斯科 (MSK)' },
  { value: 'Asia/Dubai',         label: 'UTC+4  迪拜 (GST)' },
  { value: 'Asia/Kolkata',       label: 'UTC+5:30  印度 (IST)' },
  { value: 'Asia/Shanghai',      label: 'UTC+8  中国标准时间 (CST)' },
  { value: 'Asia/Hong_Kong',     label: 'UTC+8  香港 (HKT)' },
  { value: 'Asia/Singapore',     label: 'UTC+8  新加坡 (SGT)' },
  { value: 'Asia/Tokyo',         label: 'UTC+9  东京 (JST)' },
  { value: 'Australia/Sydney',   label: 'UTC+10/+11  悉尼 (AEST/AEDT)' },
  { value: 'Pacific/Auckland',   label: 'UTC+12/+13  奥克兰 (NZST/NZDT)' },
  { value: 'Pacific/Honolulu',   label: 'UTC-10  檀香山 (HST)' },
  { value: 'America/Los_Angeles',label: 'UTC-8/-7  洛杉矶 (PST/PDT)' },
  { value: 'America/Denver',     label: 'UTC-7/-6  丹佛 (MST/MDT)' },
  { value: 'America/Chicago',    label: 'UTC-6/-5  芝加哥 (CST/CDT)' },
  { value: 'America/New_York',   label: 'UTC-5/-4  纽约 (EST/EDT)' },
  { value: 'America/Sao_Paulo',  label: 'UTC-3  圣保罗 (BRT)' },
];


export default function SettingsPage() {
  const { user, updateUser, fetchMe } = useAuthStore();
  const [pwdForm] = Form.useForm();
  const [settingsForm] = Form.useForm();

  const [testSent, setTestSent] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const avatarInputRef = useRef(null);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      message.error('请选择图片文件');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error('图片大小不能超过 5MB');
      return;
    }
    setAvatarLoading(true);
    try {
      const res = await uploadApi.image(file);
      const url = res.url;
      await authApi.updateSettings({ avatar: url });
      updateUser({ avatar: url });
      message.success('头像更新成功');
    } catch (err) {
      message.error(err.message || '上传失败');
    } finally {
      setAvatarLoading(false);
      e.target.value = '';
    }
  };

  const pwdMutation = useMutation({
    mutationFn: authApi.updatePassword,
    onSuccess: () => {
      message.success('密码修改成功');
      pwdForm.resetFields();
    },
    onError: (e) => message.error(e.message || '修改失败'),
  });

  const settingsMutation = useMutation({
    mutationFn: authApi.updateSettings,
    onSuccess: async () => {
      message.success('设置保存成功');
      await fetchMe();
    },
    onError: (e) => message.error(e.message || '保存失败'),
  });

  return (
    <div className="settings-page fade-in">
      <Title level={3} style={{ color: '#e2e8f0', marginBottom: 24 }}>
        <span className="gradient-text">设置</span>
      </Title>

      <Row gutter={[16, 16]}>
        {/* Profile */}
        <Col xs={24} lg={12}>
          <Card
            className="settings-card"
            title={
              <Space>
                <LockOutlined style={{ color: '#6366f1' }} />
                <span style={{ color: '#e2e8f0' }}>修改密码</span>
              </Space>
            }
          >
            <div className="user-info">
              <div
                className="user-avatar user-avatar-upload"
                onClick={() => !avatarLoading && avatarInputRef.current?.click()}
                title="点击更换头像"
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
              <Form.Item name="currentPassword" label={<span style={{ color: '#94a3b8' }}>当前密码</span>}
                rules={[{ required: true, message: '请输入当前密码' }]}>
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
              <Form.Item name="newPassword" label={<span style={{ color: '#94a3b8' }}>新密码</span>}
                rules={[{ required: true, min: 8, message: '至少8位' }]}>
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
              <Form.Item name="confirm" label={<span style={{ color: '#94a3b8' }}>确认新密码</span>}
                dependencies={['newPassword']}
                rules={[
                  { required: true },
                  ({ getFieldValue }) => ({
                    validator(_, v) {
                      if (!v || getFieldValue('newPassword') === v) return Promise.resolve();
                      return Promise.reject('两次密码不一致');
                    },
                  }),
                ]}>
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={pwdMutation.isPending} icon={<SaveOutlined />}>
                修改密码
              </Button>
            </Form>
          </Card>
        </Col>

        {/* Notification settings */}
        <Col xs={24} lg={12}>
          <Card
            className="settings-card"
            title={
              <Space>
                <BellOutlined style={{ color: '#6366f1' }} />
                <span style={{ color: '#e2e8f0' }}>通知设置</span>
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
                  <Text style={{ color: '#e2e8f0' }}>开启通知</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>到期提醒和站内通知</Text>
                </div>
                <Form.Item name="notifications_enabled" valuePropName="checked" style={{ margin: 0 }}>
                  <Switch />
                </Form.Item>
              </div>

              <Divider style={{ borderColor: '#2d2d4e', margin: '12px 0' }} />

              <div className="settings-row">
                <div>
                  <Text style={{ color: '#e2e8f0' }}>每日报告</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>每天推送昨日完成和今日待办</Text>
                </div>
                <Form.Item name="daily_report_enabled" valuePropName="checked" style={{ margin: 0 }}>
                  <Switch />
                </Form.Item>
              </div>

              <Form.Item
                name="daily_report_time"
                label={<span style={{ color: '#94a3b8' }}>报告发送时间</span>}
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
                    <span style={{ color: '#94a3b8' }}>时区</span>
                  </Space>
                }
                extra={<Text type="secondary" style={{ fontSize: 12 }}>影响日期显示及报告发送时间，所有数据统一存储为 UTC+0</Text>}
              >
                <Select
                  showSearch
                  options={TIMEZONE_OPTIONS}
                  optionFilterProp="label"
                  placeholder="选择时区"
                />
              </Form.Item>

              <Divider style={{ borderColor: '#2d2d4e', margin: '12px 0' }} />

              <Form.Item
                name="wecom_webhook"
                label={
                  <Space>
                    <WechatOutlined style={{ color: '#07c160' }} />
                    <span style={{ color: '#94a3b8' }}>企业微信 Webhook</span>
                  </Space>
                }
                extra={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    在企业微信群中添加机器人，复制 Webhook 地址。保存并开启通知后，日报 / 待办提醒 / 新分享需求会推送到该群（需在服务器配置 PUBLIC_APP_URL 以便消息中带收件箱链接）
                  </Text>
                }
              >
                <Input placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." />
              </Form.Item>

              {testSent && (
                <Alert
                  message="测试消息已发送，请查看企业微信群"
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
                保存设置
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>

    </div>
  );
}
