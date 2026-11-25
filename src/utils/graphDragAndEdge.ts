'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface NodeBoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NodePoint {
  x: number;
  y: number;
}

/**
 * Computes a smooth Bezier connector between two boxes, automatically picking
 * the facing edges (left/right/top/bottom) so arrows follow cleanly as boxes move.
 */
export function getAdaptiveBezierPath(from: NodeBoxRect, to: NodeBoxRect): string {
  const fromCx = from.x + from.width / 2;
  const fromCy = from.y + from.height / 2;
  const toCx = to.x + to.width / 2;
  const toCy = to.y + to.height / 2;
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;

  if (Math.abs(dx) >= Math.abs(dy) * 0.85) {
    const goingRight = dx >= 0;
    const sx = goingRight ? from.x + from.width : from.x;
    const sy = fromCy;
    const tx = goingRight ? to.x : to.x + to.width;
    const ty = toCy;
    const curve = Math.max(48, Math.abs(tx - sx) * 0.52);
    const c1x = goingRight ? sx + curve : sx - curve;
    const c2x = goingRight ? tx - curve : tx + curve;
    return `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}`;
  }

  const goingDown = dy >= 0;
  const sx = fromCx;
  const sy = goingDown ? from.y + from.height : from.y;
  const tx = toCx;
  const ty = goingDown ? to.y : to.y + to.height;
  const curve = Math.max(36, Math.abs(ty - sy) * 0.52);
  const c1y = goingDown ? sy + curve : sy - curve;
  const c2y = goingDown ? ty - curve : ty + curve;
  return `M ${sx} ${sy} C ${sx} ${c1y}, ${tx} ${c2y}, ${tx} ${ty}`;
}

interface ActiveDragState {
  id: string;
  startClientX: number;
  startClientY: number;
  origX: number;
  origY: number;
}

/**
 * Reusable mouse + touch node-dragging hook for zoomable Graph Flow canvases.
 * Persists custom node coordinates in localStorage under `storageKey` and
 * suppresses accidental click selection immediately after a >4px drag.
 */
export function useDraggableGraphNodes(storageKey: string, zoom: number) {
  const [positions, setPositions] = useState<Record<string, NodePoint>>({});
  const [draggingNode, setDraggingNode] = useState<ActiveDragState | null>(null);
  const positionsRef = useRef<Record<string, NodePoint>>({});
  const movedRef = useRef<boolean>(false);

  // Hydrate positions whenever storageKey changes
  useEffect(() => {
    let loaded: Record<string, NodePoint> = {};
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          loaded = parsed;
        }
      }
    } catch {}
    positionsRef.current = loaded;
    setPositions(loaded);
  }, [storageKey]);

  const startNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string, origin: NodePoint) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('button, a, select, input, textarea')) {
        return;
      }
      e.stopPropagation();
      e.preventDefault();
      movedRef.current = false;
      setDraggingNode({
        id: nodeId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        origX: origin.x,
        origY: origin.y,
      });
    },
    []
  );

  const startNodeTouchStart = useCallback(
    (e: React.TouchEvent, nodeId: string, origin: NodePoint) => {
      if (e.touches.length !== 1) return;
      if ((e.target as HTMLElement).closest('button, a, select, input, textarea')) {
        return;
      }
      e.stopPropagation();
      movedRef.current = false;
      setDraggingNode({
        id: nodeId,
        startClientX: e.touches[0].clientX,
        startClientY: e.touches[0].clientY,
        origX: origin.x,
        origY: origin.y,
      });
    },
    []
  );

  useEffect(() => {
    if (!draggingNode) return;

    const applyDelta = (clientX: number, clientY: number) => {
      const rawDx = clientX - draggingNode.startClientX;
      const rawDy = clientY - draggingNode.startClientY;
      if (Math.abs(rawDx) > 4 || Math.abs(rawDy) > 4) {
        movedRef.current = true;
      }
      if (!movedRef.current) return;

      const nextPos = {
        x: Math.round(draggingNode.origX + rawDx / zoom),
        y: Math.round(draggingNode.origY + rawDy / zoom),
      };
      const updated = { ...positionsRef.current, [draggingNode.id]: nextPos };
      positionsRef.current = updated;
      setPositions(updated);
    };

    const onMouseMove = (e: MouseEvent) => applyDelta(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        applyDelta(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onFinish = () => {
      setDraggingNode(null);
      if (movedRef.current) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(positionsRef.current));
        } catch {}
        setTimeout(() => {
          movedRef.current = false;
        }, 80);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onFinish);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onFinish);
    window.addEventListener('touchcancel', onFinish);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onFinish);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onFinish);
      window.removeEventListener('touchcancel', onFinish);
    };
  }, [draggingNode, zoom, storageKey]);

  const resetPositions = useCallback(() => {
    positionsRef.current = {};
    setPositions({});
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);

  return {
    positions,
    draggingNodeId: draggingNode?.id ?? null,
    hasMovedSinceDown: () => movedRef.current,
    hasCustomPositions: Object.keys(positions).length > 0,
    startNodeMouseDown,
    startNodeTouchStart,
    resetPositions,
  };
}
