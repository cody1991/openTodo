import { useState } from 'react';
import './TodoCard.css';
import { Card, Tag, Space, Typography, Button, Dropdown, Badge, Tooltip } from 'antd';
import {
  EditOutlined, DeleteOutlined, CheckOutlined, MoreOutlined,
  ClockCircleOutlined, FireOutlined, ThunderboltOutlined,
  PlayCircleOutlined, UndoOutlined, SwapOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { Viewer } from '@bytemd/react';
import useAuthStore from '../../stores/authStore';
import { toUserTz } from '../../utils/date';
import gfm from '@bytemd/plugin-gfm';
import highlight from '@bytemd/plugin-highlight';

const { Text } = Typography;
const plugins = [gfm(), highlight()];

export default function TodoCard({ todo, onEdit, onDelete, onStatusChange, compact = false }) {
  const [expanded, setExpanded] = useState(true);
  const tz = useAuthStore((s) => s.user?.timezone || 'UTC');
  const { t } = useTranslation();

  const PRIORITY_CONFIG = {
    urgent: { color: '#ef4444', label: t('todoCard.urgent'), icon: <FireOutlined />,        cls: 'priority-urgent urgent-pulse' },
    high:   { color: '#f97316', label: t('todoCard.high'),   icon: <ThunderboltOutlined />, cls: 'priority-high' },
    medium: { color: '#eab308', label: t('todoCard.medium'), icon: <ClockCircleOutlined />, cls: 'priority-medium' },
    low:    { color: '#22c55e', label: t('todoCard.low'),    icon: null,                   cls: 'priority-low' },
  };

  const STATUS_CONFIG = {
    pending:     { color: 'default',    label: t('todoCard.pending') },
    in_progress: { color: 'processing', label: t('todoCard.inProgress') },
    completed:   { color: 'success',    label: t('todoCard.completed') },
  };

  const priority   = PRIORITY_CONFIG[todo.priority] || PRIORITY_CONFIG.medium;
  const status     = STATUS_CONFIG[todo.status]     || STATUS_CONFIG.pending;
  const isCompleted = todo.status === 'completed';
  const dueDayjs    = todo.due_date ? toUserTz(todo.due_date, tz) : null;
  const nowInTz     = dayjs().tz ? dayjs().tz(tz) : dayjs();
  const isOverdue   = dueDayjs && dueDayjs.isBefore(nowInTz) && !isCompleted;
  const isDueToday  = dueDayjs && dueDayjs.isSame(nowInTz, 'day') && !isCompleted;

  const menuItems = [
    { key: 'edit', icon: <EditOutlined />, label: t('todoCard.edit'), onClick: () => onEdit(todo) },
    ...(todo.status !== 'pending'
      ? [{ key: 'reset', icon: <UndoOutlined />, label: t('todoCard.resetToPending'), onClick: () => onStatusChange(todo.id, 'pending') }]
      : []),
    ...(todo.status !== 'in_progress'
      ? [{ key: 'progress', icon: <PlayCircleOutlined />, label: t('todoCard.markInProgress'), onClick: () => onStatusChange(todo.id, 'in_progress') }]
      : []),
    { type: 'divider' },
    { key: 'delete', icon: <DeleteOutlined />, label: t('todoCard.delete'), danger: true, onClick: () => onDelete(todo.id) },
  ];

  return (
    <Card
      className={`todo-card ${priority.cls} ${isCompleted ? 'todo-completed' : ''}`}
      size="small"
      styles={{ body: { padding: '12px 16px' } }}
    >
      <div className="todo-card-header">
        {/* ── Complete toggle ── */}
        <Button
          type="text"
          size="small"
          className={`complete-btn ${isCompleted ? 'completed' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(todo.id, isCompleted ? 'pending' : 'completed');
          }}
          title={isCompleted ? t('todoCard.markIncomplete') : t('todoCard.markComplete')}
          icon={isCompleted ? <CheckOutlined style={{ color: '#22c55e', fontSize: 11 }} /> : null}
        />

        {/* ── Clickable title ── */}
        <div
          className="todo-title-area"
          onClick={() => onEdit(todo)}
          title={t('todoCard.clickToEdit')}
        >
          <Text
            strong
            style={{
              color: isCompleted ? '#9ca3af' : '#1a1d2e',
              textDecoration: isCompleted ? 'line-through' : 'none',
              fontSize: 14,
              display: 'block',
            }}
          >
            {todo.title}
          </Text>
        </div>

        {/* ── More menu ── */}
        <div className="todo-card-right">
          <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              style={{ color: '#9ca3af' }}
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        </div>
      </div>

      {/* ── Meta tags ── */}
      <div className="todo-card-meta">
        <Space size={6} wrap>
          <Tag color={priority.color} style={{ fontSize: 11, margin: 0 }}>
            {priority.icon} {priority.label}
          </Tag>

          <Dropdown
            trigger={['click']}
            placement="bottomLeft"
            menu={{
              items: Object.entries(STATUS_CONFIG)
                .filter(([key]) => key !== todo.status)
                .map(([key, cfg]) => ({
                  key,
                  icon: <Badge status={cfg.color} />,
                  label: cfg.label,
                  onClick: ({ domEvent }) => {
                    domEvent.stopPropagation();
                    onStatusChange(todo.id, key);
                  },
                })),
            }}
          >
            <span
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}
              onClick={(e) => e.stopPropagation()}
              title={t('todoCard.switchStatus')}
            >
              <Badge status={status.color} text={<span style={{ fontSize: 11, color: '#9ca3af' }}>{status.label}</span>} />
              <SwapOutlined style={{ fontSize: 9, color: '#c0c4cc' }} />
            </span>
          </Dropdown>

          {todo.category_name && (
            <Tag
              style={{
                fontSize: 11,
                margin: 0,
                background: `${todo.category_color}18`,
                borderColor: `${todo.category_color}40`,
                color: todo.category_color,
              }}
            >
              {todo.category_name}
            </Tag>
          )}

          {dueDayjs && (
            <Tooltip title={dueDayjs.format('YYYY-MM-DD HH:mm')}>
              <span style={{ fontSize: 11, color: isOverdue ? '#ef4444' : isDueToday ? '#f59e0b' : '#9ca3af' }}>
                <ClockCircleOutlined style={{ marginRight: 3 }} />
                {isOverdue
                  ? t('todoCard.overdue', { days: nowInTz.diff(dueDayjs, 'day') })
                  : isDueToday
                  ? t('todoCard.dueToday')
                  : dueDayjs.format('M/D')}
              </span>
            </Tooltip>
          )}

          {todo.tags?.map((tag) => (
            <Tag
              key={tag.id}
              style={{
                fontSize: 11,
                margin: 0,
                background: `${tag.color}15`,
                borderColor: `${tag.color}35`,
                color: tag.color,
              }}
            >
              {tag.name}
            </Tag>
          ))}
        </Space>
      </div>

      {/* ── Expandable content preview ── */}
      {!compact && todo.content && (
        <div className="todo-card-content">
          {expanded ? (
            <>
              <div className="markdown-preview-sm">
                <Viewer value={todo.content} plugins={plugins} />
              </div>
              <Button
                type="link"
                size="small"
                onClick={() => setExpanded(false)}
                style={{ padding: 0, marginTop: 4, fontSize: 12 }}
              >
                {t('todoCard.collapse')}
              </Button>
            </>
          ) : (
            <Button
              type="link"
              size="small"
              onClick={() => setExpanded(true)}
              style={{ padding: 0, fontSize: 12 }}
            >
              {t('todoCard.expand')}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
