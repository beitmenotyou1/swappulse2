import React, { useEffect, useState } from 'react';
import { Trash2, Loader2, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

// PriceAlertsList — shows the user's active SavedSearch price alerts with
// delete capability. Used in the MarketWatch page to replace the dead "Add
// Alert" stub. Each alert shows the card name, target price, and notification
// channel.
export default function PriceAlertsList({ onCreate, refreshKey }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const items = await base44.entities.SavedSearch.list('-created_date', 50);
      setAlerts(items || []);
    } catch { setAlerts([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [refreshKey]);

  const remove = async (id, name) => {
    setDeleting(id);
    try {
      await base44.entities.SavedSearch.delete(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      toast({ title: 'Alert removed', description: name });
    } catch {
      toast({ title: 'Could not remove alert', variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  const channelLabel = (n) => ({ email: 'Email', push: 'Push', both: 'Both', none: 'Off' }[n] || 'Email');

  return (
    <div className="space-y-2">
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : alerts.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No price alerts set yet.</p>
      ) : (
        alerts.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{a.card_name || a.name}</p>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                {a.max_price != null && <span>≤ ${(a.max_price / 100).toFixed(2)}</span>}
                <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium">{channelLabel(a.notify)}</span>
                {a.last_triggered_at && <span className="text-[10px]">last fired {new Date(a.last_triggered_at).toLocaleDateString()}</span>}
              </div>
            </div>
            <button
              onClick={() => remove(a.id, a.card_name || a.name)}
              disabled={deleting === a.id}
              className="ml-2 rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              aria-label="Delete alert"
            >
              {deleting === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        ))
      )}
      <button
        onClick={onCreate}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground hover:bg-secondary"
      >
        <Plus className="h-4 w-4" /> Add Alert
      </button>
    </div>
  );
}