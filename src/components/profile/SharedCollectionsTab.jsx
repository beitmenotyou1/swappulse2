import React, { useEffect, useState } from 'react';
import { Loader2, BookMarked } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import BinderCard from '@/components/binder/BinderCard';

export default function SharedCollectionsTab({ did }) {
  const [binders, setBinders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const all = await base44.entities.Binder.filter({ did, visibility: 'public' }, '-created_date', 50);
        if (active) setBinders(all || []);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [did]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (error) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Couldn't load collections right now.</p>;
  }
  if (binders.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        <BookMarked className="mx-auto mb-2 h-8 w-8 opacity-40" />
        <p>No public collections yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {binders.map((b) => <BinderCard key={b.id} binder={b} />)}
    </div>
  );
}