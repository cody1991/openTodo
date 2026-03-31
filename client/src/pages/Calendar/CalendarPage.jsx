import { useState, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { Typography, Modal, Space, Button, Spin } from 'antd';
import { PlusOutlined, FireOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { statsApi, todoApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { toUserTz } from '../../utils/date';
import TodoEditor from '../../components/TodoEditor/TodoEditor';
import './CalendarPage.css';

const { Text, Title } = Typography;

const PRIORITY_COLORS = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#6366f1',
  low: '#22c55e',
};

export default function CalendarPage() {
  const tz = useAuthStore((s) => s.user?.timezone || 'UTC');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [defaultDate, setDefaultDate] = useState(null);
  const [viewRange, setViewRange] = useState(null);
  const [moreModal, setMoreModal] = useState(null); // { date, events }
  const calRef = useRef(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['stats', 'calendar', viewRange],
    queryFn: () =>
      statsApi.calendar(
        viewRange || {
          start: dayjs().tz(tz).startOf('month').toISOString(),
          end: dayjs().tz(tz).endOf('month').toISOString(),
        }
      ),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => todoApi.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stats', 'calendar'] }),
  });

  const todos = data?.todos || [];

  const calendarEvents = todos.map((todo) => {
    const date = todo.due_date || todo.created_at;
    return {
      id: String(todo.id),
      title: todo.title,
      start: dayjs.utc(date).tz(tz).format('YYYY-MM-DD'),
      allDay: true,
      backgroundColor: PRIORITY_COLORS[todo.priority] || '#6366f1',
      borderColor: PRIORITY_COLORS[todo.priority] || '#6366f1',
      textColor: '#fff',
      extendedProps: { todo },
      classNames: [
        todo.status === 'completed' ? 'event-completed' : '',
        todo.priority === 'urgent' ? 'event-urgent' : '',
      ].filter(Boolean),
    };
  });

  const handleDateClick = ({ dateStr }) => {
    setEditingTodoId(null);
    setDefaultDate(dateStr);
    setEditorOpen(true);
  };

  const handleEventClick = ({ event }) => {
    setEditingTodoId(Number(event.id));
    setEditorOpen(true);
  };

  const handleDatesSet = ({ startStr, endStr }) => {
    setViewRange({ start: startStr, end: endStr });
  };

  const handleMoreLinkClick = ({ date, allSegs }) => {
    setMoreModal({
      date: dayjs(date).format('YYYY年M月D日'),
      events: allSegs.map((s) => s.event),
    });
    return 'stop';
  };

  const isMobile = window.innerWidth < 768;

  return (
    <div className="calendar-page fade-in">
      <div className="calendar-header">
        <Title level={3} style={{ margin: 0, color: '#e2e8f0' }}>
          <span className="gradient-text">日历</span>
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setEditingTodoId(null); setDefaultDate(null); setEditorOpen(true); }}
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
        >
          新建 TODO
        </Button>
      </div>

      <div className="calendar-legend">
        {Object.entries(PRIORITY_COLORS).map(([priority, color]) => (
          <Space key={priority} size={4}>
            <span className="legend-dot" style={{ background: color }} />
            <Text style={{ fontSize: 12, color: '#94a3b8' }}>
              {{ urgent: '紧急', high: '高', medium: '中', low: '低' }[priority]}
            </Text>
          </Space>
        ))}
        <Space size={4}>
          <span className="legend-dot completed-dot" />
          <Text style={{ fontSize: 12, color: '#94a3b8' }}>已完成</Text>
        </Space>
      </div>

      {isLoading && (
        <div className="calendar-loading">
          <Spin />
        </div>
      )}

      <div className="calendar-container">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
          initialView={isMobile ? 'listMonth' : 'dayGridMonth'}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: isMobile ? 'listMonth' : 'dayGridMonth,listMonth',
          }}
          buttonText={{ today: '今天', month: '月', list: '列表' }}
          locale="zh-cn"
          firstDay={1}
          events={calendarEvents}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          eventContent={EventContent}
          moreLinkText={(n) => `+${n} 更多`}
          moreLinkClick={handleMoreLinkClick}
          dayMaxEvents={3}
          height="auto"
        />
      </div>

      <TodoEditor
        todoId={editingTodoId}
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingTodoId(null); }}
        defaultDate={defaultDate}
      />

      <Modal
        open={!!moreModal}
        onCancel={() => setMoreModal(null)}
        footer={null}
        title={<span style={{ fontWeight: 600, fontSize: 15 }}>{moreModal?.date}</span>}
        width={360}
        className="more-events-modal"
      >
        <div className="more-events-list">
          {moreModal?.events.map((event) => {
            const { todo } = event.extendedProps;
            return (
              <div
                key={event.id}
                className="more-event-item"
                style={{ borderLeft: `3px solid ${event.backgroundColor}` }}
                onClick={() => {
                  setMoreModal(null);
                  setEditingTodoId(Number(event.id));
                  setEditorOpen(true);
                }}
              >
                <div className="more-event-item-left">
                  {todo.priority === 'urgent' && (
                    <FireOutlined style={{ color: event.backgroundColor, fontSize: 12, flexShrink: 0 }} />
                  )}
                  <span
                    className={`more-event-title${todo.status === 'completed' ? ' more-event-completed' : ''}`}
                  >
                    {event.title}
                  </span>
                </div>
                {todo.status === 'completed' && (
                  <CheckCircleOutlined style={{ color: '#22c55e', fontSize: 13, flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

function EventContent({ event }) {
  const { todo } = event.extendedProps;
  return (
    <div className="cal-event">
      {todo.priority === 'urgent' && <FireOutlined style={{ fontSize: 10, marginRight: 2 }} />}
      <span className="cal-event-title">{event.title}</span>
    </div>
  );
}
