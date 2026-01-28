import { useRef, useEffect } from "react";
import { onEvent, offEvent } from "./vanilla";
import type { EventHandler, EventOptions } from "./types";

/**
 * React hook để đăng ký lắng nghe event (wrapper cho EventEmitter)
 * - Tự động cleanup khi unmount
 * - Không bị stale closure
 */
export function useEvent(
  eventName: string,
  handler: EventHandler,
  deps: any[] = [],
  options?: EventOptions,
): void {
  // Lưu handler mới nhất, tránh bị closure cũ
  const handlerRef = useRef<EventHandler>(handler);

  // Mỗi khi handler thay đổi → cập nhật ref
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    // Wrapper để luôn gọi handler mới nhất
    const handlerWrapper = (event: any) => handlerRef.current?.(event);

    // Đăng ký event
    const context = onEvent(eventName, handlerWrapper, options);

    // Cleanup khi unmount hoặc deps thay đổi
    return () =>
      offEvent(eventName, handlerWrapper, {
        ...options,
        context,
      });
  }, [eventName, options?.once, ...deps]);
}
