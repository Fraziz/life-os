'use client';

import React, { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  Check,
  Copy,
  Laptop,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  X,
} from 'lucide-react';
import { getFirebaseDb } from '@/lib/firebase';
import {
  formatDateTime,
  formatProvider,
  formatRelativeTime,
  type AdminUserNote,
  type AuditCategory,
  type DeviceSessionRecord,
  type DirectoryUserRecord,
} from './types';
import styles from '@/app/admin/page.module.css';

interface AdminUserDrawerProps {
  userRecord: DirectoryUserRecord | null;
  adminUid: string;
  adminEmail: string;
  onClose: () => void;
  onAudit: (category: AuditCategory, action: string, detail: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onNotify: (message: string) => void;
}

export default function AdminUserDrawer({
  userRecord,
  adminUid,
  adminEmail,
  onClose,
  onAudit,
  onRefresh,
  onNotify,
}: AdminUserDrawerProps) {
  const [sessions, setSessions] = useState<DeviceSessionRecord[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [roleValue, setRoleValue] = useState<'member' | 'support'>('member');
  const [suspensionReason, setSuspensionReason] = useState('');
  const [noteText, setNoteText] = useState('');
  const [riskFlag, setRiskFlag] = useState<'normal' | 'watch' | 'vip'>('normal');

  const [actionBusy, setActionBusy] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);
  const [confirmDeleteStep, setConfirmDeleteStep] = useState(false);

  useEffect(() => {
    if (!userRecord) return;
    setRoleValue(userRecord.adminRole === 'support' ? 'support' : 'member');
    setSuspensionReason(userRecord.suspensionReason || '');
    setConfirmDeleteStep(false);

    let active = true;
    const db = getFirebaseDb();

    setSessionsLoading(true);
    Promise.allSettled([
      getDocs(collection(db, 'users', userRecord.uid, 'sessions')),
      getDoc(doc(db, 'adminUserNotes', userRecord.uid)),
    ]).then(([sessRes, noteRes]) => {
      if (!active) return;

      if (sessRes.status === 'fulfilled') {
        const rows: DeviceSessionRecord[] = sessRes.value.docs.map((snap) => {
          const d = snap.data() as Partial<DeviceSessionRecord>;
          return {
            deviceId: snap.id,
            browser: d.browser || 'Browser',
            os: d.os || 'Unknown OS',
            deviceType: d.deviceType === 'mobile' || d.deviceType === 'tablet' ? d.deviceType : 'desktop',
            model: d.model,
            signedInAt: Number(d.signedInAt) || 0,
            lastActive: Number(d.lastActive) || 0,
            revoked: Boolean(d.revoked),
          };
        });
        rows.sort((a, b) => b.lastActive - a.lastActive);
        setSessions(rows);
      } else {
        setSessions([]);
      }

      if (noteRes.status === 'fulfilled' && noteRes.value.exists()) {
        const n = noteRes.value.data() as Partial<AdminUserNote>;
        setNoteText(n.note || '');
        setRiskFlag(n.riskFlag === 'watch' || n.riskFlag === 'vip' ? n.riskFlag : 'normal');
      } else {
        setNoteText('');
        setRiskFlag('normal');
      }

      setSessionsLoading(false);
    });

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      active = false;
      window.removeEventListener('keydown', handleKey);
    };
  }, [userRecord, onClose]);

  if (!userRecord) return null;

  const isSelf = userRecord.uid === adminUid;
  const isSuspended = userRecord.accountStatus === 'suspended';

  const handleCopyUid = async () => {
    try {
      await navigator.clipboard.writeText(userRecord.uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 1800);
    } catch {
      onNotify(`UID: ${userRecord.uid}`);
    }
  };

