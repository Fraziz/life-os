'use client';

import { useEffect, useRef } from 'react';

/**
 * Checks whether an element is an editable input/text surface where arrow keys
 * should move the cursor or selection instead of scrolling.
 */
function isEditableElement(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;

  const tagName = el.tagName;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)) {
    return true;
  }

  if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
    return true;
  }

  if (el.closest('[contenteditable="true"]')) {
    return true;
  }

  const role = el.getAttribute('role');
  if (role === 'textbox' || role === 'combobox' || role === 'searchbox' || role === 'slider') {
    return true;
  }

  // If activeElement in document is an editable element, don't hijack keys
  const active = document.activeElement;
  if (
    active &&
    active !== el &&
    (active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      (active as HTMLElement).isContentEditable ||
      active.getAttribute('contenteditable') === 'true' ||
      active.closest('[contenteditable="true"]'))
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if an element currently has scrollable overflow along the specified axis.
 * Strict check: only returns true if the element actually has scrollable distance right now.
 */
function isScrollableElement(el: HTMLElement, axis: 'y' | 'x'): boolean {
  if (!el || el === document.body || el === document.documentElement) return false;

  // Ignore invisible or display:none elements
  if (el.offsetParent === null && window.getComputedStyle(el).position !== 'fixed') {
    return false;
  }

  const style = window.getComputedStyle(el);
  if (axis === 'y') {
    const overflowY = style.overflowY;
    const allowsY = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
    return allowsY && el.scrollHeight > el.clientHeight + 1;
  } else {
    const overflowX = style.overflowX;
    const allowsX = overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay';
    return allowsX && el.scrollWidth > el.clientWidth + 1;
  }
}

/**
 * Checks whether the element has scroll room in the specified direction.
 */
function canScrollInDirection(
  el: HTMLElement,
  direction: 'up' | 'down' | 'left' | 'right'
): boolean {
  const tolerance = 2;
  if (direction === 'up') {
    return el.scrollTop > tolerance;
  }
  if (direction === 'down') {
    return el.scrollTop + el.clientHeight < el.scrollHeight - tolerance;
  }
  if (direction === 'left') {
    return el.scrollLeft > tolerance;
  }
  if (direction === 'right') {
    return el.scrollLeft + el.clientWidth < el.scrollWidth - tolerance;
  }
  return false;
}

/**
 * Walks up DOM ancestors starting from startEl to find a scrollable container
 * that can scroll in the desired direction.
 */
function findScrollableAncestor(
  startEl: HTMLElement | null,
  axis: 'y' | 'x',
  direction: 'up' | 'down' | 'left' | 'right'
): HTMLElement | null {
  let curr: HTMLElement | null = startEl;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    if (isScrollableElement(curr, axis) && canScrollInDirection(curr, direction)) {
      return curr;
    }
    curr = curr.parentElement;
  }
  return null;
}

/**
 * Checks whether an element is an interactive control (button, link, checkbox)
 * where pressing Space is meant to activate the control rather than scroll.
 */
function isInteractiveControl(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;

  const tagName = el.tagName;
  if (['BUTTON', 'A', 'SUMMARY'].includes(tagName)) return true;

  const role = el.getAttribute('role');
  if (role === 'button' || role === 'link' || role === 'checkbox' || role === 'radio' || role === 'menuitem' || role === 'tab') {
    return true;
  }

  const active = document.activeElement;
  if (
    active &&
    active instanceof HTMLElement &&
    (['BUTTON', 'A', 'SUMMARY'].includes(active.tagName) ||
      ['button', 'link', 'checkbox', 'radio', 'menuitem', 'tab'].includes(active.getAttribute('role') || ''))
  ) {
    return true;
  }

  return false;
}

/**
 * Hook to support keyboard arrow key and spacebar scrolling across any existing scrollable area
 * in the application (lists, reader canvas, feeds, sidebars, modals, window).
 * 
 * Complies strictly with rule: only supports existing scroll areas, never adds new scrolls.
 */
