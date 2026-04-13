import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { Typography, Select, Space, Tag, Modal, Empty } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import Holidays from 'date-holidays';
import dayjs from 'dayjs';
import i18n from '../../i18n';
import './HolidayCalendarPage.css';

const { Title, Text } = Typography;

const FC_LOCALE_MAP = {
  'zh-CN': 'zh-cn',
  'zh-TW': 'zh-tw',
  'en': 'en',
  'ja': 'ja',
  'nl': 'nl',
};

const COUNTRY_COLORS = [
  '#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
  '#e11d48', '#0ea5e9', '#a855f7', '#22c55e', '#eab308',
];

const STORAGE_KEY = 'opentodo-holiday-countries';

const LANG_MAP = {
  'zh-CN': 'zh',
  'zh-TW': 'zh',
  'ja': 'ja',
  'en': 'en',
  'nl': 'nl',
};

const hd = new Holidays();

function getPopularCountries() {
  return [
    'CN', 'US', 'JP', 'KR', 'GB', 'DE', 'FR', 'CA', 'AU', 'IN',
    'SG', 'HK', 'TW', 'NL', 'ES', 'IT', 'BR', 'MX', 'TH', 'VN',
    'MY', 'ID', 'PH', 'RU', 'SE', 'NO', 'DK', 'FI', 'CH', 'AT',
    'BE', 'PT', 'IE', 'NZ', 'ZA', 'AE', 'SA', 'IL', 'TR', 'PL',
  ];
}

function buildCountryOptions(t) {
  const allCountries = hd.getCountries();
  const popular = getPopularCountries();
  const lang = LANG_MAP[i18n.language] || 'en';

  const getName = (code) => {
    const localized = hd.getCountries(lang);
    return localized?.[code] || allCountries[code] || code;
  };

  const popularOptions = popular
    .filter((c) => allCountries[c])
    .map((code) => ({
      label: `${countryFlag(code)} ${getName(code)}`,
      value: code,
    }));

  const otherCodes = Object.keys(allCountries)
    .filter((c) => !popular.includes(c))
    .sort((a, b) => getName(a).localeCompare(getName(b)));

  const otherOptions = otherCodes.map((code) => ({
    label: `${countryFlag(code)} ${getName(code)}`,
    value: code,
  }));

  return [
    { label: t('holidays.popularCountries'), options: popularOptions },
    { label: t('holidays.otherCountries'), options: otherOptions },
  ];
}

function countryFlag(code) {
  if (code.length !== 2) return '';
  const offset = 0x1F1E6;
  return String.fromCodePoint(
    code.charCodeAt(0) - 65 + offset,
    code.charCodeAt(1) - 65 + offset,
  );
}

function getHolidaysForYear(countryCode, year) {
  const lang = LANG_MAP[i18n.language] || 'en';
  const instance = new Holidays(countryCode, { languages: [lang] });
  const holidays = instance.getHolidays(year);
  return holidays.filter((h) => h.type === 'public');
}

function getCountryName(code) {
  const lang = LANG_MAP[i18n.language] || 'en';
  const localized = hd.getCountries(lang);
  return localized?.[code] || hd.getCountries()[code] || code;
}

