/**
 * Sync Utilities
 *
 * Shared helper functions used by all sync services:
 * - Progress tracking (SyncStats)
 * - Batch processing with concurrency
 * - Error-safe execution
 * - Array chunking
 * - Delay helper
 *
 * @author SwapPulse
 * @version 1.0.0
 */

import { createLogger } from './logger.ts';

const logger = createLogger('sync-utils');

// ============================================================
// Sync Stats Collector
// ============================================================

/**
 * Collects statistics during a sync run.
 * Tracks processed items, errors, and timing.
 */
export class SyncStats {
  private startTime: number;
  private itemsProcessed = 0;
  private itemsSucceeded = 0;
  private itemsFailed = 0;
  private errors: Array<{ item: string; error: string; timestamp: string }> = [];

  constructor() {
    this.startTime = Date.now();
  }

  incrementProcessed(count: number = 1): void {
    this.itemsProcessed += count;
  }

  incrementSucceeded(count: number = 1): void {
    this.itemsSucceeded += count;
  }

  incrementFailed(count: number = 1): void {
    this.itemsFailed += count;
  }

  addError(item: string, error: string): void {
    this.errors.push({
      item,
      error,
      timestamp: new Date().toISOString(),
    });

    // Keep only the last 100 errors to prevent memory bloat
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100);
    }
  }

  getDurationSeconds(): number {
    return Math.round((Date.now() - this.startTime) / 1000);
  }

  getProcessingRate(): number {
    const durationSeconds = this.getDurationSeconds();
    if (durationSeconds === 0) return 0;
    return Math.round(this.itemsProcessed / durationSeconds);
  }

  toJSON(): Record<string, any> {
    return {
      itemsProcessed: this.itemsProcessed,
      itemsSucceeded: this.itemsSucceeded,
      itemsFailed: this.itemsFailed,
      durationSeconds: this.getDurationSeconds(),
      itemsPerSecond: this.getProcessingRate(),
      errors: this.errors,
    };
  }
}

// ============================================================
// Batch Processor
// ============================================================

/**
 * Processes items in batches with optional concurrency control.
 *
 * @param items Array of items to process
 * @param batchSize Number of items per batch
 * @param processor Function to call for each batch
 * @param onProgress Optional callback called after each batch
 */
export async function processBatch<T>(
  items: T[],
  batchSize: number,
  processor: (batch: T[], batchIndex: number) => Promise<void>,
  onProgress?: (processed: number, total: number) => void,
): Promise<void> {
  const total = items.length;
  let processed = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);

    await processor(batch, batchIndex);

    processed += batch.length;
    if (onProgress) {
      onProgress(processed, total);
    }
  }
}

// ============================================================
// Safe Execute
// ============================================================

/**
 * Wraps an async function in a try-catch that logs errors
 * instead of throwing. Returns a default value on failure.
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  defaultValue: T,
  context?: Record<string, any>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logger.warn('Safe execution failed', {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
    return defaultValue;
  }
}

// ============================================================
// Delay
// ============================================================

/**
 * Pauses execution for a given number of milliseconds.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// Chunk Array
// ============================================================

/**
 * Splits an array into chunks of a specified size.
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}