export function useArrowKeyScroll() {
  const hoveredElRef = useRef<HTMLElement | null>(null);
  const clickedElRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onPointerOver = (e: PointerEvent) => {
      if (e.target instanceof HTMLElement) {
        hoveredElRef.current = e.target;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof HTMLElement) {
        clickedElRef.current = e.target;
      }
    };

    window.addEventListener('pointerover', onPointerOver, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });

    return () => {
      window.removeEventListener('pointerover', onPointerOver);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  useEffect(() => {
    const STEP_Y = 56;
    const STEP_X = 56;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if event was already handled by a menu, command palette, or dropdown
      if (e.defaultPrevented) return;

      // Ignore if typing inside text fields, inputs, or contentEditable editors
      if (isEditableElement(e.target)) return;

      // Ignore modifier combinations (Ctrl, Alt, Meta) to preserve shortcuts
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key;
      const isSpace = key === ' ' || key === 'Spacebar' || e.code === 'Space';

      // Preserve Shift selection for non-space keys (e.g. Shift+Arrow)
      if (e.shiftKey && !isSpace) return;

      // Preserve button/control activation on Space
      if (isSpace && isInteractiveControl(e.target)) return;

      let axis: 'y' | 'x' = 'y';
      let direction: 'up' | 'down' | 'left' | 'right' = 'down';
      let isPage = false;
      let isHomeEnd = false;

      if (isSpace) {
        axis = 'y';
        direction = e.shiftKey ? 'up' : 'down';
        isPage = true;
      } else {
        switch (key) {
          case 'ArrowDown':
            axis = 'y';
            direction = 'down';
            break;
          case 'ArrowUp':
            axis = 'y';
            direction = 'up';
            break;
          case 'ArrowRight':
            axis = 'x';
            direction = 'right';
            break;
          case 'ArrowLeft':
            axis = 'x';
            direction = 'left';
            break;
          case 'PageDown':
            axis = 'y';
            direction = 'down';
            isPage = true;
            break;
          case 'PageUp':
            axis = 'y';
            direction = 'up';
            isPage = true;
            break;
          case 'Home':
            axis = 'y';
            direction = 'up';
            isHomeEnd = true;
            break;
          case 'End':
            axis = 'y';
            direction = 'down';
            isHomeEnd = true;
            break;
          default:
            return; // Unrelated key
        }
      }

      // Candidate resolution:
      // 1. Element currently hovered under the mouse pointer
      // 2. Currently focused element
      // 3. Last clicked element
      // 4. Any open modal or drawer dialog
      // 5. Main page content wrapper / Window
      const candidates: (HTMLElement | null)[] = [
        hoveredElRef.current?.isConnected ? hoveredElRef.current : null,
        document.activeElement instanceof HTMLElement && document.activeElement !== document.body && document.activeElement.isConnected
          ? document.activeElement
          : null,
        clickedElRef.current?.isConnected ? clickedElRef.current : null,
        document.querySelector('[role="dialog"], [aria-modal="true"], .modal, .drawer') as HTMLElement | null,
        document.querySelector('main') as HTMLElement | null,
      ];

      let targetScrollEl: HTMLElement | null = null;
      for (const candidate of candidates) {
        if (!candidate) continue;
        const found = findScrollableAncestor(candidate, axis, direction);
        if (found) {
          targetScrollEl = found;
          break;
        }
      }

      const isRepeat = e.repeat;
      const scrollBehavior: ScrollBehavior = isRepeat ? 'auto' : 'smooth';

      if (targetScrollEl) {
        e.preventDefault();

        if (axis === 'y') {
          if (isHomeEnd) {
            targetScrollEl.scrollTo({
              top: direction === 'down' ? targetScrollEl.scrollHeight : 0,
              behavior: scrollBehavior,
            });
            return;
          }

          const deltaY = isPage
            ? (direction === 'down' ? targetScrollEl.clientHeight * 0.8 : -targetScrollEl.clientHeight * 0.8)
            : (direction === 'down' ? STEP_Y : -STEP_Y);

          targetScrollEl.scrollBy({
            top: deltaY,
            behavior: scrollBehavior,
          });
        } else {
          const deltaX = direction === 'right' ? STEP_X : -STEP_X;
          targetScrollEl.scrollBy({
            left: deltaX,
            behavior: scrollBehavior,
          });
        }
        return;
      }

      // If no inner container has room to scroll along Y, fallback to window / document scroll
      if (axis === 'y') {
        const doc = document.documentElement;
        const currentScroll = window.scrollY || doc.scrollTop;
        const maxScroll = Math.max(doc.scrollHeight, document.body.scrollHeight) - window.innerHeight;

        const canWindowScroll =
          (direction === 'down' && currentScroll < maxScroll - 2) ||
          (direction === 'up' && currentScroll > 2);

        if (canWindowScroll) {
          e.preventDefault();

          if (isHomeEnd) {
            window.scrollTo({
              top: direction === 'down' ? doc.scrollHeight : 0,
              behavior: scrollBehavior,
            });
            return;
          }

          const deltaY = isPage
            ? (direction === 'down' ? window.innerHeight * 0.8 : -window.innerHeight * 0.8)
            : (direction === 'down' ? STEP_Y : -STEP_Y);

          window.scrollBy({
            top: deltaY,
            behavior: scrollBehavior,
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
