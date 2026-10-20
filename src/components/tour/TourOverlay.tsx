'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { useTour } from '@/context/TourContext';
import styles from './TourOverlay.module.css';

interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function TourOverlay() {
  const {
    isOpen,
    currentStep,
    stepIndex,
    totalSteps,
    nextStep,
    prevStep,
    skipTour,
  } = useTour();

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const targetElRef = useRef<HTMLElement | null>(null);

  // Measure and position spotlight over target element
  const updateTargetPosition = useCallback(() => {
    if (!currentStep) return;

    let el = document.querySelector(currentStep.target) as HTMLElement | null;

    // Try fallback target if primary isn't found
    if (!el && currentStep.fallbackTarget) {
      el = document.querySelector(currentStep.fallbackTarget) as HTMLElement | null;
    }

    if (!el) {
      setTargetRect(null);
      return;
    }

    targetElRef.current = el;
    const rect = el.getBoundingClientRect();

    const padding = 6;
    const computedRect: TargetRect = {
      x: Math.max(4, rect.left - padding),
      y: Math.max(4, rect.top - padding),
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    };

    setTargetRect(computedRect);

    // Calculate tooltip coordinates
    const tooltipWidth = 330;
    const tooltipHeight = 190;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = 0;
    let top = 0;
    const placement = currentStep.placement || 'auto';

    if (viewportWidth <= 640) {
      // Mobile: docks to bottom
      return;
    }

    if (placement === 'right') {
      left = computedRect.x + computedRect.width + 14;
      top = computedRect.y + (computedRect.height / 2) - (tooltipHeight / 2);

      // If overflows right, flip to left
      if (left + tooltipWidth > viewportWidth - 16) {
        left = computedRect.x - tooltipWidth - 14;
      }
    } else if (placement === 'left') {
      left = computedRect.x - tooltipWidth - 14;
      top = computedRect.y + (computedRect.height / 2) - (tooltipHeight / 2);

      // If overflows left, flip to right
      if (left < 16) {
        left = computedRect.x + computedRect.width + 14;
      }
    } else if (placement === 'top') {
      top = computedRect.y - tooltipHeight - 14;
      left = computedRect.x + (computedRect.width / 2) - (tooltipWidth / 2);

      // If overflows top, flip to bottom
      if (top < 16) {
        top = computedRect.y + computedRect.height + 14;
      }
    } else {
      // bottom / auto
      top = computedRect.y + computedRect.height + 14;
      left = computedRect.x + (computedRect.width / 2) - (tooltipWidth / 2);

      // If overflows bottom, flip to top
      if (top + tooltipHeight > viewportHeight - 16) {
        top = computedRect.y - tooltipHeight - 14;
      }
    }

    // Clamp within viewport
    left = Math.max(16, Math.min(viewportWidth - tooltipWidth - 16, left));
    top = Math.max(16, Math.min(viewportHeight - tooltipHeight - 16, top));

    setTooltipPos({ left, top });
  }, [currentStep]);

  // Scroll target into view and position spotlight
  useEffect(() => {
    if (!isOpen || !currentStep) return;

    let attempts = 0;
    const maxAttempts = 15;

    const findAndScroll = () => {
      let el = document.querySelector(currentStep.target) as HTMLElement | null;
      if (!el && currentStep.fallbackTarget) {
        el = document.querySelector(currentStep.fallbackTarget) as HTMLElement | null;
      }

      if (el) {
        // If element is not already well in viewport, scroll gently
        const r = el.getBoundingClientRect();
        const isInView =
          r.top >= 20 &&
          r.bottom <= window.innerHeight - 20 &&
          r.left >= 20 &&
          r.right <= window.innerWidth - 20;

        if (!isInView) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }

        setTimeout(() => updateTargetPosition(), 120);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(findAndScroll, 100);
      }
    };

    findAndScroll();

    // Listen for resize and scroll events
    const handleScrollOrResize = () => {
      updateTargetPosition();
    };

    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    window.addEventListener('scroll', handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize);
    };
  }, [isOpen, currentStep, updateTargetPosition]);

  // Action step listener: if step is interactive, clicking the actual element advances the tour
  useEffect(() => {
    if (!isOpen || !currentStep?.isAction || !targetElRef.current) return;

    const el = targetElRef.current;
    const handleTargetClick = () => {
      // Small timeout to allow element's native action to initiate
      setTimeout(() => {
        nextStep();
      }, 150);
    };

    el.addEventListener('click', handleTargetClick);
    return () => {
      el.removeEventListener('click', handleTargetClick);
    };
  }, [isOpen, currentStep, nextStep]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        skipTour();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, nextStep, prevStep, skipTour]);

  if (!isOpen || !currentStep) return null;

  const isLastStep = stepIndex + 1 === totalSteps;

  return (
    <div className={styles.overlayContainer} role="dialog" aria-modal="true" aria-label={currentStep.title}>
      {/* SVG Spotlight Cutout */}
      <svg className={styles.overlaySvg} preserveAspectRatio="none">
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.x}
                y={targetRect.y}
                width={targetRect.width}
                height={targetRect.height}
                rx="8"
                ry="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(8, 10, 16, 0.65)"
          mask="url(#tour-spotlight-mask)"
          onClick={nextStep}
        />
      </svg>

      {/* Target Highlight Glowing Frame */}
      {targetRect && (
        <div
          className={`${styles.spotlightFrame} ${currentStep.isAction ? styles.spotlightFrameInteractive : ''}`}
          style={{
            left: `${targetRect.x}px`,
            top: `${targetRect.y}px`,
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`,
          }}
          onClick={currentStep.isAction ? nextStep : undefined}
          title={currentStep.isAction ? currentStep.actionHint || 'Click to continue' : undefined}
        />
      )}

      {/* Floating Tooltip Card */}
      <div
        ref={tooltipRef}
        className={styles.tooltipCard}
        style={{
          left: `${tooltipPos.left}px`,
          top: `${tooltipPos.top}px`,
        }}
      >
        <div className={styles.tooltipHeader}>
          <div className={styles.stepBadge}>
            <span className={styles.stepBadgeDot} />
            <span>
              Step {stepIndex + 1} of {totalSteps}
            </span>
          </div>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={skipTour}
            aria-label="Skip Tour (Escape)"
            title="Skip Tour (Esc)"
          >
            <X size={15} />
          </button>
        </div>

        <h3 className={styles.tooltipTitle}>{currentStep.title}</h3>
        <p className={styles.tooltipContent}>{currentStep.content}</p>

        {currentStep.isAction && (
          <div className={styles.actionHint}>
            <span>{currentStep.actionHint || 'Click the highlighted feature or press Next'}</span>
          </div>
        )}

        {/* Step Progress Dots */}
        <div className={styles.progressRow} aria-hidden="true">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <div
              key={idx}
              className={`${styles.progressDot} ${
                idx === stepIndex
                  ? styles.progressDotActive
                  : idx < stepIndex
                  ? styles.progressDotCompleted
                  : ''
              }`}
            />
          ))}
        </div>

        {/* Footer Navigation */}
        <div className={styles.tooltipFooter}>
          <button type="button" className={styles.skipBtn} onClick={skipTour}>
            Skip Tour
          </button>

          <div className={styles.navBtns}>
            <button
              type="button"
              className={styles.backBtn}
              onClick={prevStep}
              disabled={stepIndex === 0}
              title="Previous step (ArrowLeft)"
            >
              Back
            </button>

            <button
              type="button"
              className={styles.nextBtn}
              onClick={nextStep}
              title={isLastStep ? 'Finish Tour' : 'Next step (ArrowRight / Enter)'}
            >
              {isLastStep ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
