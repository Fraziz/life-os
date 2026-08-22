'use client';

import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Plus,
  Trash2,
  X,
  Target,
  Sparkles,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { useCalendar } from '@/context/CalendarContext';
import { useTasks } from '@/context/TaskContext';
import styles from './page.module.css';

type CalendarView = 'day' | 'week' | 'month';

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 to 22:00

export default function CalendarPage() {
  const {
    events,
    scheduledBlocks,
    deadlines,
    addEvent,
    deleteEvent,
    scheduleTaskBlock,
    removeScheduledBlock,
    getDeadlinesForDate,
    getScheduledBlocksForDate,
    getEventsForDate,
    resetToDefaultCalendar,
    isLoaded,
  } = useCalendar();

  const { tasks } = useTasks();

  const [view, setView] = useState<CalendarView>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Modals
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [eventModalOpen, setEventModalOpen] = useState(false);

  // Form states for scheduling a task block
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split('T')[0]);
  const [schedTime, setSchedTime] = useState('19:00');
  const [schedDuration, setSchedDuration] = useState('60');
  const [schedNotes, setSchedNotes] = useState('');

  // Form states for creating a calendar event
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventStartTime, setEventStartTime] = useState('14:00');
  const [eventEndTime, setEventEndTime] = useState('15:00');
  const [eventNotes, setEventNotes] = useState('');

  if (!isLoaded) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Loading your Calendar...
        </p>
      </div>
    );
  }

  const currentDateStr = currentDate.toISOString().split('T')[0];

  // ── Navigation helpers ──
  const navigatePrev = () => {
    const next = new Date(currentDate);
    if (view === 'day') next.setDate(next.getDate() - 1);
    else if (view === 'week') next.setDate(next.getDate() - 7);
    else if (view === 'month') next.setMonth(next.getMonth() - 1);
    setCurrentDate(next);
  };

  const navigateNext = () => {
    const next = new Date(currentDate);
    if (view === 'day') next.setDate(next.getDate() + 1);
    else if (view === 'week') next.setDate(next.getDate() + 7);
    else if (view === 'month') next.setMonth(next.getMonth() + 1);
    setCurrentDate(next);
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  // Week View dates calculation (Monday to Sunday)
  const getWeekDates = (centerDate: Date) => {
    const start = new Date(centerDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    start.setDate(diff);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  // Month View dates calculation
  const getMonthDays = (centerDate: Date) => {
    const year = centerDate.getFullYear();
    const month = centerDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Preceding padding days
    const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    for (let i = firstDayOfWeek; i > 0; i--) {
      const d = new Date(year, month, 1 - i);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    // Trailing padding days to fill 35 or 42 grid slots
    while (days.length % 7 !== 0) {
      const d = new Date(year, month + 1, days.length - lastDay.getDate() - firstDayOfWeek + 1);
      days.push({ date: d, isCurrentMonth: false });
    }

    return days;
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) return;
    scheduleTaskBlock(selectedTaskId, schedDate, schedTime, parseInt(schedDuration) || 60, schedNotes);
    setScheduleModalOpen(false);
    setSchedNotes('');
  };

  const handleEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    addEvent({
      title: eventTitle.trim(),
      date: eventDate,
      startTime: eventStartTime,
      endTime: eventEndTime,
      notes: eventNotes,
    });
    setEventModalOpen(false);
    setEventTitle('');
    setEventNotes('');
  };

  const activeDeadlinesForCurrentDate = getDeadlinesForDate(currentDateStr);

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Calendar & Planning</h1>
          <p className={styles.subtitle}>
            Deadlines (obligations) kept strictly separate from Scheduled Work (focus blocks) and Events (appointments).
          </p>
        </div>

        <div className={styles.actionButtons}>
          <button className={styles.btnSecondary} onClick={() => setEventModalOpen(true)}>
            <Plus size={13} /> Add Event
          </button>
          <button className={styles.btnSchedule} onClick={() => setScheduleModalOpen(true)}>
            <Clock size={13} /> Schedule Work Block
          </button>
        </div>
      </header>

      {/* ── View Controls Bar ── */}
      <div className={styles.controlsBar}>
        <div className={styles.dateNavGroup}>
          <button className={styles.btnSecondary} onClick={navigatePrev} title="Previous">
            <ChevronLeft size={16} />
          </button>
          <button className={styles.btnSecondary} onClick={navigateToday}>
            Today
          </button>
          <button className={styles.btnSecondary} onClick={navigateNext} title="Next">
            <ChevronRight size={16} />
          </button>

          <span className={styles.currentDateLabel}>
            {view === 'month'
              ? currentDate.toLocaleDateString([], { month: 'long', year: 'numeric' })
              : currentDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        <div className={styles.viewTabs}>
          <button
            className={`${styles.viewTab} ${view === 'day' ? styles.activeViewTab : ''}`}
            onClick={() => setView('day')}
          >
            Day
          </button>
          <button
            className={`${styles.viewTab} ${view === 'week' ? styles.activeViewTab : ''}`}
            onClick={() => setView('week')}
          >
            Week
          </button>
          <button
            className={`${styles.viewTab} ${view === 'month' ? styles.activeViewTab : ''}`}
            onClick={() => setView('month')}
          >
            Month
          </button>
        </div>
      </div>

      {/* ── Distinct Top Deadlines Banner (Must be completed by...) ── */}
      <section className={styles.deadlinesBanner}>
        <div className={styles.deadlinesHeader}>
          <span className={styles.deadlinesTitle}>
            <Flag size={13} /> Deadlines Due on {currentDateStr} ({activeDeadlinesForCurrentDate.length})
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>
            Target obligations — not scheduled focus time
          </span>
        </div>

        <div className={styles.deadlinesChipList}>
          {activeDeadlinesForCurrentDate.length === 0 ? (
            <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>
              No hard deadlines due on this date.
            </span>
          ) : (
            activeDeadlinesForCurrentDate.map((dl) => (
              <span key={dl.id} className={styles.deadlineChip}>
                <Flag size={11} style={{ color: '#ef4444' }} />
                <span>{dl.title}</span>
                <span style={{ fontSize: '9px', opacity: 0.7 }}>({dl.sourceType})</span>
              </span>
            ))
          )}
        </div>
      </section>

      {/* ── DAY VIEW ── */}
      {view === 'day' && (
        <div className={styles.dayViewContainer}>
          <div className={styles.timelineGrid}>
            {HOURS.map((hour) => {
              const hourStr = `${String(hour).padStart(2, '0')}:00`;
              const hourEndStr = `${String(hour + 1).padStart(2, '0')}:00`;

              const blocksInHour = getScheduledBlocksForDate(currentDateStr).filter((b) => {
                const bHour = parseInt(b.startTime.split(':')[0]);
                return bHour === hour;
              });

              const eventsInHour = getEventsForDate(currentDateStr).filter((e) => {
                if (!e.startTime) return false;
                const eHour = parseInt(e.startTime.split(':')[0]);
                return eHour === hour;
              });

              return (
                <div key={hour} className={styles.timelineHourRow}>
                  <div className={styles.hourLabel}>{hourStr}</div>
                  <div className={styles.hourSlot}>
                    {/* Events */}
                    {eventsInHour.map((evt) => (
                      <div key={evt.id} className={styles.eventCard}>
                        <div>
                          <strong>{evt.title}</strong> • {evt.startTime} - {evt.endTime}
                          {evt.notes && <span style={{ opacity: 0.8, marginLeft: '6px' }}>({evt.notes})</span>}
                        </div>
                        <button
                          style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer' }}
                          onClick={() => deleteEvent(evt.id)}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}

                    {/* Scheduled Work Blocks */}
                    {blocksInHour.map((block) => (
                      <div key={block.id} className={styles.scheduledWorkCard}>
                        <div>
                          <Clock size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                          <strong>Focus Block: {block.taskTitle}</strong> • {block.startTime} ({block.durationMinutes}m)
                          {block.notes && <span style={{ opacity: 0.8, marginLeft: '6px' }}>&ldquo;{block.notes}&rdquo;</span>}
                        </div>
                        <button
                          style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer' }}
                          onClick={() => removeScheduledBlock(block.id)}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── WEEK VIEW ── */}
      {view === 'week' && (
        <div className={styles.weekGrid}>
          {getWeekDates(currentDate).map((dayDate, idx) => {
            const dayStr = dayDate.toISOString().split('T')[0];
            const isToday = dayStr === new Date().toISOString().split('T')[0];
            const dayDeadlines = getDeadlinesForDate(dayStr);
            const dayBlocks = getScheduledBlocksForDate(dayStr);
            const dayEvents = getEventsForDate(dayStr);

            return (
              <div key={idx} className={styles.weekCol}>
                <div className={styles.weekColHeader} style={{ background: isToday ? 'rgba(124, 106, 255, 0.15)' : undefined }}>
                  <div className={styles.weekDayName}>
                    {dayDate.toLocaleDateString([], { weekday: 'short' })}
                  </div>
                  <div className={styles.weekDayNum}>{dayDate.getDate()}</div>
                </div>

                <div className={styles.weekColBody}>
                  {/* Daily Deadlines Row */}
                  {dayDeadlines.map((dl) => (
                    <div key={dl.id} className={`${styles.monthItemBadge} ${styles.monthDeadlineBadge}`}>
                      <Flag size={9} style={{ display: 'inline', marginRight: '2px' }} />
                      {dl.title}
                    </div>
                  ))}

                  {/* Daily Events */}
                  {dayEvents.map((evt) => (
                    <div key={evt.id} className={styles.eventCard}>
                      <div>
                        <strong>{evt.title}</strong>
                        <div style={{ fontSize: '9px', opacity: 0.8 }}>{evt.startTime}</div>
                      </div>
                      <button
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer', padding: 0 }}
                        onClick={() => deleteEvent(evt.id)}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}

                  {/* Daily Scheduled Work */}
                  {dayBlocks.map((block) => (
                    <div key={block.id} className={styles.scheduledWorkCard}>
                      <div>
                        <Clock size={10} style={{ display: 'inline', marginRight: '2px' }} />
                        <strong>{block.taskTitle}</strong>
                        <div style={{ fontSize: '9px', opacity: 0.8 }}>{block.startTime} ({block.durationMinutes}m)</div>
                      </div>
                      <button
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer', padding: 0 }}
                        onClick={() => removeScheduledBlock(block.id)}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MONTH VIEW ── */}
      {view === 'month' && (
        <div>
          <div className={styles.monthGrid} style={{ borderBottom: 'none' }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName) => (
              <div key={dayName} className={styles.monthHeaderCell}>
                {dayName}
              </div>
            ))}
          </div>

          <div className={styles.monthGrid}>
            {getMonthDays(currentDate).map(({ date, isCurrentMonth }, idx) => {
              const dayStr = date.toISOString().split('T')[0];
              const isToday = dayStr === new Date().toISOString().split('T')[0];
              const dayDeadlines = getDeadlinesForDate(dayStr);
              const dayBlocks = getScheduledBlocksForDate(dayStr);
              const dayEvents = getEventsForDate(dayStr);

              return (
                <div
                  key={idx}
                  className={`${styles.monthDayCell} ${isToday ? styles.todayCell : ''}`}
                  style={{ opacity: isCurrentMonth ? 1 : 0.4 }}
                  onClick={() => {
                    setCurrentDate(date);
                    setView('day');
                  }}
                >
                  <span className={styles.monthDayNum}>{date.getDate()}</span>

                  {dayDeadlines.map((dl) => (
                    <div key={dl.id} className={`${styles.monthItemBadge} ${styles.monthDeadlineBadge}`} title={`Deadline: ${dl.title}`}>
                      🚩 {dl.title}
                    </div>
                  ))}

                  {dayEvents.map((evt) => (
                    <div key={evt.id} className={`${styles.monthItemBadge} ${styles.monthEventBadge}`} title={`Event: ${evt.title}`}>
                      📅 {evt.title}
                    </div>
                  ))}

                  {dayBlocks.map((b) => (
                    <div key={b.id} className={`${styles.monthItemBadge} ${styles.monthScheduleBadge}`} title={`Focus block: ${b.taskTitle}`}>
                      ⏳ {b.taskTitle}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Modal: Schedule Task Block ("I plan to work on Friday at 7 PM") ── */}
      {scheduleModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setScheduleModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                Schedule Task Focus Block
              </h3>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer' }} onClick={() => setScheduleModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
              Dedicate a specific time slot to sit down and do focused work.
            </p>

            <form onSubmit={handleScheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                  Select Task
                </label>
                <select
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px',
                    color: 'var(--color-text)',
                    fontSize: 'var(--text-xs)',
                    outline: 'none',
                  }}
                  required
                >
                  <option value="">-- Choose a task --</option>
                  {tasks
                    .filter((t) => t.status !== 'done')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} {t.estimatedDuration ? `(${t.estimatedDuration}m)` : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px',
                      color: 'var(--color-text)',
                      fontSize: 'var(--text-xs)',
                      outline: 'none',
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px',
                      color: 'var(--color-text)',
                      fontSize: 'var(--text-xs)',
                      outline: 'none',
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  min="15"
                  max="300"
                  step="15"
                  value={schedDuration}
                  onChange={(e) => setSchedDuration(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px',
                    color: 'var(--color-text)',
                    fontSize: 'var(--text-xs)',
                    outline: 'none',
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: 'var(--space-2)' }}>
                <button type="button" className={styles.btnSecondary} onClick={() => setScheduleModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnSchedule}>
                  Add to Calendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Add Event ("Dentist, Doctor, Team Sync") ── */}
      {eventModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setEventModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                Add Calendar Event
              </h3>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer' }} onClick={() => setEventModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEventSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                  Event Title
                </label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="e.g. Dentist Appointment, Doctor, Call"
                  style={{
                    width: '100%',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px',
                    color: 'var(--color-text)',
                    fontSize: 'var(--text-xs)',
                    outline: 'none',
                  }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px',
                      color: 'var(--color-text)',
                      fontSize: 'var(--text-xs)',
                      outline: 'none',
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={eventStartTime}
                    onChange={(e) => setEventStartTime(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px',
                      color: 'var(--color-text)',
                      fontSize: 'var(--text-xs)',
                      outline: 'none',
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>
                    End Time
                  </label>
                  <input
                    type="time"
                    value={eventEndTime}
                    onChange={(e) => setEventEndTime(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px',
                      color: 'var(--color-text)',
                      fontSize: 'var(--text-xs)',
                      outline: 'none',
                    }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: 'var(--space-2)' }}>
                <button type="button" className={styles.btnSecondary} onClick={() => setEventModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnSchedule}>
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
