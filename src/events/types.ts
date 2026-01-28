import type EventEmitter from "eventemitter3";

/**
 * Callback cho event
 */
export type EventHandler = (...args: any[]) => any;

/**
 * EventEmitter context
 */
export type EventContext = EventEmitter;

/**
 * Tuỳ chọn cho event
 */
export interface EventOptions {
  /** Chỉ lắng nghe 1 lần */
  once?: boolean;

  /** EventEmitter cụ thể (mặc định global) */
  context?: EventContext;
}
