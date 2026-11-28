'use client';

import React, { useMemo } from 'react';
import type { DirectoryUserRecord, OverviewApiResponse } from './types';
import styles from '@/app/admin/page.module.css';

interface AdminTelemetryChartsProps {
  users: DirectoryUserRecord[];
  overview: OverviewApiResponse;
}

export default function AdminTelemetryCharts({ users, overview }: AdminTelemetryChartsProps) {
  const cohorts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: Array<{
      key: string;
      shortLabel: string;
      activeCount: number;
      signupCount: number;
    }> = [];

    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(today.getTime() - i * 86_400_000);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${day}`;
      const shortLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      days.push({ key, shortLabel, activeCount: 0, signupCount: 0 });
    }

    const indexByKey = new Map(days.map((d, idx) => [d.key, idx]));

    for (const u of users) {
      if (u.lastActiveAt) {
        const ms = Date.parse(u.lastActiveAt);
        if (!Number.isNaN(ms)) {
          const dt = new Date(ms);
          const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
            dt.getDate()
          ).padStart(2, '0')}`;
          const idx = indexByKey.get(k);
          if (idx !== undefined) days[idx].activeCount += 1;
        }
      }
      if (u.createdAt) {
        const ms = Date.parse(u.createdAt);
        if (!Number.isNaN(ms)) {
          const dt = new Date(ms);
          const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
            dt.getDate()
          ).padStart(2, '0')}`;
          const idx = indexByKey.get(k);
          if (idx !== undefined) days[idx].signupCount += 1;
        }
      }
    }

    const maxVal = Math.max(1, ...days.map((d) => Math.max(d.activeCount, d.signupCount)));
    return { days, maxVal };
  }, [users]);

  const breakdown = useMemo(() => {
    const total = Math.max(1, users.length);
    const google = users.filter((u) => u.provider === 'google.com').length;
    const verified = users.filter((u) => u.emailVerified).length;
    const suspended = users.filter((u) => u.accountStatus === 'suspended').length;
    const active7d = users.filter((u) => {
      const ms = u.lastActiveAt ? Date.parse(u.lastActiveAt) : NaN;
      return !Number.isNaN(ms) && Date.now() - ms <= 7 * 86_400_000;
    }).length;

    const heapPct =
      overview.runtime.memory.heapTotalMb > 0
        ? Math.min(100, Math.round((overview.runtime.memory.heapUsedMb / overview.runtime.memory.heapTotalMb) * 100))
        : 0;
    const ratePct =
      overview.caches.rateLimit.maxEntries > 0
        ? Math.min(100, Math.round((overview.caches.rateLimit.activeBuckets / overview.caches.rateLimit.maxEntries) * 100))
        : 0;
    const linkPct =
      overview.caches.linkPreview.maxEntries > 0
        ? Math.min(100, Math.round((overview.caches.linkPreview.entries / overview.caches.linkPreview.maxEntries) * 100))
        : 0;

    return {
      totalUsers: users.length,
      googlePct: users.length > 0 ? Math.round((google / total) * 100) : 0,
      google,
      verifiedPct: users.length > 0 ? Math.round((verified / total) * 100) : 0,
      verified,
      active7dPct: users.length > 0 ? Math.round((active7d / total) * 100) : 0,
      active7d,
      suspended,
      heapPct,
      ratePct,
      linkPct,
    };
  }, [users, overview]);

  return (
    <div className={styles.panelGrid}>
      {/* 14-Day Activity & Onboarding Cohort Chart */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>14-Day Activity &amp; Onboarding Trend</h2>
            <p className={styles.cardDesc}>
              Daily active accounts and new sign-ups derived from synced user directory timestamps.
            </p>
          </div>
          <div className={styles.chartLegend}>
            <span className={styles.legendItem}>
              <span className={styles.legendSwatchPrimary} aria-hidden="true" />
              <span>Active</span>
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendSwatchMuted} aria-hidden="true" />
              <span>Joined</span>
            </span>
          </div>
        </div>

        <div className={styles.chartWrap} role="img" aria-label="14-day user activity and signups bar chart">
          <div className={styles.barChartGrid}>
            {cohorts.days.map((d) => {
              const activeH = Math.round((d.activeCount / cohorts.maxVal) * 100);
              const signupH = Math.round((d.signupCount / cohorts.maxVal) * 100);
              return (
                <div
                  key={d.key}
                  className={styles.barColumn}
                  title={`${d.shortLabel}: ${d.activeCount} active, ${d.signupCount} joined`}
                >
                  <div className={styles.barPair}>
                    <div
                      className={styles.barPrimary}
                      style={{ height: `${Math.max(d.activeCount > 0 ? 8 : 2, activeH)}%` }}
                    />
                    <div
                      className={styles.barMuted}
                      style={{ height: `${Math.max(d.signupCount > 0 ? 8 : 2, signupH)}%` }}
                    />
                  </div>
                  <span className={styles.barDayLabel}>{d.key.slice(8)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Account Cohorts & Server Resource Utilization */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Identity &amp; Runtime Capacity</h2>
            <p className={styles.cardDesc}>
              Account verification standing alongside Node memory and API guard capacity.
            </p>
          </div>
        </div>

        <div className={styles.meterList}>
          <div className={styles.meterRow}>
            <div className={styles.meterTop}>
              <span>Weekly Active Users (7d Retention)</span>
              <span className={styles.mono}>
                {breakdown.active7d} / {breakdown.totalUsers} ({breakdown.active7dPct}%)
              </span>
            </div>
            <div className={styles.meterTrack}>
              <div className={styles.meterFill} style={{ width: `${breakdown.active7dPct}%` }} />
            </div>
          </div>

          <div className={styles.meterRow}>
            <div className={styles.meterTop}>
              <span>Verified Email &amp; SSO Standing</span>
              <span className={styles.mono}>
                {breakdown.verified} / {breakdown.totalUsers} ({breakdown.verifiedPct}%)
              </span>
            </div>
            <div className={styles.meterTrack}>
              <div className={styles.meterFill} style={{ width: `${breakdown.verifiedPct}%` }} />
            </div>
          </div>

          <div className={styles.meterRow}>
            <div className={styles.meterTop}>
              <span>Google SSO Share</span>
              <span className={styles.mono}>
                {breakdown.google} SSO · {breakdown.googlePct}%
              </span>
            </div>
            <div className={styles.meterTrack}>
              <div className={styles.meterFill} style={{ width: `${breakdown.googlePct}%` }} />
            </div>
          </div>

          <div className={styles.meterRow}>
            <div className={styles.meterTop}>
              <span>Node JS Heap Utilization</span>
              <span className={styles.mono}>
                {overview.runtime.memory.heapUsedMb}MB / {overview.runtime.memory.heapTotalMb}MB ({breakdown.heapPct}%)
              </span>
            </div>
            <div className={styles.meterTrack}>
              <div className={styles.meterFill} style={{ width: `${breakdown.heapPct}%` }} />
            </div>
          </div>

          <div className={styles.meterRow}>
            <div className={styles.meterTop}>
              <span>Cache Saturation (Rate Buckets · Link Previews)</span>
              <span className={styles.mono}>
                {breakdown.ratePct}% · {breakdown.linkPct}%
              </span>
            </div>
            <div className={styles.meterTrack}>
              <div
                className={styles.meterFill}
                style={{ width: `${Math.max(breakdown.ratePct, breakdown.linkPct)}%` }}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
