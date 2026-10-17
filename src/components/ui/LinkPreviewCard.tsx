'use client';

import React, { useState, useEffect } from 'react';
import { ExternalLink, Copy, Check, Globe, Lock, Edit2, Trash2, X } from 'lucide-react';
import { fetchLinkPreview, LinkPreviewData } from '@/utils/linkPreview';
import styles from './LinkPreviewCard.module.css';

interface LinkPreviewCardProps {
  url: string;
  initialData?: LinkPreviewData | null;
  onClose?: () => void;
  onEdit?: () => void;
  onUnlink?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function LinkPreviewCard({
  url,
  initialData,
  onClose,
  onEdit,
  onUnlink,
  className,
  style,
}: LinkPreviewCardProps) {
  const [data, setData] = useState<LinkPreviewData | null>(initialData || null);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [copied, setCopied] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    if (!initialData) {
      setLoading(true);
      fetchLinkPreview(url)
        .then((res) => {
          if (mounted) {
            setData(res);
            setLoading(false);
          }
        })
        .catch(() => {
          if (mounted) setLoading(false);
        });
    } else {
      setData(initialData);
      setLoading(false);
    }
    return () => {
      mounted = false;
    };
  }, [url, initialData]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const hostname = data?.hostname || (() => {
    try {
      return new URL(url).hostname.replace(/^www\./i, '');
    } catch {
      return 'website';
    }
  })();

  const siteName = data?.siteName || hostname;
  const title = data?.title || url;
  const description = data?.description || `Explore ${hostname} in your browser.`;
  const image = !imgError && data?.image ? data.image : null;
  const favicon = data?.favicon || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`;

  return (
    <div
      className={`${styles.card} ${className || ''}`}
      style={style}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="Link preview"
    >
      {/* Header Bar with Site Favicon & SSL Badge */}
      <div className={styles.header}>
        <div className={styles.siteInfo}>
          <img
            src={favicon}
            alt=""
            className={styles.favicon}
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <span className={styles.siteBadge}>{siteName}</span>
          <span className={styles.sslBadge} title="Secure HTTPS Connection">
            <Lock size={9} />
            <span>SSL</span>
          </span>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.headerBtn}
            onClick={handleCopy}
            title={copied ? 'Copied link!' : 'Copy Link URL'}
          >
            {copied ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
          </button>
          {onClose && (
            <button
              type="button"
              className={styles.headerBtn}
              onClick={onClose}
              title="Close Preview"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.skeletonContainer}>
          <div className={styles.skeletonBanner} />
          <div className={styles.skeletonLine} style={{ width: '85%' }} />
          <div className={styles.skeletonLine} style={{ width: '60%' }} />
        </div>
      ) : (
        <>
          {/* Optional High-Res OpenGraph Image Banner */}
          {image && (
            <div className={styles.coverImageContainer}>
              <img
                src={image}
                alt={title}
                className={styles.coverImage}
                onError={() => setImgError(true)}
              />
            </div>
          )}

          {/* Title & Description Body */}
          <div className={styles.body}>
            <h4 className={styles.title} title={title}>
              {title}
            </h4>
            <p className={styles.description} title={description}>
              {description}
            </p>
            <div className={styles.urlBreadcrumb} title={url}>
              {url}
            </div>
          </div>
        </>
      )}

      {/* Action Footer */}
      <div className={styles.footer}>
        <div className={styles.footerLeft}>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            onClick={handleOpen}
            title="Open link in new tab"
          >
            <ExternalLink size={12} />
            <span>Visit Site</span>
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleCopy}
            title="Copy URL"
          >
            {copied ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Knowledge Editor contextual actions */}
        {(onEdit || onUnlink) && (
          <div className={styles.footerRight}>
            {onEdit && (
              <button
                type="button"
                className={styles.actionBtn}
                onClick={onEdit}
                title="Edit link URL"
              >
                <Edit2 size={11} />
                <span>Edit</span>
              </button>
            )}
            {onUnlink && (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                onClick={onUnlink}
                title="Remove link"
              >
                <Trash2 size={11} />
                <span>Unlink</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
