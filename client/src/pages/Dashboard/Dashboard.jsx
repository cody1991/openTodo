import { useEffect, useRef } from 'react';
import { Row, Col, Card, Typography, Tag, Progress, Empty, Spin, Space, Badge } from 'antd';
import {
  FireOutlined, ClockCircleOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, ThunderboltOutlined, TrophyOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Line, Pie } from '@ant-design/charts';
import dayjs from 'dayjs';
import { statsApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { toUserTz } from '../../utils/date';
import './Dashboard.css';

const { Title, Text } = Typography;

function CountUp({ value, duration = 900 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const end = value || 0;
    const step = end / (duration / 16);
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + step, end);
      if (ref.current) ref.current.textContent = Math.floor(current);
      if (current >= end) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <span ref={ref}>0</span>;
}

function StatCard({ title, value, suffix, icon, color, bgColor }) {
  return (
    <Card className="stat-card" styles={{ body: { padding: "18px" } }}>
      <div className="stat-card-bg" style={{ background: `radial-gradient(circle at 80% 50%, ${color}, transparent 70%)` }} />
      <div className="stat-card-inner">
        <div className="stat-icon" style={{ background: bgColor || `${color}18`, color }}>
          {icon}
        </div>
        <div>
          <div className="stat-value" style={{ color }}>
            <CountUp value={value} />
            {suffix && <span className="stat-suffix">{suffix}</span>}
          </div>
          <div className="stat-title">{title}</div>
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const tz = useAuthStore((s) => s.user?.timezone || 'UTC');
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['stats', 'dashboard'],
    queryFn: statsApi.dashboard,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  const { overview = {}, byCategory = [], byPriority = [], last7Days = [], urgentTodos = [] } = data || {};

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const date = dayjs().tz(tz).subtract(6 - i, 'day').format('YYYY-MM-DD');
    const found = last7Days.find((d) => d.date === date);
    return { date: dayjs(date).format('M/D'), count: found?.count || 0 };
  });

  const completionRate = overview.total
    ? Math.round(((overview.completed || 0) / overview.total) * 100)
    : 0;

  return (
    <div className="dashboard fade-in">
      <div className="dashboard-header">
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: -0.5, color: 'var(--text-primary)' }}>
            <span className="gradient-text">{t('dashboard.title')}</span>
          </Title>
          <div className="dashboard-date">
            {dayjs().tz(tz).format(t('common.dateTimeFormat'))}
            {overview.due_today > 0 && (
              <span style={{ marginLeft: 12, color: '#ffd166' }}>
                {t('dashboard.dueToday', { count: overview.due_today })}
              </span>
            )}
          </div>
        </div>
        {overview.overdue > 0 && (
          <Tag
            icon={<ExclamationCircleOutlined />}
            style={{
              background: 'rgba(255,77,109,0.1)',
              border: '1px solid rgba(255,77,109,0.3)',
              color: '#ff4d6d',
              padding: '5px 12px',
              fontSize: 13,
              borderRadius: 8,
            }}
          >
            {t('dashboard.overdue', { count: overview.overdue })}
          </Tag>
        )}
      </div>

      {/* Stat row */}
      <Row gutter={[14, 14]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={12} md={6}>
          <StatCard title={t('dashboard.pending')} value={overview.pending} icon={<span>📋</span>} color="#7c6ef5" />
        </Col>
        <Col xs={12} sm={12} md={6}>
          <StatCard title={t('dashboard.dueToday2')} value={overview.due_today} icon={<ClockCircleOutlined />} color="#06d6c7" />
        </Col>
        <Col xs={12} sm={12} md={6}>
          <StatCard title={t('dashboard.urgentTasks')} value={overview.urgent} icon={<FireOutlined />} color="#ff4d6d" />
        </Col>
        <Col xs={12} sm={12} md={6}>
          <StatCard
            title={t('dashboard.completed')}
            value={overview.completed}
            suffix={`/ ${overview.total || 0}`}
            icon={<TrophyOutlined />}
            color="#06d6a0"
          />
        </Col>
      </Row>

      <Row gutter={[14, 14]} style={{ marginBottom: 20 }}>
        {/* Completion ring */}
        <Col xs={24} sm={24} md={7}>
          <Card className="chart-card" styles={{ body: { padding: "18px" } }}>
            <div className="chart-card-title" style={{ marginBottom: 16 }}>{t('dashboard.completionRate')}</div>
            <div className="completion-ring">
              <Progress
                type="circle"
                percent={completionRate}
                size={130}
                strokeColor={{ '0%': '#7c6ef5', '100%': '#06d6c7' }}
                railColor="rgba(255,255,255,0.05)"
                strokeWidth={8}
                format={(p) => (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#1a1d2e', lineHeight: 1 }}>{p}%</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('dashboard.completionRate')}</div>
                  </div>
                )}
              />
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                {t('dashboard.total', { total: overview.total || 0, completed: overview.completed || 0 })}
              </span>
            </div>
          </Card>
        </Col>

        {/* 7-day trend */}
        <Col xs={24} sm={24} md={17}>
          <Card className="chart-card" styles={{ body: { padding: "18px" } }}>
            <div className="chart-card-title" style={{ marginBottom: 16 }}>{t('dashboard.last7Days')}</div>
            <Line
              data={chartData}
              xField="date"
              yField="count"
              smooth
              point={{ size: 5, shape: 'circle', style: { fill: '#7c6ef5', stroke: '#7c6ef5' } }}
              color="#7c6ef5"
              area={{
                style: {
                  fill: 'l(270) 0:rgba(124,110,245,0) 1:rgba(124,110,245,0.25)',
                  fillOpacity: 1,
                },
              }}
              yAxis={{
                label: { style: { fill: 'var(--text-muted)', fontSize: 11 } },
                grid: { line: { style: { stroke: 'rgba(255,255,255,0.04)', lineWidth: 1 } } },
              }}
              xAxis={{ label: { style: { fill: 'var(--text-muted)', fontSize: 11 } } }}
              tooltip={{
                domStyles: {
                  'g2-tooltip': {
                    background: '#12131f',
                    border: '1px solid rgba(124,110,245,0.3)',
                    borderRadius: 8,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                    color: '#f1f2f7',
                  },
                },
              }}
              height={170}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[14, 14]}>
        {/* Categories */}
        <Col xs={24} sm={24} md={12}>
          <Card className="chart-card" styles={{ body: { padding: "18px" } }}>
            <div className="chart-card-title" style={{ marginBottom: 16 }}>{t('dashboard.categoryProgress')}</div>
            {byCategory.length === 0 ? (
              <Empty description={<span style={{ color: 'var(--text-muted)' }}>{t('dashboard.noCategories')}</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div className="category-list">
                {byCategory.slice(0, 6).map((cat) => {
                  const rate = cat.total
                    ? Math.round(((cat.total - cat.pending) / cat.total) * 100)
                    : 100;
                  return (
                    <div key={cat.id}>
                      <div className="category-item-header">
                        <div className="category-dot" style={{ background: cat.color }} />
                        <Text style={{ color: 'var(--text-primary)', flex: 1, fontSize: 13 }}>{cat.name}</Text>
                        <Text style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {cat.pending > 0 ? `${cat.pending} ${t('dashboard.pendingLabel')}` : t('dashboard.completedAll')}
                        </Text>
                      </div>
                      <Progress
                        percent={rate}
                        showInfo={false}
                        strokeColor={cat.color}
                        railColor="rgba(255,255,255,0.05)"
                        size="small"
                        strokeLinecap="round"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>

        {/* Urgent todos */}
        <Col xs={24} sm={24} md={12}>
          <Card
            className="chart-card urgent-card"
            styles={{ body: { padding: "18px" } }}
          >
            <div className="urgent-card-title" style={{ marginBottom: 16 }}>
              <FireOutlined style={{ marginRight: 6 }} />{t('dashboard.urgentCard')}
            </div>
            {urgentTodos.length === 0 ? (
              <div className="empty-urgent">
                <TrophyOutlined style={{ fontSize: 36, color: '#06d6a0' }} />
                <Text style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  {t('dashboard.noUrgent')}
                </Text>
              </div>
            ) : (
              <div className="urgent-list">
                {urgentTodos.map((todo) => (
                  <div key={todo.id} className="urgent-item urgent-pulse">
                    <div className="urgent-title">
                      <FireOutlined style={{ color: '#ff4d6d', fontSize: 12, flexShrink: 0 }} />
                      <Text style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 13 }}>{todo.title}</Text>
                    </div>
                    <div className="urgent-meta">
                      {todo.category_name && (
                        <Tag style={{ background: `${todo.category_color}20`, borderColor: `${todo.category_color}40`, color: todo.category_color }}>
                          {todo.category_name}
                        </Tag>
                      )}
                      {todo.due_date && (
                        <Text style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          <ClockCircleOutlined style={{ marginRight: 3 }} />
                          {toUserTz(todo.due_date, tz).format('M/D HH:mm')}
                        </Text>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
