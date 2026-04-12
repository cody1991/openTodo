import { useState } from 'react';
import {
  Modal, Button, Space, Tag, Tooltip, Popconfirm, Empty, Spin, Badge,
} from 'antd';
import {
  ShareAltOutlined, LinkOutlined, CopyOutlined, EyeOutlined,
  DeleteOutlined, ClockCircleOutlined, PlusOutlined, QrcodeOutlined, EditOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { bookmarkShareApi } from '../../services/api';
import BookmarkShareModal from '../BookmarkShareModal/BookmarkShareModal';
import '../ShareLinksModal/ShareLinksModal.css';

export default function BookmarkShareLinksModal({ open, onClose }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [expandedQr, setExpandedQr] = useState(null);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['bookmark-share-links'],
    queryFn: bookmarkShareApi.list,
    enabled: open,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => bookmarkShareApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmark-share-links'] });
    },
  });

  const getShareUrl = (key) => `${window.location.origin}/bookmark-share/${key}`;

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
            <span>{t('bookmarkShare.linksTitle')}</span>
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
              {t('bookmarkShare.newShare')}
            </Button>
            <Button onClick={onClose}>{t('shareLinksModal.close')}</Button>
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
            description={t('bookmarkShare.linksEmpty')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '32px 0' }}
          >
            <Button type="primary" icon={<ShareAltOutlined />} onClick={() => setCreateOpen(true)}>
              {t('bookmarkShare.createFirst')}
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
                  <div className="slm-top">
                    <div className="slm-info">
                      <div className="slm-name-row">
                        <LinkOutlined style={{ color: expired ? '#94a3b8' : '#6366f1', fontSize: 13 }} />
                        <span className="slm-name">{link.name}</span>
                        {expired && <Tag bordered={false} color="default">{t('shareLinksModal.expired')}</Tag>}
                        {!expired && !link.expires_at && <Tag bordered={false} color="success">{t('shareLinksModal.permanent')}</Tag>}
                        {!expired && link.expires_at && (
                          <Tag bordered={false} color={daysLeft < 3 ? 'orange' : 'blue'}>
                            {daysLeft === 0
                              ? t('shareLinksModal.expiresToday')
                              : t('shareLinksModal.expiresOn', { date: dayjs(link.expires_at).format('MM/DD') })}
                          </Tag>
                        )}
                      </div>
                      {link.headline && <div className="slm-headline">{link.headline}</div>}
                    </div>

                    <Space size={4} className="slm-actions">
                      <Tooltip title={copiedKey === link.key ? t('shareLinksModal.copied') : t('shareLinksModal.copyLink')}>
                        <Button
                          size="small" type="text"
                          icon={<CopyOutlined />}
                          style={{ color: copiedKey === link.key ? '#22c55e' : '#64748b' }}
                          onClick={() => handleCopy(link.key)}
                          disabled={expired}
                        />
                      </Tooltip>
                      <Tooltip title={t('shareLinksModal.preview')}>
                        <Button
                          size="small" type="text"
                          icon={<EyeOutlined />}
                          style={{ color: '#64748b' }}
                          onClick={() => window.open(`/bookmark-share/${link.key}`, '_blank')}
                          disabled={expired}
                        />
                      </Tooltip>
                      <Tooltip title={showQr ? t('shareLinksModal.hideQr') : t('shareLinksModal.showQr')}>
                        <Button
                          size="small" type="text"
                          icon={<QrcodeOutlined />}
                          style={{ color: showQr ? '#6366f1' : '#64748b' }}
                          onClick={() => setExpandedQr(showQr ? null : link.id)}
                          disabled={expired}
                        />
                      </Tooltip>
                      <Tooltip title={t('shareLinksModal.edit')}>
                        <Button
                          size="small" type="text"
                          icon={<EditOutlined />}
                          style={{ color: '#6366f1' }}
                          onClick={() => setEditingLink(link)}
                        />
                      </Tooltip>
                      <Popconfirm
                        title={t('shareLinksModal.deleteConfirm')}
                        description={t('shareLinksModal.deleteDesc')}
                        onConfirm={() => deleteMutation.mutate(link.id)}
                        okText={t('shareLinksModal.deleteOk')}
                        cancelText={t('shareLinksModal.deleteCancel')}
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

                  <div className="slm-stats">
                    <span className="slm-stat">
                      <EyeOutlined /> {t('shareLinksModal.views', { count: link.view_count })}
                    </span>
                    {link.last_viewed_at && (
                      <span className="slm-stat">
                        {t('shareLinksModal.lastVisited', { time: dayjs(link.last_viewed_at).format('MM-DD HH:mm') })}
                      </span>
                    )}
                    <span className="slm-stat">
                      <ClockCircleOutlined /> {t('shareLinksModal.createdAt', { date: dayjs(link.created_at).format('YYYY-MM-DD') })}
                    </span>
                  </div>

                  <div className="slm-url">
                    <code className="slm-code">{url}</code>
                  </div>

                  {showQr && !expired && (
                    <div className="slm-qr">
                      <QRCodeSVG value={url} size={110} bgColor="transparent" fgColor="#6366f1" level="M" />
                      <span className="slm-qr-label">{t('shareLinksModal.scanQr')}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <BookmarkShareModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <BookmarkShareModal
        key={editingLink?.id ?? 'edit'}
        open={!!editingLink}
        onClose={() => setEditingLink(null)}
        editLink={editingLink}
      />
    </>
  );
}
