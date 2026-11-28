'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import { DEFAULT_SYSTEM_CONFIG, readSystemConfig, type SystemConfig } from '@/lib/systemConfig';
import PageSkeleton from '@/components/ui/PageSkeleton';
import AdminConsole from '@/components/admin/AdminConsole';
import type {
  AuditEntry,
  DirectoryUserRecord,
  IncidentRecord,
  OverviewApiResponse,
} from '@/components/admin/types';
import statusStyles from '../status.module.css';

export default function AdminConsolePage() {
  const { user, isGuest, ready } = useAuth();
  const [authStatus, setAuthStatus] = useState<'checking' | 'authorized' | 'denied'>('checking');

  const [initialOverview, setInitialOverview] = useState<OverviewApiResponse | null>(null);
  const [initialConfig, setInitialConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [initialUsers, setInitialUsers] = useState<DirectoryUserRecord[]>([]);
  const [initialAudit, setInitialAudit] = useState<AuditEntry[]>([]);
  const [initialIncidents, setInitialIncidents] = useState<IncidentRecord[]>([]);

  const bootstrapConsole = useCallback(async () => {
    if (!user || isGuest) {
      setAuthStatus('denied');
      return;
    }

    try {
      const fbUser = getFirebaseAuth().currentUser;
      const token = fbUser ? await fbUser.getIdToken() : null;
      if (!token) {
        setAuthStatus('denied');
        return;
      }

      const resp = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      if (!resp.ok) {
        setAuthStatus('denied');
        return;
      }

      const ovData = (await resp.json()) as OverviewApiResponse;
      if (!ovData?.authorized) {
        setAuthStatus('denied');
        return;
      }

      const db = getFirebaseDb();
      const [cfgRes, usersRes, auditRes, incRes] = await Promise.allSettled([
        readSystemConfig(),
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'adminAudit'), orderBy('ts', 'desc'), limit(100))),
        getDocs(query(collection(db, 'adminIncidents'), orderBy('ts', 'desc'), limit(40))),
      ]);

      setInitialOverview(ovData);
      if (cfgRes.status === 'fulfilled') setInitialConfig(cfgRes.value);

      if (usersRes.status === 'fulfilled') {
        setInitialUsers(
          usersRes.value.docs.map((snap) => {
            const d = snap.data() as Partial<DirectoryUserRecord>;
            return {
              uid: snap.id,
              email: d.email || '—',
              displayName: d.displayName || '',
              provider: d.provider || 'password',
              emailVerified: Boolean(d.emailVerified),
              createdAt: d.createdAt,
              lastActiveAt: d.lastActiveAt,
              accountStatus: d.accountStatus === 'suspended' ? 'suspended' : 'active',
              suspensionReason: d.suspensionReason,
              suspendedAt: d.suspendedAt,
              adminRole:
                d.adminRole === 'owner' || d.adminRole === 'support' ? d.adminRole : 'member',
            };
          })
        );
      }

      if (auditRes.status === 'fulfilled') {
        setInitialAudit(
          auditRes.value.docs.map((snap) => {
            const d = snap.data() as Partial<AuditEntry>;
            return {
              id: snap.id,
              category:
                d.category === 'users' ||
                d.category === 'config' ||
                d.category === 'security' ||
                d.category === 'operations' ||
                d.category === 'incidents'
                  ? d.category
                  : 'operations',
              action: d.action || 'Admin Action',
              detail: d.detail || '',
              actorEmail: d.actorEmail || ovData.admin.email,
              createdAt: d.createdAt || '',
            };
          })
        );
      }

      if (incRes.status === 'fulfilled') {
        setInitialIncidents(
          incRes.value.docs.map((snap) => {
            const d = snap.data() as Partial<IncidentRecord>;
            return {
              id: snap.id,
              title: d.title || 'Untitled Notice',
              severity:
                d.severity === 'major' || d.severity === 'maintenance' ? d.severity : 'minor',
              status:
                d.status === 'identified' ||
                d.status === 'monitoring' ||
                d.status === 'resolved'
                  ? d.status
                  : 'investigating',
              summary: d.summary || '',
              createdAt: d.createdAt || '',
              updatedAt: d.updatedAt || d.createdAt || '',
              createdBy: d.createdBy || ovData.admin.email,
            };
          })
        );
      }

      setAuthStatus('authorized');
    } catch {
      setAuthStatus('denied');
    }
  }, [user, isGuest]);

  useEffect(() => {
    if (!ready) return;
    void bootstrapConsole();
  }, [ready, bootstrapConsole]);

  if (!ready || authStatus === 'checking') {
    return <PageSkeleton variant="default" cardsCount={4} showMetrics={true} showControls={false} />;
  }

  // Stealth guard: unauthorized accounts receive the standard 404 Not Found screen
  if (authStatus === 'denied' || !initialOverview) {
    return (
      <main className={statusStyles.wrap}>
        <section className={statusStyles.card}>
          <div className={statusStyles.kicker}>
            <span className={statusStyles.dot} aria-hidden="true" />
            <span>404 — Not Found</span>
          </div>
          <h1 className={statusStyles.title}>This page does not exist</h1>
          <p className={statusStyles.desc}>
            The link you followed may have moved or is no longer available in your workspace.
          </p>
          <div className={statusStyles.actions}>
            <Link href="/" className={statusStyles.primaryBtn}>
              Return to Workspace
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <AdminConsole
      initialOverview={initialOverview}
      initialConfig={initialConfig}
      initialUsers={initialUsers}
      initialAudit={initialAudit}
      initialIncidents={initialIncidents}
    />
  );
}
