import { useState } from 'react';
import { Badge, Popover, List, Button, Empty, Typography, Space } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '../../services/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

export default function NotificationBell({ unreadCount }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationApi.list({ limit: 10 }),
    enabled: open,
  });

  const markAllRead = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = data?.notifications || [];

  const content = (
    <div style={{ width: 320, maxHeight: 400, overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text strong>通知</Text>
        {unreadCount > 0 && (
          <Button size="small" type="text" icon={<CheckOutlined />} onClick={() => markAllRead.mutate()}>
            全部已读
          </Button>
        )}
      </div>
      {notifications.length === 0 ? (
        <Empty description="暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={notifications}
          size="small"
          renderItem={(item) => (
            <List.Item
              style={{
                padding: '8px 0',
                opacity: item.is_read ? 0.6 : 1,
                borderBottom: '1px solid #2d2d4e',
              }}
            >
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text strong style={{ fontSize: 13 }}>{item.title}</Text>
                  {!item.is_read && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', flexShrink: 0, marginTop: 4 }} />
                  )}
                </div>
                {item.content && <Text type="secondary" style={{ fontSize: 12 }}>{item.content}</Text>}
                <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(item.created_at).fromNow()}</Text>
              </Space>
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
    >
      <Badge count={unreadCount} size="small">
        <Button
          type="text"
          icon={<BellOutlined />}
          style={{ color: unreadCount > 0 ? '#6366f1' : 'var(--text-secondary)' }}
        />
      </Badge>
    </Popover>
  );
}
