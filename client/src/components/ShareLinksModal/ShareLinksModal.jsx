import { useState } from 'react';
import {
  Modal, Button, Space, Tag, Tooltip, Popconfirm, Empty, Spin, Badge,
} from 'antd';
import {
  ShareAltOutlined, LinkOutlined, CopyOutlined, EyeOutlined,
  DeleteOutlined, ClockCircleOutlined, PlusOutlined, QrcodeOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import dayjs from 'dayjs';
import { shareApi } from '../../services/api';
import ShareModal from '../ShareModal/ShareModal';
import './ShareLinksModal.css';

export default function ShareLinksModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [expandedQr, setExpandedQr] = useState(null);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['share-links'],
    queryFn: shareApi.list,
    enabled: open,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => shareApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['share-links'] });
    },
  });

  const getShareUrl = (key) => `${window.location.origin}/share/${key}`;

  const handleCopy = (key) => {
    navigator.clipboard.writeText(getShareUrl(key));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isExpired = (link) => link.expires_at && dayjs(link.expires_at).isBefore(dayjs());

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        title={
          <Space>
            <ShareAltOutlined style={{ color: '#6366f1' }} />
            <span>我的分享链接</span>
            {links.length > 0 && <Badge count={links.length} color="#6366f1" />}
          </Space>
        }
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateOpen(true)}
            >
              新建分享
            </Button>
            <Button onClick={onClose}>关闭</Button>
          </div>
        }
        width={640}
        styles={{ body: { padding: '16px 24px', maxHeight: '65vh', overflowY: 'auto' } }}
        destroyOnClose={false}
      >
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
        ) : links.length === 0 ? (
          <Empty
            description="还没有分享链接"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '32px 0' }}
          >
            <Button type="primary" icon={<ShareAltOutlined />} onClick={() => setCreateOpen(true)}>
              创建第一个分享
            </Button>
          </Empty>
        ) : (
          <div className="slm-list">
            {links.map((link) => {
              const expired = isExpired(link);
              const url = getShareUrl(link.key);
              const showQr = expandedQr === link.id;
              const daysLeft = link.expires_at ? dayjs(link.expires_at).diff(dayjs(), 'day') : null;

              return (
                <div key={link.id} className={`slm-item ${expired ? 'slm-item--expired' : ''}`}>
                  {/* Top row */}
                  <div className="slm-top">
                    <div className="slm-info">
                      <div className="slm-name-row">
                        <LinkOutlined style={{ color: expired ? '#94a3b8' : '#6366f1', fontSize: 13 }} />
                        <span className="slm-name">{link.name}</span>
                        {expired && <Tag bordered={false} color="default">已过期</Tag>}
                        {!expired && !link.expires_at && <Tag bordered={false} color="success">永久有效</Tag>}
                        {!expired && link.expires_at && (
                          <Tag bordered={false} color={daysLeft < 3 ? 'orange' : 'blue'}>
                            {daysLeft === 0 ? '今天到期' : `${dayjs(link.expires_at).format('MM/DD')} 到期`}
                          </Tag>
                        )}
                      </div>
                      {link.headline && <div className="slm-headline">{link.headline}</div>}
                    </div>

                    <Space size={4} className="slm-actions">
                      <Tooltip title={copiedKey === link.key ? '已复制！' : '复制链接'}>
                        <Button
                          size="small" type="text"
                          icon={<CopyOutlined />}
                          style={{ color: copiedKey === link.key ? '#22c55e' : '#64748b' }}
                          onClick={() => handleCopy(link.key)}
                          disabled={expired}
                        />
                      </Tooltip>
                      <Tooltip title="在新标签页预览">
                        <Button
                          size="small" type="text"
                          icon={<EyeOutlined />}
                          style={{ color: '#64748b' }}
                          onClick={() => window.open(`/share/${link.key}`, '_blank')}
                          disabled={expired}
                        />
                      </Tooltip>
                      <Tooltip title={showQr ? '收起二维码' : '显示二维码'}>
                        <Button
                          size="small" type="text"
                          icon={<QrcodeOutlined />}
                          style={{ color: showQr ? '#6366f1' : '#64748b' }}
                          onClick={() => setExpandedQr(showQr ? null : link.id)}
                          disabled={expired}
                        />
                      </Tooltip>
                      <Popconfirm
                        title="确定删除这个分享链接吗？"
                        description="删除后该链接将立即失效"
                        onConfirm={() => deleteMutation.mutate(link.id)}
                        okText="删除" cancelText="取消"
                        okButtonProps={{ danger: true }}
                      >
                        <Button
                          size="small" type="text"
                          icon={<DeleteOutlined />}
                          style={{ color: '#ef4444' }}
                          loading={deleteMutation.isPending}
                        />
                      </Popconfirm>
                    </Space>
                  </div>

                  {/* Stats row */}
                  <div className="slm-stats">
                    <span className="slm-stat">
                      <EyeOutlined /> {link.view_count} 次浏览
                    </span>
                    {link.last_viewed_at && (
                      <span className="slm-stat">
                        最近访问 {dayjs(link.last_viewed_at).format('MM-DD HH:mm')}
                      </span>
                    )}
                    <span className="slm-stat">
                      <ClockCircleOutlined /> {dayjs(link.created_at).format('YYYY-MM-DD')} 创建
                    </span>
                  </div>

                  {/* URL */}
                  <div className="slm-url">
                    <code className="slm-code">{url}</code>
                  </div>

                  {/* QR Code */}
                  {showQr && !expired && (
                    <div className="slm-qr">
                      <QRCodeSVG value={url} size={110} bgColor="transparent" fgColor="#6366f1" level="M" />
                      <span className="slm-qr-label">扫码访问</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <ShareModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
