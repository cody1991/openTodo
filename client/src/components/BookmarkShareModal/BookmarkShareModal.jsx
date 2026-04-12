import { useState, useMemo } from 'react';
import {
  Modal, Steps, Button, Input, Checkbox, Select, Radio,
  Tag, Space, Typography, message, Tooltip, Tree, Empty, Switch,
} from 'antd';
import {
  ShareAltOutlined, EyeOutlined, CopyOutlined, CheckOutlined,
  FolderOutlined, FileTextOutlined, ClockCircleOutlined,
  SettingOutlined, LinkOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import dayjs from 'dayjs';
import { bookmarkCategoryApi, bookmarkApi, bookmarkShareApi } from '../../services/api';
import '../ShareModal/ShareModal.css';

const { Text, Title } = Typography;

function CatDot({ color }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 8, height: 8,
      borderRadius: '50%',
      background: color || '#6366f1',
      flexShrink: 0,
    }} />
  );
}

const KEEP_EXPIRES = '__keep__';

export default function BookmarkShareModal({ open, onClose, editLink = null }) {
  const isEditMode = !!editLink;
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const [copied, setCopied] = useState(false);
  const [createdLink, setCreatedLink] = useState(null);

  const [name, setName] = useState(editLink?.name ?? t('bookmarkShare.defaultName'));
  const [headline, setHeadline] = useState(editLink?.headline ?? '');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(editLink?.category_ids ?? null);
  const [excludedBookmarkIds, setExcludedBookmarkIds] = useState(editLink?.excluded_bookmark_ids ?? []);
  const [expiresIn, setExpiresIn] = useState(isEditMode ? KEEP_EXPIRES : 'never');
  const [theme, setTheme] = useState(editLink?.theme ?? 'light');

  const EXPIRES_OPTIONS = [
    { label: t('share.expires.30m'),  value: '30m' },
    { label: t('share.expires.1h'),   value: '1h' },
    { label: t('share.expires.1d'),   value: '1d' },
    { label: t('share.expires.7d'),   value: '7d' },
    { label: t('share.expires.30d'),  value: '30d' },
    { label: t('share.expires.90d'),  value: '90d' },
    { label: t('share.expires.180d'), value: '180d' },
    { label: t('share.expires.365d'), value: '365d' },
    { label: t('share.expires.never'), value: 'never' },
  ];

  const STEPS = [
    { title: t('bookmarkShare.steps.basicInfo'),        icon: <SettingOutlined /> },
    { title: t('bookmarkShare.steps.selectCategories'), icon: <FolderOutlined /> },
    { title: t('bookmarkShare.steps.blockItems'),       icon: <FileTextOutlined /> },
    { title: t('bookmarkShare.steps.validity'),         icon: <ClockCircleOutlined /> },
  ];

  const THEMES = [
    { value: 'light',   label: t('share.themes.light'),   desc: t('share.themes.lightDesc'),   preview: 'linear-gradient(135deg,#f8fafc 0%,#e0e7ff 100%)', accent: '#6366f1' },
    { value: 'dark',    label: t('share.themes.dark'),    desc: t('share.themes.darkDesc'),    preview: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%)', accent: '#818cf8' },
    { value: 'vibrant', label: t('share.themes.vibrant'), desc: t('share.themes.vibrantDesc'), preview: 'linear-gradient(135deg,#fdf4ff 0%,#ffe4e6 50%,#fef9c3 100%)', accent: '#ec4899' },
    { value: 'minimal', label: t('share.themes.minimal'), desc: t('share.themes.minimalDesc'), preview: 'linear-gradient(135deg,#ffffff 0%,#f1f5f9 100%)', accent: '#334155' },
  ];

  const { data: categoriesData } = useQuery({
    queryKey: ['bookmark-categories'],
    queryFn: bookmarkCategoryApi.list,
    enabled: open,
  });

  const { data: bookmarksData } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => bookmarkApi.list({}),
    enabled: open,
    staleTime: 0,
  });

  const categories = categoriesData?.categories || [];
  const bookmarks = bookmarksData?.bookmarks || [];

  const createMutation = useMutation({
    mutationFn: bookmarkShareApi.create,
    onSuccess: (link) => {
      setCreatedLink(link);
      queryClient.invalidateQueries({ queryKey: ['bookmark-share-links'] });
      message.success(t('share.created'));
    },
    onError: (e) => message.error(e.message || t('share.createFailed')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => bookmarkShareApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmark-share-links'] });
      message.success(t('share.updated'));
      handleClose();
    },
    onError: (e) => message.error(e.message || t('share.saveFailed')),
  });

  const rootCategories = categories.filter((c) => !c.parent_id);
  const getSubCategories = (parentId) => categories.filter((c) => c.parent_id === parentId);

  const categoryTreeData = [
    ...rootCategories.map((parent) => ({
      title: (
        <span className="cat-tree-item">
          <CatDot color={parent.color} />
          <span className="cat-tree-name">{parent.name}</span>
        </span>
      ),
      key: `cat-${parent.id}`,
      value: parent.id,
      children: getSubCategories(parent.id).map((sub) => ({
        title: (
          <span className="cat-tree-item cat-tree-item--sub">
            <CatDot color={sub.color || parent.color} />
            <span className="cat-tree-name">{sub.name}</span>
          </span>
        ),
        key: `cat-${sub.id}`,
        value: sub.id,
      })),
    })),
    {
      title: (
        <span className="cat-tree-item cat-tree-item--uncategorized">
          <CatDot color="#475569" />
          <span className="cat-tree-name">{t('share.uncategorized')}</span>
        </span>
      ),
      key: 'cat--1',
      value: -1,
    },
  ];

  const handleCategoryCheck = (checkedKeys) => {
    const ids = checkedKeys
      .filter((k) => k.startsWith('cat-'))
      .map((k) => parseInt(k.replace('cat-', '')));
    setSelectedCategoryIds(ids.length === 0 ? null : ids);
    setExcludedBookmarkIds([]);
  };

  const handleCreate = async () => {
    const payload = {
      name: name.trim() || t('bookmarkShare.defaultName'),
      headline: headline.trim() || null,
      category_ids: selectedCategoryIds,
      excluded_bookmark_ids: excludedBookmarkIds,
      ...(expiresIn !== KEEP_EXPIRES && { expires_in: expiresIn }),
      theme,
    };
    if (isEditMode) {
      updateMutation.mutate({ id: editLink.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const getShareUrl = (key) => `${window.location.origin}/bookmark-share/${key}`;

  const handleCopy = (url) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setCurrent(0);
    setCreatedLink(null);
    setName(t('bookmarkShare.defaultName'));
    setHeadline('');
    setSelectedCategoryIds(null);
    setExcludedBookmarkIds([]);
    setExpiresIn('never');
    setTheme('light');
  };

  const handleClose = () => {
    if (!isEditMode) handleReset();
    onClose();
  };

  const checkedKeys = selectedCategoryIds
    ? selectedCategoryIds.map((id) => `cat-${id}`)
    : [];

  const renderStep = () => {
    switch (current) {
      case 0:
        return (
          <div className="share-step">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ marginBottom: 6, fontSize: 13, color: '#374151' }}>{t('share.nameLabel')}</div>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('bookmarkShare.namePlaceholder')}
                  maxLength={50}
                  showCount
                />
              </div>
              <div>
                <div style={{ marginBottom: 6, fontSize: 13, color: '#374151' }}>{t('share.headlineLabel')}</div>
                <Input.TextArea
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder={t('bookmarkShare.headlinePlaceholder')}
                  rows={3}
                  maxLength={200}
                  showCount
                />
              </div>
              <div>
                <div style={{ marginBottom: 10, fontSize: 13, color: '#374151', fontWeight: 500 }}>{t('share.themeLabel')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {THEMES.map((thm) => (
                    <div
                      key={thm.value}
                      onClick={() => setTheme(thm.value)}
                      style={{
                        borderRadius: 10,
                        border: `2px solid ${theme === thm.value ? thm.accent : '#e2e8f0'}`,
                        cursor: 'pointer',
                        overflow: 'hidden',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                        boxShadow: theme === thm.value ? `0 0 0 3px ${thm.accent}22` : 'none',
                      }}
                    >
                      <div style={{ height: 52, background: thm.preview }} />
                      <div style={{ padding: '6px 8px', background: '#fff' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: theme === thm.value ? thm.accent : '#374151' }}>
                          {thm.label}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{thm.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="share-step">
            <div className="step-hint">
              <Text type="secondary">{t('bookmarkShare.categoryHint')}</Text>
            </div>
            <div className="category-tree-wrap">
              {categoryTreeData.length === 0 ? (
                <Empty description={t('share.noCategories')} />
              ) : (
                <Tree
                  checkable
                  treeData={categoryTreeData}
                  checkedKeys={checkedKeys}
                  onCheck={handleCategoryCheck}
                  defaultExpandAll
                />
              )}
            </div>
            <div className="selection-summary">
              {selectedCategoryIds === null ? (
                <Tag color="blue">{t('bookmarkShare.shareAll')}</Tag>
              ) : (
                <Tag color="purple">{t('share.selectedCategories', { count: selectedCategoryIds.length })}</Tag>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="share-step">
            <div className="step-hint">
              <Text type="secondary">{t('bookmarkShare.blockHint')}</Text>
            </div>
            {bookmarks.length === 0 ? (
              <Empty description={t('bookmarkShare.noBookmarks')} />
            ) : (
              <Checkbox.Group
                value={excludedBookmarkIds}
                onChange={setExcludedBookmarkIds}
                className="exclude-todo-list"
              >
                {bookmarks.map((bm) => {
                  const cat = categories.find((c) => c.id === bm.category_id);
                  return (
                    <div key={bm.id} className="exclude-todo-item">
                      <Checkbox value={bm.id}>
                        <Space size={6}>
                          <span>{bm.title}</span>
                          {cat && (
                            <Tag
                              color={cat.color}
                              style={{ fontSize: 11, padding: '0 4px' }}
                            >
                              {cat.name}
                            </Tag>
                          )}
                        </Space>
                      </Checkbox>
                    </div>
                  );
                })}
              </Checkbox.Group>
            )}
            {excludedBookmarkIds.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <Tag color="red">{t('share.blocked', { count: excludedBookmarkIds.length })}</Tag>
              </div>
            )}
          </div>
        );

      case 3: {
        const currentExpiry = isEditMode && editLink.expires_at;
        const expiresOptions = isEditMode
          ? [{ label: t('share.keepExpiry'), value: KEEP_EXPIRES }, ...EXPIRES_OPTIONS]
          : EXPIRES_OPTIONS;
        return (
          <div className="share-step">
            <div className="step-hint">
              <Text type="secondary">{t('share.expiryHint')}</Text>
              {isEditMode && currentExpiry && (
                <div style={{ marginTop: 6 }}>
                  <Tag color={dayjs(editLink.expires_at).isBefore(dayjs()) ? 'red' : 'blue'}>
                    {t('share.currentExpiry', { date: dayjs(editLink.expires_at).format('YYYY-MM-DD HH:mm') })}
                  </Tag>
                </div>
              )}
              {isEditMode && !currentExpiry && (
                <div style={{ marginTop: 6 }}>
                  <Tag color="green">{t('share.permanent')}</Tag>
                </div>
              )}
            </div>
            <Radio.Group
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              className="expires-radio-group"
            >
              {expiresOptions.map((opt) => (
                <Radio.Button key={opt.value} value={opt.value} className="expires-radio-btn">
                  {opt.label}
                </Radio.Button>
              ))}
            </Radio.Group>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={
        <Space>
          <ShareAltOutlined style={{ color: '#6366f1' }} />
          <span>{isEditMode ? t('bookmarkShare.editTitle') : t('bookmarkShare.title')}</span>
        </Space>
      }
      width={640}
      className="share-modal"
      footer={null}
      destroyOnHidden
    >
      {createdLink ? (
        <div className="share-success">
          <div className="share-success-icon">🎉</div>
          <Title level={4} style={{ textAlign: 'center' }}>
            {t('share.linkGenerated')}
          </Title>
          <div className="share-url-box">
            <Input
              readOnly
              value={getShareUrl(createdLink.key)}
              suffix={
                <Tooltip title={copied ? t('common.copied') : t('common.copy')}>
                  <Button
                    type="text"
                    size="small"
                    icon={copied ? <CheckOutlined style={{ color: '#52c41a' }} /> : <CopyOutlined />}
                    onClick={() => handleCopy(getShareUrl(createdLink.key))}
                  />
                </Tooltip>
              }
            />
          </div>
          <div className="share-qr-wrap">
            <QRCodeSVG
              value={getShareUrl(createdLink.key)}
              size={140}
              bgColor="transparent"
              fgColor="#6366f1"
              level="M"
            />
            <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8, fontSize: 12 }}>
              {t('share.scanQr')}
            </Text>
          </div>
          <Space style={{ marginTop: 16, justifyContent: 'center', width: '100%' }}>
            <Button
              type="primary"
              icon={<EyeOutlined />}
              onClick={() => window.open(`/bookmark-share/${createdLink.key}`, '_blank')}
            >
              {t('share.previewPage')}
            </Button>
            <Button onClick={handleReset}>{t('share.createAnother')}</Button>
            <Button onClick={handleClose}>{t('common.done')}</Button>
          </Space>
        </div>
      ) : (
        <>
          <Steps
            current={current}
            items={STEPS}
            size="small"
            className="share-steps"
          />
          <div className="share-step-content">{renderStep()}</div>
          <div className="share-footer">
            {current > 0 && (
              <Button onClick={() => setCurrent((c) => c - 1)}>{t('common.prev')}</Button>
            )}
            <div style={{ flex: 1 }} />
            {isEditMode && (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={updateMutation.isPending}
                onClick={handleCreate}
              >
                {t('share.saveChanges')}
              </Button>
            )}
            {current < STEPS.length - 1 ? (
              <Button type={isEditMode ? 'default' : 'primary'} onClick={() => setCurrent((c) => c + 1)}>
                {t('common.next')}
              </Button>
            ) : (
              !isEditMode && (
                <Button
                  type="primary"
                  icon={<LinkOutlined />}
                  loading={createMutation.isPending}
                  onClick={handleCreate}
                >
                  {t('share.generate')}
                </Button>
              )
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
