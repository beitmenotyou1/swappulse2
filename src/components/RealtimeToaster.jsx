import React from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useRealtimeEvent } from '@/hooks/useRealtimeEvent';

// Renders nothing - surfaces §9 real-time events as toasts.
export default function RealtimeToaster() {
  const { toast } = useToast();

  useRealtimeEvent('trade.match', ({ listing }) => {
    toast({
      title: 'Wishlist match!',
      description: `${listing.author_name || 'A collector'} wants a card on your wishlist.`,
    });
  });

  useRealtimeEvent('market.price_alert', () => {
    toast({
      title: 'Price drop alert',
      description: 'A wishlisted card just hit your max price.',
    });
  });

  useRealtimeEvent('trade.status_update', (listing) => {
    toast({
      title: 'Trade updated',
      description: `A listing moved to ${listing.status}.`,
    });
  });

  useRealtimeEvent('trade.message', (msg) => {
    toast({
      title: 'New trade message',
      description: msg.body ? msg.body.slice(0, 80) : 'You have a new negotiation message.',
    });
  });

  return null;
}