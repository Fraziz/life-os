'use client';

import React, { useState } from 'react';
import { ExternalLink, AlertCircle } from 'lucide-react';
import styles from './YouTubePlayer.module.css';

interface YouTubePlayerProps {
  videoId: string;
  startTime?: number;
  title?: string;
  className?: string;
}

export default function YouTubePlayer({
  videoId,
  startTime = 0,
  title = 'YouTube Video Lesson',
  className,
}: YouTubePlayerProps) {
  const [hasError, setHasError] = useState(false);

  const isValidId = Boolean(videoId && /^[\w-]{11}$/.test(videoId));
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}${startTime > 0 ? `&t=${startTime}s` : ''}`;

  if (!isValidId || hasError) {
    return (
      <div className={`${styles.playerWrapper} ${className || ''}`}>
        <div className={styles.playerFallback}>
          <AlertCircle size={28} style={{ color: 'var(--color-warning, #f59e0b)' }} />
          <h4 className={styles.fallbackTitle}>Video Unavailable in Embedded View</h4>
          <p className={styles.fallbackText}>
            This YouTube video might require playback on YouTube or have embedding disabled by the creator.
          </p>
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.openYoutubeBtn}
          >
            <span>Open on YouTube</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>
    );
  }

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?start=${startTime}&rel=0`;

  return (
    <div className={`${styles.playerWrapper} ${className || ''}`}>
      <iframe
        className={styles.playerIframe}
        src={embedUrl}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </div>
  );
}
