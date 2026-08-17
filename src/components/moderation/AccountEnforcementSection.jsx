import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Ban, EyeOff, ShieldOff, History, Trash2, UserCheck, Eye, Plus, X } from 'lucide-react';
import Avatar from '@/components/Avatar';
import SuspendDialog from './SuspendDialog';
import ShadowBanDialog from './ShadowBanDialog';
import ForceDeleteDialog from './ForceDeleteDialog';

export default function AccountEnforcementSection() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [subTab, setSubTab] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [data, setData] = useState({ suspensions: [], shadow_bans: [], blocklist: [], logs: [] });
  const [loading, setLoading] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [shadowBanTarget, setShadowBanTarget] = useState(null);
  const [forceDeleteTarget, setForceDeleteTarget] = useState(null);
  const [blocklistForm, setBlocklistForm] = useState({ email: '', handle: '', reason: 'spam', notes: '' });
  const [actionLoading, setActionLoading] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('enforcement', { op: 'list' });
      setData(res.data || { suspensions: [], shadow_bans: [], blocklist: [], logs: [] });
    } catch (e) { console.error('enforcement list failed', e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await base44.functions.invoke('enforcement', { op: 'search_users', query: searchQuery });
      setSearchResults(res.data?.users || []);
    } catch (e) { console.error('user search failed', e); setSearchResults([]); }
    setSearching(false);
  };

  const handleLiftSuspension = async (userId) => {
    setActionLoading(userId);
    try { await base44.functions.invoke('enforcement', { op: 'lift_suspension', user_id: userId }); fetchAll(); }
    catch (e) { console.error('lift suspension failed', e); }
    setActionLoading('');
  };

  const handleLiftShadowBan = async (userId) => {
    setActionLoading(userId);
    try { await base44.functions.invoke('enforcement', { op: 'lift_shadow_ban', user_id: userId }); fetchAll(); }
    catch (e) { console.error('lift shadow ban failed', e); }
    setActionLoading('');
  };

  const handleRemoveBlocklist = async (id) => {
    setActionLoading(id);
    try { await base44.functions.invoke('enforcement', { op: 'blocklist_remove', id }); fetchAll(); }
    catch (e) { console.error('blocklist remove failed', e); }
    setActionLoading('');
  };

  const handleAddBlocklist = async () => {
    const { email, handle, reason, notes } = blocklistForm;
    if (!email && !handle) return;
    setActionLoading('blocklist_add');
    try {
      await base44.functions.invoke('enforcement', { op: 'blocklist_add', email, handle, reason, source_action: 'manual', notes });
      setBlocklistForm({ email: '', handle: '', reason: 'spam', notes: '' });
      fetchAll();
    } catch (e) { console.error('blocklist add failed', e); }
    setActionLoading('');
  };

  const TABS = [
    ['search', 'Find User', Search],
    ['suspensions', 'Suspensions', Ban],
    ['shadow_bans', 'Shadow Bans', EyeOff],
    ['blocklist', 'Blocklist', ShieldOff],
    ['history', 'History', History],
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setSubTab(key)}
            className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition-colors ${subTab === key ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:bg-secondary'}`}>
            <Icon className="h-4 w-4" /> {label}
            {key === 'suspensions' && data.suspensions.length > 0 && <span className="rounded-full bg-warning/20 px-1.5 text-xs text-warning">{data.suspensions.length}</span>}
            {key === 'shadow_bans' && data.shadow_bans.length > 0 && <span className="rounded-full bg-secondary px-1.5 text-xs">{data.shadow_bans.length}</span>}
            {key === 'blocklist' && data.blocklist.length > 0 && <span className="rounded-full bg-destructive/20 px-1.5 text-xs text-destructive">{data.blocklist.length}</span>}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}

      {/* Search tab */}
      {subTab === 'search' && !loading && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Search by username or email…" className="pl-9" autoFocus />
            </div>
            <Button onClick={handleSearch} disabled={searching}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}</Button>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <Avatar name={u.username || u.email} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{u.username || u.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}{u.did ? ` · ${u.did.slice(0, 20)}…` : ''}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setSuspendTarget(u)} disabled={!isAdmin} title={isAdmin ? 'Suspend' : 'Admin only'}><Ban className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="outline" onClick={() => setShadowBanTarget(u)}><EyeOff className="h-3.5 w-3.5" /></Button>
                    {isAdmin && <Button size="sm" variant="outline" className="text-destructive" onClick={() => setForceDeleteTarget(u)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {searchResults.length === 0 && searchQuery && !searching && <p className="text-center text-sm text-muted-foreground py-8">No users found.</p>}
        </div>
      )}

      {/* Suspensions tab */}
      {subTab === 'suspensions' && !loading && (
        <div className="space-y-2">
          {data.suspensions.length === 0 ? <p className="text-center text-sm text-muted-foreground py-8">No active suspensions.</p> : data.suspensions.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="rounded-full bg-warning/10 p-2"><Ban className="h-4 w-4 text-warning" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{s.user_handle || s.user_email || s.user_id}</p>
                <p className="text-xs text-muted-foreground">
                  {s.suspended_until ? (s.expired ? 'Expired' : `Until ${new Date(s.suspended_until).toLocaleDateString()}`) : 'Indefinite'}
                  {s.suspension_reason ? ` · ${s.suspension_reason}` : ''}
                </p>
              </div>
              {isAdmin && <Button size="sm" variant="outline" onClick={() => handleLiftSuspension(s.user_id)} disabled={actionLoading === s.user_id}>
                {actionLoading === s.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><UserCheck className="h-3.5 w-3.5" /> Reinstate</>}
              </Button>}
            </div>
          ))}
        </div>
      )}

      {/* Shadow Bans tab */}
      {subTab === 'shadow_bans' && !loading && (
        <div className="space-y-2">
          {data.shadow_bans.length === 0 ? <p className="text-center text-sm text-muted-foreground py-8">No active shadow bans.</p> : data.shadow_bans.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="rounded-full bg-secondary p-2"><EyeOff className="h-4 w-4 text-muted-foreground" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{s.user_handle || s.user_email || s.user_id}</p>
                {s.shadow_ban_reason && <p className="text-xs text-muted-foreground truncate">{s.shadow_ban_reason}</p>}
              </div>
              <Button size="sm" variant="outline" onClick={() => handleLiftShadowBan(s.user_id)} disabled={actionLoading === s.user_id}>
                {actionLoading === s.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Eye className="h-3.5 w-3.5" /> Lift</>}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Blocklist tab */}
      {subTab === 'blocklist' && !loading && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-1.5"><Plus className="h-4 w-4" /> Add to blocklist</p>
            <div className="grid grid-cols-2 gap-2">
              <Input value={blocklistForm.email} onChange={(e) => setBlocklistForm({ ...blocklistForm, email: e.target.value })} placeholder="Email" />
              <Input value={blocklistForm.handle} onChange={(e) => setBlocklistForm({ ...blocklistForm, handle: e.target.value })} placeholder="Handle" />
            </div>
            <div className="flex gap-2">
              <select value={blocklistForm.reason} onChange={(e) => setBlocklistForm({ ...blocklistForm, reason: e.target.value })} className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="scam">Scam</option><option value="spam">Spam</option><option value="harassment">Harassment</option>
                <option value="ban_evasion">Ban evasion</option><option value="other">Other</option>
              </select>
              <Button onClick={handleAddBlocklist} disabled={actionLoading === 'blocklist_add' || (!blocklistForm.email && !blocklistForm.handle)}>
                {actionLoading === 'blocklist_add' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {data.blocklist.length === 0 ? <p className="text-center text-sm text-muted-foreground py-8">No blocklist entries.</p> : data.blocklist.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="rounded-full bg-destructive/10 p-2"><ShieldOff className="h-4 w-4 text-destructive" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{b.email || b.handle}</p>
                  <p className="text-xs text-muted-foreground">{b.reason} · {b.source_action} · {new Date(b.blocked_at).toLocaleDateString()}</p>
                </div>
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleRemoveBlocklist(b.id)} disabled={actionLoading === b.id}>
                  {actionLoading === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History tab */}
      {subTab === 'history' && !loading && (
        <div className="space-y-2">
          {data.logs.length === 0 ? <p className="text-center text-sm text-muted-foreground py-8">No enforcement actions yet.</p> : data.logs.map((log) => (
            <div key={log.id} className="rounded-xl border border-border bg-card p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{log.action.replace(/_/g, ' ')}</span>
                <span className="text-xs text-muted-foreground">{new Date(log.created_date).toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {log.moderator_name || 'System'} → {log.target_author || log.target_user_id || '–'}
                {log.notes ? ` · ${log.notes}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      <SuspendDialog user={suspendTarget} open={!!suspendTarget} onClose={() => setSuspendTarget(null)} onDone={fetchAll} />
      <ShadowBanDialog user={shadowBanTarget} open={!!shadowBanTarget} onClose={() => setShadowBanTarget(null)} onDone={fetchAll} />
      <ForceDeleteDialog user={forceDeleteTarget} open={!!forceDeleteTarget} onClose={() => setForceDeleteTarget(null)} onDone={fetchAll} />
    </div>
  );
}