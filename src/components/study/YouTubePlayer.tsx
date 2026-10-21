'use client';

import React, { useState } from 'react';
import { ExternalLink, AlertCircle, Copy, Check, Maximize2, Sparkles } from 'lucide-react';
import styles from './YouTubePlayer.module.css';
import { parseUniversalVideoUrl } from '@/utils/universalVideo';

interface YouTubePlayerProps {
  videoId?: string;
  url?: string;
  startTime?: number;
  title?: string;
  className?: string;
}

export default function YouTubePlayer({
  videoId = '',
  url = '',
  startTime = 0,
  title = 'Video Lesson',
  className,
}: YouTubePlayerProps) {
  const [hasError, setHasError] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Parse using Universal Video engine
  const targetUrl = url || (videoId && /^[\w-]{11}$/.test(videoId) ? `https://www.youtube.com/watch?v=${videoId}` : videoId);
  const parsed = parseUniversalVideoUrl(targetUrl);

  const isVertical = parsed?.aspectRatio === '9/16';
  const wrapperClass = `${styles.playerWrapper} ${isVertical ? styles.playerWrapperVertical : ''}`;
  const platformName = parsed?.platformName || 'Video';
  const externalLink = parsed?.cleanExternalUrl || targetUrl || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');

  const handlePopout = () => {
    if (!externalLink) return;
    const width = 880;
    const height = 580;
    const left = Math.max(0, typeof window !== 'undefined' ? window.screen.width - width - 40 : 0);
    const top = 60;
    window.open(
      externalLink,
      'LifeOSVideoPlayer',
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=no`
    );
  };

  const handleCopy = () => {
    if (!externalLink) return;
    navigator.clipboard.writeText(externalLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Render video inner element
  const renderInnerMedia = () => {
    // 1. Native HTML5 Video for Direct MP4 / WebM
    if (parsed?.platform === 'direct') {
      return (
        <video
          className={styles.nativeVideo}
          src={parsed.originalUrl}
          controls
          playsInline
          preload="metadata"
        />
      );
    }

    // 2. Direct Embeds: YouTube, TikTok, Instagram, X, Telegram, Facebook, Vimeo
    if (parsed && parsed.canEmbedDirectly && parsed.embedUrl && !hasError) {
      return (
        <iframe
          className={styles.playerIframe}
          src={parsed.embedUrl}
          title={title || parsed.titleHint || `${platformName} Video`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          onError={() => setHasError(true)}
        />
      );
    }

    // 3. Fallback for standard 11-char YouTube video ID if URL parser wasn't given a full link
    const isValidYouTubeId = Boolean(videoId && /^[\w-]{11}$/.test(videoId));
    if (isValidYouTubeId && !hasError) {
      const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?start=${startTime}&rel=0`;
      return (
        <iframe
          className={styles.playerIframe}
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          onError={() => setHasError(true)}
        />
      );
    }

    // 4. Fallback Card
    return (
      <div className={styles.playerFallback}>
        <AlertCircle size={28} style={{ color: 'var(--color-warning, #f59e0b)' }} />
        <h4 className={styles.fallbackTitle}>{platformName} Video</h4>
        <p className={styles.fallbackText}>
          {hasError
            ? `Embedded playback was restricted by ${platformName}. Tap below to watch with your logged-in account.`
            : `This ${platformName} video is ready to watch.`}
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" onClick={handlePopout} className={styles.openYoutubeBtn}>
            <Maximize2 size={13} />
            <span>Watch in Pop-out Window ⧉</span>
          </button>
          {externalLink && (
            <a
              href={externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.openYoutubeBtn}
            >
              <span>Open on {platformName}</span>
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>
    );
  };

  const isSocialPlatform = parsed?.platform === 'facebook' || parsed?.platform === 'instagram' || parsed?.platform === 'tiktok';

  return (
    <div className={`${styles.playerContainer} ${className || ''}`}>
      {/* Top Controls Bar */}
      <div className={styles.playerTopBar}>
        <span className={styles.platformBadge}>
          {platformName}
        </span>
        <div className={styles.topBarActions}>
          <button
            type="button"
            className={styles.topBarBtn}
            onClick={handlePopout}
            title="Open in floating side-by-side companion window (keeps your login session)"
          >
            <Maximize2 size={11} />
            <span>Pop-out ⧉</span>
          </button>
          {externalLink && (
            <a
              href={externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.topBarBtn}
              title={`Open directly on ${platformName}`}
            >
              <ExternalLink size={11} />
              <span>Open ↗</span>
            </a>
          )}
          <button
            type="button"
            className={styles.topBarBtn}
            onClick={handleCopy}
            title="Copy video link"
          >
            {isCopied ? <Check size={11} style={{ color: 'var(--color-success)' }} /> : <Copy size={11} />}
            <span>{isCopied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div className={wrapperClass}>
        {renderInnerMedia()}
      </div>

      {/* Helper Tip for Social Media Videos with strict cookie/embed policies */}
      {isSocialPlatform && (
        <div className={styles.playerTipBanner}>
          <div className={styles.playerTipText}>
            <Sparkles size={13} style={{ color: 'var(--color-accent-light)' }} />
            <span>If {platformName} shows &ldquo;Unavailable&rdquo; in the frame, tap Pop-out to watch with your logged-in account.</span>
          </div>
          <button type="button" className={styles.playerTipBtn} onClick={handlePopout}>
            Pop-out ⧉
          </button>
        </div>
      )}
    </div>
  );
}
