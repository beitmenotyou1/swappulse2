/**
 * API Response Helpers
 *
 * Utility functions for building consistent API responses,
 * handling language negotiation, and parsing request parameters.
 *
 * Adapted for Base44 — no Redis cache or PostgreSQL repository;
 * uses the TcgdexCard cache entity and TCGDex API directly.
 *
 * @author SwapPulse
 * @version 1.0.0
 */

import { validateLanguage } from './tcgdexClient.ts';
import type {
  ApiResponse,
  ApiErrorResponse,
  ResponseMeta,
  SingleResponseMeta,
} from './apiTypes.ts';

// ============================================================
// Language Negotiation
// ============================================================

/**
 * Extracts and validates the language parameter from a request.
 * Falls back to 'en' if not provided or invalid.
 */
export function negotiateLanguage(lang?: string | null): string {
  if (!lang) return 'en';
  try {
    return validateLanguage(lang);
  } catch {
    return 'en';
  }
}

// ============================================================
// Response Builders
// ============================================================

export function successResponse<T>(
  data: T,
  meta: ResponseMeta | SingleResponseMeta,
): ApiResponse<T> {
  return { success: true, data, meta };
}

export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, any>,
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && Object.keys(details).length > 0 ? { details } : {}),
    },
  };
}

// ============================================================
// Parameter Parsing
// ============================================================

/**
 * Parses a positive integer from a string with a default and max.
 */
export function parseIntParam(
  value: string | number | undefined | null,
  defaultValue: number,
  max: number = 100,
): number {
  if (!value) return defaultValue;
  const parsed = parseInt(String(value), 10);
  if (isNaN(parsed) || parsed < 1) return defaultValue;
  return Math.min(parsed, max);
}

/**
 * Extracts parameters from both query string and JSON body.
 * Body params override query params when both are present.
 * Handles GET requests (query only) and POST requests (body).
 */
export async function getParams(req: Request): Promise<Record<string, any>> {
  const params: Record<string, any> = {};

  // From query string
  try {
    const url = new URL(req.url);
    url.searchParams.forEach((value, key) => {
      params[key] = value;
    });
  } catch {
    // not a URL-based request
  }

  // From JSON body (POST/PUT) — overrides query params
  try {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const body = await req.json();
      if (body && typeof body === 'object') {
        Object.assign(params, body);
      }
    }
  } catch {
    // no JSON body or already consumed
  }

  return params;
}

/**
 * Generates a cache key from an object of parameters (for HTTP cache headers).
 */
export function makeCacheKey(prefix: string, params: Record<string, any>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}:${params[k]}`)
    .join('|');
  return `${prefix}:${sorted}`;
}