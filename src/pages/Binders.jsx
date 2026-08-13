import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, BookOpen } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';
import PageHeader from '@/components/PageHeader';
import BinderCard from '@/components/binder/BinderCard';

export default function Binders() {
  const [tab, setTab] = useState('mine');
  const [binders, setBinders] = useState([]);
  const [myDid, setMyDid] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Parallelize DID resolution and binder fetch (independent).
    (async () => {
      try {
        const [{ did }, all] = await Promise.all([
          ensureUserDid(),
          base44.entities.Binder.list('-created_date', 200),
        ]);
        setMyDid(did);
        setBinders(all);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const mine = binders.filter((b) => b.did === myDid);
  const discover = binders.filter((b) => b.visibility === 'public' && b.did !== myDid);
  const shown = tab === 'mine' ? mine : discover;

  return (
    <div>
      <PageHeader title="Digital Binders" subtitle="Curated showcases of prized cards">
        <Link
          to="/binders/new"
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New
        </Link>
      </PageHeader>

      <div className="flex gap-2 px-4 pb-2">
        {[
          ['mine', 'My Binders'],
          ['discover', 'Discover'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              tab === id ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : shown.length === 0 ? (
          <div className="py-16 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-bold">
              {tab === 'mine' ? 'No binders yet' : 'Nothing to discover yet'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tab === 'mine'
                ? 'Create your first digital binder.'
                : 'Public binders from the community will appear here.'}
            </p>
            {tab === 'mine' && (
              <Link
                to="/binders/new"
                className="mt-4 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white"
              >
                Create Binder
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((b) => (
              <BinderCard key={b.id} binder={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}