// ============================================================
// useTouchGestures — React hook
// Detects swipe left/right/up/down on a ref element.
// Used for mobile navigation between app screens and
// for swipe-to-dismiss modals.
// Sprint: mobile-leaderboard-onboarding-batch4
// ============================================================

import { useEffect, useRef, useCallback } from 'react';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

interface TouchGestureOptions {
  /** Minimum swipe distance in px to trigger (default 50) */
  threshold?: number;
  /** Maximum time in ms for the swipe (default 400) */
  maxTime?: number;
  onSwipe?: (direction: SwipeDirection) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export function useTouchGestures<T extends HTMLElement>(
  options: TouchGestureOptions
): React.RefObject<T> {
  const ref = useRef<T>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const {
    threshold = 50,
    maxTime = 400,
    onSwipe,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
  } = options;

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const dt = Date.now() - touchStartRef.current.time;
      touchStartRef.current = null;

      if (dt > maxTime) return;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx < threshold && absDy < threshold) return;

      let direction: SwipeDirection;
      if (absDx > absDy) {
        direction = dx > 0 ? 'right' : 'left';
      } else {
        direction = dy > 0 ? 'down' : 'up';
      }

      onSwipe?.(direction);
      if (direction === 'left')  onSwipeLeft?.();
      if (direction === 'right') onSwipeRight?.();
      if (direction === 'up')    onSwipeUp?.();
      if (direction === 'down')  onSwipeDown?.();
    },
    [threshold, maxTime, onSwipe, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);

  return ref;
}
