import { useState } from 'react';
import './TodoCard.css';
import { Card, Tag, Space, Typography, Button, Dropdown, Badge, Tooltip } from 'antd';
import {
  EditOutlined, DeleteOutlined, CheckOutlined, MoreOutlined,
  ClockCircleOutlined, FireOutlined, ThunderboltOutlined,
  PlayCircleOutlined, UndoOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Viewer } from '@bytemd/react';
import useAuthStore from '../../stores/authStore';
import { toUserTz } from '../../utils/date';
import gfm from '@bytemd/plugin-gfm';
import highlight from '@bytemd/plugin-highlight';

const { Text } = Typography;
const plugins = [gfm(), highlight()];

const PRIORITY_CONFIG = {
  urgent: { color: '#ef4444', label: '紧急', icon: <FireOutlined />,        cls: 'priority-urgent urgent-pulse' },
  high:   { color: '#f97316', label: '高',   icon: <ThunderboltOutlined />, cls: 'priority-high' },
  medium: { color: '#eab308', label: '中',   icon: <ClockCircleOutlined />, cls: 'priority-medium' },
  low:    { color: '#22c55e', label: '低',   icon: null,                   cls: 'priority-low' },
};

const STATUS_CONFIG = {
  pending:     { color: 'default',    label: '待处理' },
  in_progress: { color: 'processing', label: '进行中' },
  completed:   { color: 'success',    label: '已完成' },
};

export default function TodoCard({ todo, onEdit, onDelete, onStatusChange, compact = false }) {
  const [expanded, setExpanded] = useState(true);
  const tz = useAuthStore((s) => s.user?.timezone || 'UTC');

  const priority   = PRIORITY_CONFIG[todo.priority] || PRIORITY_CONFIG.medium;
  const status     = STATUS_CONFIG[todo.status]     || STATUS_CONFIG.pending;
  const isCompleted = todo.status === 'completed';
  const dueDayjs    = todo.due_date ? toUserTz(todo.due_date, tz) : null;
  const nowInTz     = dayjs().tz ? dayjs().tz(tz) : dayjs();
  const isOverdue   = dueDayjs && dueDayjs.isBefore(nowInTz) && !isCompleted;
  const isDueToday  = dueDayjs && dueDayjs.isSame(nowInTz, 'day') && !isCompleted;

  const menuItems = [
    { key: 'edit', icon: <EditOutlined />, label: '编辑', onClick: () => onEdit(todo) },
    ...(todo.status !== 'pending'
      ? [{ key: 'reset', icon: <UndoOutlined />, label: '重置为待处理', onClick: () => onStatusChange(todo.id, 'pending') }]
      : []),
    ...(todo.status !== 'in_progress'
      ? [{ key: 'progress', icon: <PlayCircleOutlined />, label: '标为进行中', onClick: () => onStatusChange(todo.id, 'in_progress') }]
      : []),
    { type: 'divider' },
    { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true, onClick: () => onDelete(todo.id) },
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
          title={isCompleted ? '标为未完成' : '标为完成'}
          icon={isCompleted ? <CheckOutlined style={{ color: '#22c55e', fontSize: 11 }} /> : null}
        />

        {/* ── Clickable title ── */}
        <div
          className="todo-title-area"
          onClick={() => onEdit(todo)}
          title="点击编辑"
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

          <Badge
            status={status.color}
            text={<span style={{ fontSize: 11, color: '#9ca3af' }}>{status.label}</span>}
          />

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
                  ? `逾期 ${nowInTz.diff(dueDayjs, 'day')} 天`
                  : isDueToday
                  ? '今天截止'
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
                收起
              </Button>
            </>
          ) : (
            <Button
              type="link"
              size="small"
              onClick={() => setExpanded(true)}
              style={{ padding: 0, fontSize: 12 }}
            >
              展开内容
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