export default function HolidayCalendarPage() {
  const { t } = useTranslation();
  const calRef = useRef(null);
  const [detailModal, setDetailModal] = useState(null);

  const [selectedCountries, setSelectedCountries] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return ['CN'];
  });

  const [viewYear, setViewYear] = useState(() => dayjs().year());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedCountries));
  }, [selectedCountries]);

  const countryOptions = useMemo(() => buildCountryOptions(t), [t, i18n.language]);

  const colorMap = useMemo(() => {
    const map = {};
    selectedCountries.forEach((code, i) => {
      map[code] = COUNTRY_COLORS[i % COUNTRY_COLORS.length];
    });
    return map;
  }, [selectedCountries]);

  const calendarEvents = useMemo(() => {
    const events = [];
    const yearsToLoad = [viewYear - 1, viewYear, viewYear + 1];

    selectedCountries.forEach((code) => {
      const color = colorMap[code];
      yearsToLoad.forEach((year) => {
        const holidays = getHolidaysForYear(code, year);
        holidays.forEach((h) => {
          const startDate = dayjs(h.start).format('YYYY-MM-DD');
          let endDate;
          if (h.end) {
            endDate = dayjs(h.end).format('YYYY-MM-DD');
          }
          events.push({
            id: `${code}-${startDate}-${h.name}`,
            title: h.name,
            start: startDate,
            end: endDate,
            allDay: true,
            backgroundColor: color,
            borderColor: color,
            textColor: '#fff',
            extendedProps: {
              country: code,
              countryName: getCountryName(code),
              type: h.type,
              holiday: h,
            },
          });
        });
      });
    });

    return events;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountries, colorMap, viewYear, i18n.language]);

  const handleDatesSet = useCallback(({ start }) => {
    const year = dayjs(start).add(15, 'day').year();
    setViewYear(year);
  }, []);

  const handleEventClick = useCallback(({ event }) => {
    const { country, countryName, holiday } = event.extendedProps;
    setDetailModal({
      name: event.title,
      date: dayjs(event.start).format(t('common.dateFormat')),
      country,
      countryName,
      type: holiday.type,
      note: holiday.note || '',
    });
  }, [t]);

  const fcLocale = FC_LOCALE_MAP[i18n.language] || 'zh-cn';
  const isMobile = window.innerWidth < 768;

  const tagRender = useCallback(({ label, value, closable, onClose }) => {
    const color = colorMap[value];
    return (
      <Tag
        color={color}
        closable={closable}
        onClose={onClose}
        style={{ marginRight: 4, borderRadius: 4 }}
      >
        {label}
      </Tag>
    );
  }, [colorMap]);

  return (
    <div className="holiday-calendar-page fade-in">
      <div className="holiday-header">
        <Title level={3} style={{ margin: 0 }}>
          <span className="gradient-text">{t('holidays.title')}</span>
        </Title>
      </div>

      <div className="holiday-selector-bar">
        <Space align="center" size={8} style={{ flexShrink: 0 }}>
          <GlobalOutlined style={{ fontSize: 16, color: '#6366f1' }} />
          <Text strong style={{ fontSize: 13, color: '#475569', whiteSpace: 'nowrap' }}>
            {t('holidays.selectCountry')}
          </Text>
        </Space>
        <Select
          mode="multiple"
          value={selectedCountries}
          onChange={setSelectedCountries}
          options={countryOptions}
          placeholder={t('holidays.searchPlaceholder')}
          tagRender={tagRender}
          showSearch
          optionFilterProp="label"
          maxTagCount="responsive"
          className="holiday-country-select"
          popupMatchSelectWidth={false}
          style={{ flex: 1, minWidth: 200 }}
        />
      </div>

      {selectedCountries.length > 0 && (
        <div className="holiday-legend">
          {selectedCountries.map((code) => (
            <Space key={code} size={4}>
              <span
                className="legend-dot"
                style={{ background: colorMap[code] }}
              />
              <Text style={{ fontSize: 12, color: '#64748b' }}>
                {countryFlag(code)} {getCountryName(code)}
              </Text>
            </Space>
          ))}
        </div>
      )}

      {selectedCountries.length === 0 ? (
        <div className="holiday-empty">
          <Empty
            description={t('holidays.noCountry')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      ) : (
        <div className="holiday-calendar-container">
          <FullCalendar
            ref={calRef}
            plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
            initialView={isMobile ? 'listMonth' : 'dayGridMonth'}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: isMobile ? 'listMonth' : 'dayGridMonth,listMonth',
            }}
            buttonText={{
              today: t('holidays.today'),
              month: t('holidays.month'),
              list: t('holidays.list'),
            }}
            locale={fcLocale}
            firstDay={1}
            fixedWeekCount={false}
            showNonCurrentDates={false}
            events={calendarEvents}
            eventClick={handleEventClick}
            datesSet={handleDatesSet}
            eventContent={HolidayEventContent}
            dayMaxEvents={4}
            height="auto"
          />
        </div>
      )}

      <Modal
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        footer={null}
        title={
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            {detailModal?.name}
          </span>
        }
        width={400}
        className="holiday-detail-modal"
      >
        {detailModal && (
          <div className="holiday-detail-content">
            <div className="holiday-detail-row">
              <Text type="secondary">{t('holidays.date')}</Text>
              <Text strong>{detailModal.date}</Text>
            </div>
            <div className="holiday-detail-row">
              <Text type="secondary">{t('holidays.country')}</Text>
              <Text strong>
                {countryFlag(detailModal.country)} {detailModal.countryName}
              </Text>
            </div>
            <div className="holiday-detail-row">
              <Text type="secondary">{t('holidays.type')}</Text>
              <Tag color="blue">{t('holidays.public')}</Tag>
            </div>
            {detailModal.note && (
              <div className="holiday-detail-row">
                <Text type="secondary">{t('holidays.note')}</Text>
                <Text>{detailModal.note}</Text>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function HolidayEventContent({ event }) {
  const { country } = event.extendedProps;
  return (
    <div className="holiday-event">
      <span className="holiday-event-flag">{countryFlag(country)}</span>
      <span className="holiday-event-title">{event.title}</span>
    </div>
  );
}