  const handleSaveRoleAndNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionBusy(true);
    try {
      const db = getFirebaseDb();
      if (!isSelf) {
        await updateDoc(doc(db, 'users', userRecord.uid), {
          adminRole: roleValue,
        });
      }
      await setDoc(
        doc(db, 'adminUserNotes', userRecord.uid),
        {
          note: noteText.trim().slice(0, 1000),
          riskFlag,
          updatedAt: new Date().toISOString(),
          updatedBy: adminEmail,
        },
        { merge: true }
      );
      await onAudit(
        'users',
        'Updated Account Metadata',
        `${userRecord.email} · role=${isSelf ? 'owner' : roleValue} · flag=${riskFlag}`
      );
      onNotify(`Saved operator notes and metadata for ${userRecord.email}.`);
      await onRefresh();
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Unable to save user metadata.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleToggleSuspension = async () => {
    if (isSelf) {
      onNotify('Owner account cannot be suspended.');
      return;
    }
    setActionBusy(true);
    try {
      const db = getFirebaseDb();
      if (isSuspended) {
        await updateDoc(doc(db, 'users', userRecord.uid), {
          accountStatus: 'active',
          suspensionReason: '',
          suspendedAt: '',
        });
        await onAudit('security', 'Account Restored', `Re-activated ${userRecord.email}`);
        onNotify(`Restored access for ${userRecord.email}.`);
      } else {
        const cleanReason =
          suspensionReason.trim().slice(0, 240) ||
          'Access temporarily suspended by platform administrator.';
        await updateDoc(doc(db, 'users', userRecord.uid), {
          accountStatus: 'suspended',
          suspensionReason: cleanReason,
          suspendedAt: new Date().toISOString(),
        });
        await setDoc(
          doc(db, 'users', userRecord.uid, 'meta', 'session'),
          { lastRevocation: Date.now() },
          { merge: true }
        );
        await onAudit('security', 'Account Suspended', `${userRecord.email} · Reason: ${cleanReason}`);
        onNotify(`Suspended ${userRecord.email} and revoked active sessions.`);
      }
      await onRefresh();
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Unable to update account status.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRevokeAllDevices = async () => {
    setActionBusy(true);
    try {
      const db = getFirebaseDb();
      await setDoc(
        doc(db, 'users', userRecord.uid, 'meta', 'session'),
        { lastRevocation: Date.now() },
        { merge: true }
      );
      await Promise.all(
        sessions.map((s) =>
          updateDoc(doc(db, 'users', userRecord.uid, 'sessions', s.deviceId), {
            revoked: true,
            revokedAt: Date.now(),
          }).catch(() => undefined)
        )
      );
      setSessions((prev) => prev.map((s) => ({ ...s, revoked: true })));
      await onAudit('security', 'Forced Global Sign-Out', `Revoked all sessions for ${userRecord.email}`);
      onNotify(`Signed out all devices for ${userRecord.email}.`);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Unable to revoke sessions.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRevokeSingleDevice = async (deviceId: string) => {
    setActionBusy(true);
    try {
      const db = getFirebaseDb();
      await updateDoc(doc(db, 'users', userRecord.uid, 'sessions', deviceId), {
        revoked: true,
        revokedAt: Date.now(),
      });
      setSessions((prev) => prev.map((s) => (s.deviceId === deviceId ? { ...s, revoked: true } : s)));
      await onAudit('security', 'Device Session Revoked', `${userRecord.email} (${deviceId.slice(0, 8)}…)`);
      onNotify('Device session marked revoked.');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Unable to revoke device session.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRemoveDirectory = async () => {
    if (isSelf) return;
    setActionBusy(true);
    try {
      await deleteDoc(doc(getFirebaseDb(), 'users', userRecord.uid));
      await onAudit(
        'users',
        'Removed Directory Record',
        `${userRecord.email} (${userRecord.uid.slice(0, 10)}…)`
      );
      onNotify(`Removed directory summary for ${userRecord.email}.`);
      onClose();
      await onRefresh();
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Permission denied while removing directory entry.');
    } finally {
      setActionBusy(false);
    }
  };

  const renderDeviceIcon = (type: DeviceSessionRecord['deviceType']) => {
    if (type === 'mobile') return <Smartphone size={15} />;
    if (type === 'tablet') return <Tablet size={15} />;
    return <Laptop size={15} />;
  };

  return (
    <div className={styles.drawerBackdrop} onClick={onClose} role="presentation">
      <aside
        className={styles.drawerPanel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-drawer-title"
      >
        <div className={styles.drawerHeader}>
          <div>
            <div className={styles.kicker}>Account Inspector</div>
            <h2 id="admin-drawer-title" className={styles.drawerTitle}>
              {userRecord.displayName || userRecord.email.split('@')[0] || 'Account'}
            </h2>
            <p className={styles.userSecondary}>{userRecord.email}</p>
          </div>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onClose}
            aria-label="Close inspector"
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.drawerBody}>
          {/* Identity Summary */}
          <section className={styles.drawerSection}>
            <div className={styles.drawerBadgeRow}>
              <span className={styles.statusPill}>
                <span
                  className={`${styles.statusDot} ${
                    isSuspended ? styles.statusDotDanger : styles.statusDotOk
                  }`}
                  aria-hidden="true"
                />
                <span>{isSuspended ? 'Suspended' : 'Active'}</span>
              </span>
              <span className={styles.statusPill}>
                {isSelf ? 'Owner' : userRecord.adminRole === 'support' ? 'Support Label' : 'Member'}
              </span>
              <span className={styles.statusPill}>
                {formatProvider(userRecord.provider)} ·{' '}
                {userRecord.emailVerified ? 'Verified' : 'Unverified'}
              </span>
            </div>

            <div className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Firebase UID</span>
                <div className={styles.uidCopyRow}>
                  <code className={styles.mono}>{userRecord.uid}</code>
                  <button
                    type="button"
                    className={styles.miniBtn}
                    onClick={() => void handleCopyUid()}
                    aria-label="Copy UID"
                  >
                    {copiedUid ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Joined</span>
                <span>{formatDateTime(userRecord.createdAt)}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Last Seen</span>
                <span>
                  {formatRelativeTime(userRecord.lastActiveAt)} ({formatDateTime(userRecord.lastActiveAt)})
                </span>
              </div>
            </div>
          </section>

          {/* Device Sessions */}
          <section className={styles.drawerSection}>
            <div className={styles.drawerSectionHead}>
              <h3 className={styles.drawerSectionTitle}>Device Sessions ({sessions.length})</h3>
              <button
                type="button"
                className={styles.miniBtn}
                disabled={actionBusy}
                onClick={() => void handleRevokeAllDevices()}
              >
                <LogOut size={13} />
                <span>Force Sign-Out All</span>
              </button>
            </div>

            {sessionsLoading ? (
              <p className={styles.userSecondary}>Loading registered device heartbeats…</p>
            ) : sessions.length === 0 ? (
              <p className={styles.userSecondary}>No active device session records reported yet.</p>
            ) : (
              <div className={styles.sessionList}>
                {sessions.map((sess) => (
                  <div key={sess.deviceId} className={styles.sessionRow}>
                    <div className={styles.sessionMeta}>
                      <div className={styles.sessionPrimary}>
                        {renderDeviceIcon(sess.deviceType)}
                        <span>
                          {sess.browser} on {sess.os}
                          {sess.model ? ` (${sess.model})` : ''}
                        </span>
                      </div>
                      <div className={styles.userSecondary}>
                        Active {formatRelativeTime(sess.lastActive)} · ID {sess.deviceId.slice(0, 8)}…
                      </div>
                    </div>
                    {sess.revoked ? (
                      <span className={styles.statusPill}>Revoked</span>
                    ) : (
                      <button
                        type="button"
                        className={styles.miniBtn}
                        disabled={actionBusy}
                        onClick={() => void handleRevokeSingleDevice(sess.deviceId)}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Role & Operator Notes */}
          <form onSubmit={handleSaveRoleAndNotes} className={styles.drawerSection}>
            <div className={styles.drawerSectionHead}>
              <h3 className={styles.drawerSectionTitle}>Directory Metadata &amp; Internal Notes</h3>
            </div>

            <div className={styles.panelGrid}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="drawer-role">
                  Directory Tier
                </label>
                <select
                  id="drawer-role"
                  className={styles.select}
                  value={isSelf ? 'owner' : roleValue}
                  disabled={isSelf || actionBusy}
                  onChange={(e) => setRoleValue(e.target.value === 'support' ? 'support' : 'member')}
                >
                  {isSelf ? (
                    <option value="owner">Owner (Primary Admin)</option>
                  ) : (
                    <>
                      <option value="member">Member (Standard)</option>
                      <option value="support">VIP / Support Tag</option>
                    </>
                  )}
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="drawer-risk">
                  Operator Flag
                </label>
                <select
                  id="drawer-risk"
                  className={styles.select}
                  value={riskFlag}
                  disabled={actionBusy}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRiskFlag(v === 'watch' || v === 'vip' ? v : 'normal');
                  }}
                >
                  <option value="normal">Standard</option>
                  <option value="vip">VIP / Priority</option>
                  <option value="watch">Watchlist</option>
                </select>
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="drawer-note">
                Private Operator Notes (Admin-Only Collection)
              </label>
              <textarea
                id="drawer-note"
                className={styles.textarea}
                maxLength={1000}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Internal compliance or support context (never visible to end users)…"
              />
            </div>

            <div className={styles.actionsRow}>
              <button type="submit" className={styles.secondaryBtn} disabled={actionBusy}>
                Save Metadata &amp; Notes
              </button>
            </div>
          </form>

          {/* Compliance & Enforcement */}
          {!isSelf && (
            <section className={styles.drawerSection}>
              <h3 className={styles.drawerSectionTitle}>Access Enforcement</h3>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="drawer-suspend-reason">
                  Suspension Reason (Shown to User if Suspended)
                </label>
                <input
                  id="drawer-suspend-reason"
                  type="text"
                  className={styles.input}
                  maxLength={240}
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  placeholder="e.g. Policy review in progress or requested temporary lock"
                  disabled={actionBusy}
                />
              </div>

              <div className={styles.actionsRow}>
                <button
                  type="button"
                  className={isSuspended ? styles.primaryBtn : styles.dangerBtn}
                  disabled={actionBusy}
                  onClick={() => void handleToggleSuspension()}
                >
                  {isSuspended ? <ShieldCheck size={15} /> : <ShieldAlert size={15} />}
                  <span>{isSuspended ? 'Restore Account Access' : 'Suspend Account'}</span>
                </button>

                {!confirmDeleteStep ? (
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    disabled={actionBusy}
                    onClick={() => setConfirmDeleteStep(true)}
                  >
                    <Trash2 size={14} />
                    <span>Remove Directory Entry</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.dangerBtn}
                    disabled={actionBusy}
                    onClick={() => void handleRemoveDirectory()}
                  >
                    <Trash2 size={14} />
                    <span>Confirm Remove Summary</span>
                  </button>
                )}
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
