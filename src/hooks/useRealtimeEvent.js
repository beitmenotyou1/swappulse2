import { useEffect, useRef } from 'react';
import { rt } from '@/lib/realtime';

// Subscribe a component to a real-time event type. Handler stays stable across
// re-renders via a ref; subscription tears down on unmount or event-type change.
export function useRealtimeEvent(eventType, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => rt.on(eventType, (payload) => ref.current(payload)), [eventType]);
}