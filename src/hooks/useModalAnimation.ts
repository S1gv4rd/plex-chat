"use client";

import { useState, useLayoutEffect, useCallback, useRef } from "react";

interface UseModalAnimationReturn {
  visible: boolean;
  shouldRender: boolean;
  close: () => void;
}

/**
 * Hook for managing modal open/close animations.
 * Uses useLayoutEffect for synchronous DOM updates before paint.
 */
export function useModalAnimation(
  isOpen: boolean,
  animationDuration: number = 200
): UseModalAnimationReturn {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [visible, setVisible] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use useLayoutEffect for synchronous DOM updates before browser paint
  // This is the correct pattern for animation sequencing
  useLayoutEffect(() => {
    // Cleanup previous animations
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (isOpen) {
      // Opening: render first, then animate in
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShouldRender(true);
      // Use double RAF to ensure DOM has updated before animating
      animationFrameRef.current = requestAnimationFrame(() => {
        animationFrameRef.current = requestAnimationFrame(() => {
          setVisible(true);
        });
      });
    } else {
      // Closing: animate out first, then stop rendering
      setVisible(false);
      timeoutRef.current = setTimeout(() => {
        setShouldRender(false);
      }, animationDuration);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isOpen, animationDuration]);

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  return { visible, shouldRender, close };
}
