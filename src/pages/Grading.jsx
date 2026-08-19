import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Award, Truck, CheckCircle2, Clock, Ban } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { formatPrice } from '@/lib/format';
import { cardImageUrl } from '@/lib/tcgdex';
import GradingForm from '@/components/grading/GradingForm';
import GuideFooterLink from '@/components/help/GuideFooterLink';
import { useT } from '@/lib/i18n/I18nProvider';

const SERVICES = { psa: 'PSA', bgs: 'BGS', cgc: 'CGC', ace: 'ACE' };
const STATUS_TKEYS = {
  submitted: 'grading.status.submitted',
  in_progress: 'grading.status.in_progress',
  graded: 'grading.status.graded',
  returned: 'grading.status.returned',
  rejected: 'grading.status.rejected',
};
const STATUS_META = {
  submitted: { icon: Truck, color: 'text-primary' },
  in_progress: { icon: Clock, color: 'text-warning' },
  graded: { icon: Award, color: 'text-accent' },
  returned: { icon: CheckCircle2, color: 'text-success' },
  rejected: { icon: Ban, color: 'text-destructive' },
};
const STATUS_ORDER = ['submitted', 'in_progress', 'graded', 'returned'];

// §4 Grading submission tracker - monitor PSA/BGS/CGC/ACE submissions,
// advance status, record the received grade.
export default function Grading() {
  const t = useT();
  const [items, setItems] = useState([]);
  const [collection, setCollection] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [subs, cols] = await Promise.all([
        base44.entities.GradingSubmission.list('-submitted_at', 200),
        base44.entities.CollectionEntry.list('-updated_date', 500),
      ]);
      setItems(subs);
      setCollection(cols);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const advance = async (sub) => {
    const idx = STATUS_ORDER.indexOf(sub.status);
    const next = STATUS_ORDER[Math.min(idx + 1, STATUS_ORDER.length - 1)];
    const patch = { status: next };
    if (next === 'returned') patch.received_at = new Date().toISOString();
    await base44.entities.GradingSubmission.update(sub.id, patch);
    setItems((prev) => prev.map((s) => (s.id === sub.id ? { ...s, ...patch } : s)));
  };

  const setGrade = async (sub, grade) => {
    await base44.entities.GradingSubmission.update(sub.id, { received_grade: grade, status: 'graded' });
    setItems((prev) => prev.map((s) => (s.id === sub.id ? { ...s, received_grade: grade, status: 'graded' } : s)));
  };

  return (
    <div>
      <PageHeader title={t('page.grading.title')} subtitle={t('page.grading.subtitle')}>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New
        </button>
      </PageHeader>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center">
            <Award className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-bold">No grading submissions yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Track cards you've sent to PSA, BGS, CGC or ACE - status, tracking and grades.</p>
            <button onClick={() => setShowForm(true)} className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white">Add submission</button>
          </div>
        ) : (
          items.map((sub) => {
            const st = STATUS[sub.status] || STATUS.submitted;
            const Icon = st.icon;
            const reachedIdx = STATUS_ORDER.indexOf(sub.status);
            return (
              <div key={sub.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  {cardImageUrl(sub.card_image) ? (
                    <img src={cardImageUrl(sub.card_image)} alt={sub.card_name} className="h-16 w-11 rounded-lg object-cover" />
                  ) : (
                    <div className="grid h-16 w-11 place-items-center rounded-lg bg-secondary"><Award className="h-5 w-5 text-muted-foreground" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{sub.card_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {SERVICES[sub.service]} · {sub.tracking_number ? `#${sub.tracking_number}` : 'no tracking'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold ${st.color}`}>
                      <Icon className="h-3 w-3" /> {st.label}
                    </span>
                    {sub.received_grade && <p className="mt-1 text-sm font-extrabold text-accent">{sub.received_grade}</p>}
                  </div>
                </div>

                {sub.status !== 'rejected' && (
                  <>
                    <div className="mt-3 flex items-center gap-1">
                      {STATUS_ORDER.map((s, i) => (
                        <div key={s} className="flex flex-1 items-center">
                          <div className={`h-1.5 flex-1 rounded-full ${reachedIdx >= i ? 'bg-primary' : 'bg-secondary'}`} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                      {STATUS_ORDER.map((s) => <span key={s}>{STATUS[s].label}</span>)}
                    </div>
                  </>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  {sub.declared_value != null && (
                    <span className="text-muted-foreground">Declared: <span className="font-semibold text-foreground">{formatPrice(sub.declared_value)}</span></span>
                  )}
                  {sub.expected_return && (
                    <span className="text-muted-foreground">Expected: <span className="font-semibold text-foreground">{sub.expected_return}</span></span>
                  )}
                  {sub.submitted_at && (
                    <span className="text-muted-foreground">Sent: <span className="font-semibold text-foreground">{new Date(sub.submitted_at).toLocaleDateString('en-GB')}</span></span>
                  )}
                </div>

                {sub.status !== 'returned' && sub.status !== 'rejected' && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button onClick={() => advance(sub)} className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold hover:bg-border-strong">
                      Advance status
                    </button>
                    {(sub.status === 'in_progress' || sub.status === 'graded') && (
                      <input
                        placeholder="Grade e.g. PSA 10"
                        defaultValue={sub.received_grade || ''}
                        onBlur={(e) => { if (e.target.value && e.target.value !== sub.received_grade) setGrade(sub, e.target.value); }}
                        className="rounded-full border border-border bg-background px-3 py-1.5 text-xs"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {showForm && (
        <GradingForm
          collection={collection}
          onClose={() => setShowForm(false)}
          onSaved={(s) => { setItems((prev) => [s, ...prev]); setShowForm(false); }}
        />
      )}
      <GuideFooterLink slug="grading" />
    </div>
  );
}