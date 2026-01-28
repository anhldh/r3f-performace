import EventEmitter from "eventemitter3";
import type { EventHandler, EventOptions, EventContext } from "./types";

// EventEmitter dùng chung toàn app
const eventEmitter = new EventEmitter();

/**
 * Đăng ký event
 */
export function onEvent(
  eventName: string,
  handler: EventHandler,
  options?: EventOptions,
): EventContext {
  return options?.once
    ? eventEmitter.once(eventName, handler)
    : eventEmitter.on(eventName, handler);
}

/**
 * Huỷ đăng ký event
 */
export function offEvent(
  eventName: string,
  handler: EventHandler,
  options?: EventOptions,
): void {
  eventEmitter.removeListener(
    eventName,
    handler,
    options?.context ?? null,
    options?.once,
  );
}

/**
 * Emit event
 */
export function emitEvent(eventName: string, payload?: any): void {
  eventEmitter.emit(eventName, payload);
}
