import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Loader2, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SettingSelect from '@/components/settings/SettingSelect';
import { useToast } from '@/components/ui/use-toast';

const TIERS = ['verified-seller', 'industry-provenance', 'trusted-shop', 'official-partner'];

export default function TrustTierSection() {
  const { toast } = useToast();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState('');
  const [tier, setTier] = useState('verified-seller');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.entities.TrustTierRule.list('-created_date', 50);
      setRules(res || []);
    } catch { setRules([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addRule = async (e) => {
    e.preventDefault();
    if (!domain.trim() || !label.trim()) return;
    setSaving(true);
    try {
      await base44.entities.TrustTierRule.create({
        domain_suffix: domain.trim().toLowerCase(),
        tier,
        label: label.trim(),
      });
      toast({ title: 'Trust tier rule added' });
      setDomain(''); setLabel('');
      load();
    } catch (err) {
      toast({ title: 'Could not add rule', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const removeRule = async (id) => {
    try {
      await base44.entities.TrustTierRule.delete(id);
      toast({ title: 'Rule removed' });
      load();
    } catch {
      toast({ title: 'Could not remove', variant: 'destructive' });
    }
  };

  const toggleActive = async (rule) => {
    try {
      await base44.entities.TrustTierRule.update(rule.id, { active: !rule.active });
      load();
    } catch { /* ignore */ }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-5 w-5 text-primary" /> Domain-Verified Trust Tiers</h2>
      <p className="mt-1 text-sm text-muted-foreground">Map verified custom-domain handles to trust tiers that boost trade-listing prominence and trust scores.</p>

      <form onSubmit={addRule} className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <Label htmlFor="tt-domain">Domain suffix</Label>
          <Input id="tt-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="psacard.com" />
        </div>
        <div>
          <Label htmlFor="tt-tier">Tier</Label>
          <SettingSelect
            value={tier}
            onChange={setTier}
            label="Tier"
            options={TIERS.map((t) => ({ value: t, label: t }))}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="tt-label">Badge label</Label>
          <Input id="tt-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="PSA Provenance" />
        </div>
        <div className="sm:col-span-3">
          <Button type="submit" disabled={saving || !domain.trim() || !label.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add rule
          </Button>
        </div>
      </form>

      <div className="mt-5 space-y-2">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : rules.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No trust tier rules yet.</p>
        ) : (
          rules.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.label}</p>
                <p className="truncate text-xs text-muted-foreground">{r.domain_suffix} · {r.tier}</p>
              </div>
              <button
                onClick={() => toggleActive(r)}
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.active ? 'bg-success/15 text-success' : 'bg-secondary text-muted-foreground'}`}
              >
                {r.active ? 'Active' : 'Inactive'}
              </button>
              <button onClick={() => removeRule(r.id)} aria-label="Remove" className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}