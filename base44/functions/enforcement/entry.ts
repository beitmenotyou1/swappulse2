// enforcement — account enforcement operations for moderators and admins.
//
// Ops (all require auth):
//   suspend          — admin only. Suspend a user (reversible).
//   lift_suspension  — admin only. Reinstate a suspended user.
//   shadow_ban       — mod+admin. Silently hide a user's content.
//   lift_shadow_ban  — mod+admin. Restore a shadow-banned user's visibility.
//   force_delete     — admin only. Permanently delete an account for cause.
//   blocklist_add    — mod+admin. Add an email/handle to the re-registration blocklist.
//   blocklist_remove — mod+admin. Remove a blocklist entry.
//   list             — mod+admin. List all active enforcement states + blocklist + logs.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';

const ENTITY_CLEANUP = [
  { name: 'CollectionEntry' }, { name: 'Binder' }, { name: 'Post' },
  { name: 'Repost' }, { name: 'Reaction' },
  { name: 'Follow', extra: ['subject_did'] },
  { name: 'Friendship', extra: ['subject_did'] },
  { name: 'FollowPreference' }, { name: 'TradeListing' },
  { name: 'TradeMessage' }, { name: 'TradeWatch' }, { name: 'TradeTemplate' },
  { name: 'TradeChain' }, { name: 'TradingFeedback' },
  { name: 'Vouch', extra: ['voucher_did', 'subject_did'] },
  { name: 'Reputation' }, { name: 'Circle' }, { name: 'CircleExit' },
  { name: 'Meetup' }, { name: 'MeetupRsvp' }, { name: 'VoiceSpace' },
  { name: 'SpaceParticipant' }, { name: 'Journal' }, { name: 'Story' },
  { name: 'StoryView' }, { name: 'PodcastEpisode' }, { name: 'PodcastPlay' },
  { name: 'CrossPostConfig' }, { name: 'SavedSearch' },
  { name: 'SentimentVote' }, { name: 'SentimentPoll' }, { name: 'Nomination' },
  { name: 'CardReview' }, { name: 'GradingSubmission' },
  { name: 'ScannerCorrection' }, { name: 'Achievement' },
  { name: 'AchievementProofSnapshot' }, { name: 'ChallengeEntry' },
  { name: 'Feedback' }, { name: 'SettingsConfig' },
  { name: 'Notification', extra: ['actor_did'] },
  { name: 'NotificationState' }, { name: 'NotificationLog' },
  { name: 'PushToken' }, { name: 'Presence' }, { name: 'ExternalActivity' },
  { name: 'RecommendationPreference' }, { name: 'RecommendationCache' },
  { name: 'AgentFeedback' }, { name: 'InviteCode' }, { name: 'Activation' },
  { name: 'Wishlist' }, { name: 'MarketListing' }, { name: 'Document' },
  { name: 'AccountStatus' },
];

const TRADE_LINKED_ENTITIES = ['TradeMessage', 'TradeWatch'];
const ENFORCEMENT_ACTIONS = ['suspend', 'lift_suspension', 'shadow_ban', 'lift_shadow_ban', 'force_delete', 'blocklist_add', 'blocklist_remove'];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const op = body.op;

    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = caller.role === 'admin';
    const isStaff = caller.role === 'moderator' || isAdmin;
    const svc = base44.asServiceRole;

    if (['suspend', 'lift_suspension', 'force_delete'].includes(op) && !isAdmin)
      return Response.json({ error: 'Admin only' }, { status: 403 });
    if (['shadow_ban', 'lift_shadow_ban', 'blocklist_add', 'blocklist_remove', 'list', 'search_users'].includes(op) && !isStaff)
      return Response.json({ error: 'Staff only' }, { status: 403 });

    switch (op) {
      case 'suspend': {
        const targetUserId = body.user_id;
        const reason = String(body.reason || '').trim();
        const suspendedUntil = body.suspended_until || null;
        if (!targetUserId) return Response.json({ error: 'user_id required' }, { status: 400 });

        const target = await svc.entities.User.get(targetUserId).catch(() => null);
        if (!target) return Response.json({ error: 'User not found' }, { status: 404 });

        await upsertAccountStatus(svc, target, 'suspended', {
          suspension_reason: reason, suspended_until: suspendedUntil,
          suspended_by: caller.id, suspended_by_name: caller.full_name || caller.email,
          suspended_at: new Date().toISOString(),
        });

        if (target.email) {
          try {
            await sendBrandedEmail({
              to: target.email,
              subject: 'Your SwapPulse account has been suspended',
              text: `Your SwapPulse account has been suspended.\n\nReason: ${reason || 'Violation of community guidelines'}\n${suspendedUntil ? `Your suspension will be lifted on ${new Date(suspendedUntil).toLocaleDateString()}.` : 'This suspension is indefinite. Please contact support if you believe this is an error.'}\n\n— The SwapPulse Team`,
              html: `<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0F1117;color:#e2e8f0;"><h1 style="color:#ef4444;font-size:24px;">Account Suspended</h1><p style="line-height:1.6;">Your SwapPulse account has been suspended.</p><p style="line-height:1.6;"><strong>Reason:</strong> ${reason || 'Violation of community guidelines'}</p>${suspendedUntil ? `<p style="line-height:1.6;">Your suspension will be lifted on <strong>${new Date(suspendedUntil).toLocaleDateString()}</strong>.</p>` : '<p style="line-height:1.6;">This suspension is indefinite. Please contact support if you believe this is an error.</p>'}<p style="color:#64748b;font-size:12px;margin-top:24px;">— The SwapPulse Team</p></div>`,
            });
          } catch (e) { console.error('enforcement: suspension email failed', e?.message || e); }
        }

        await logAction(svc, caller, 'suspend', targetUserId, target.username || target.email, reason);
        return Response.json({ ok: true });
      }

      case 'lift_suspension': {
        const targetUserId = body.user_id;
        if (!targetUserId) return Response.json({ error: 'user_id required' }, { status: 400 });

        const existing = await svc.entities.AccountStatus.filter({ user_id: targetUserId }, '-updated_date', 1);
        if (existing.length === 0) return Response.json({ error: 'No enforcement record found' }, { status: 404 });

        await svc.entities.AccountStatus.update(existing[0].id, {
          status: 'active', reinstated_at: new Date().toISOString(),
          reinstated_by: caller.id, suspended_until: null, suspension_reason: '',
        });
        await logAction(svc, caller, 'lift_suspension', targetUserId, existing[0].user_handle || '', 'Suspension lifted');
        return Response.json({ ok: true });
      }

      case 'shadow_ban': {
        const targetUserId = body.user_id;
        const reason = String(body.reason || '').trim();
        if (!targetUserId) return Response.json({ error: 'user_id required' }, { status: 400 });

        const target = await svc.entities.User.get(targetUserId).catch(() => null);
        if (!target) return Response.json({ error: 'User not found' }, { status: 404 });

        await upsertAccountStatus(svc, target, 'shadow_banned', {
          shadow_ban_reason: reason, shadow_banned_by: caller.id,
          shadow_banned_by_name: caller.full_name || caller.email,
          shadow_banned_at: new Date().toISOString(),
        });
        await logAction(svc, caller, 'shadow_ban', targetUserId, target.username || target.email, reason);
        return Response.json({ ok: true });
      }

      case 'lift_shadow_ban': {
        const targetUserId = body.user_id;
        if (!targetUserId) return Response.json({ error: 'user_id required' }, { status: 400 });

        const existing = await svc.entities.AccountStatus.filter({ user_id: targetUserId }, '-updated_date', 1);
        if (existing.length === 0) return Response.json({ error: 'No enforcement record found' }, { status: 404 });

        await svc.entities.AccountStatus.update(existing[0].id, {
          status: 'active', reinstated_at: new Date().toISOString(),
          reinstated_by: caller.id, shadow_ban_reason: '',
        });
        await logAction(svc, caller, 'lift_shadow_ban', targetUserId, existing[0].user_handle || '', 'Shadow ban lifted');
        return Response.json({ ok: true });
      }

      case 'force_delete': {
        const targetUserId = body.user_id;
        const blocklistReason = body.reason || 'other';
        if (!targetUserId) return Response.json({ error: 'user_id required' }, { status: 400 });

        const target = await svc.entities.User.get(targetUserId).catch(() => null);
        if (!target) return Response.json({ error: 'User not found' }, { status: 404 });

        const targetDid = target.did || '';
        const targetEmail = (target.email || '').toLowerCase();
        const targetHandle = (target.username || '').toLowerCase();
        const results: Record<string, string> = {};

        // Phase 1: Find trade IDs
        let tradeIds: string[] = [];
        try {
          const trades = await svc.entities.TradeListing.filter(
            { $or: [{ created_by_id: targetUserId }, { did: targetDid }] }, '-created_date', 1000);
          tradeIds = (trades || []).map((t: any) => t.id);
        } catch (e) { console.error('enforcement: trade lookup failed', e?.message); }

        // Phase 2: Delete all entities by created_by_id / did
        for (const { name, extra } of ENTITY_CLEANUP) {
          try {
            const entityApi = svc.entities[name];
            if (!entityApi?.deleteMany) { results[name] = 'skipped'; continue; }
            const orParts: any[] = [{ created_by_id: targetUserId }, { did: targetDid }];
            if (extra) for (const field of extra) orParts.push({ [field]: targetDid });
            await entityApi.deleteMany({ $or: orParts });
            results[name] = 'ok';
          } catch (e) { results[name] = `error: ${e?.message}`; }
        }

        // Phase 2b: Anonymise ContentReport and TradeDispute (preserve for audit)
        try {
          await svc.entities.ContentReport.updateMany(
            { created_by_id: targetUserId },
            { $set: { author_handle: '[deleted]' } });
          results['ContentReport'] = 'anonymised';
        } catch (e) { results['ContentReport'] = `error: ${e?.message}`; }
        try {
          await svc.entities.TradeDispute.updateMany(
            { created_by_id: targetUserId },
            { $set: { filed_by_name: '[deleted]', filed_by_handle: '[deleted]', filed_by_avatar: '', did: '' } });
          results['TradeDispute'] = 'anonymised';
        } catch (e) { results['TradeDispute'] = `error: ${e?.message}`; }

        // Phase 3: Delete trade-linked records by trade_id
        if (tradeIds.length > 0) {
          for (const entityName of TRADE_LINKED_ENTITIES) {
            try { await svc.entities[entityName].deleteMany({ trade_id: { $in: tradeIds } }); }
            catch (e) { console.error(`enforcement: ${entityName} by trade_id`, e?.message); }
          }
        }

        // Phase 4: PDS tombstone (best-effort)
        if (targetDid) {
          try {
            await base44.functions.invoke('atproto-bridge', {
              action: 'emitLabels',
              labels: [{ src: Deno.env.get('PDS_IDENTIFIER') || '', uri: `at://${targetDid}`, val: 'tombstoned', neg: false }],
            });
            results['pds_tombstone'] = 'emitted';
          } catch (e) { results['pds_tombstone'] = `error: ${e?.message}`; }
        }

        // Phase 5: Release HandleClaim
        try { await svc.entities.HandleClaim.deleteMany({ did: targetDid }); results['HandleClaim'] = 'ok'; }
        catch (e) { results['HandleClaim'] = `error: ${e?.message}`; }

        // Phase 6: Add to blocklist
        try {
          await svc.entities.BlockedRegistration.create({
            email: targetEmail, handle: targetHandle, reason: blocklistReason,
            source_action: 'platform_deletion', blocked_by: caller.id,
            blocked_by_name: caller.full_name || caller.email,
            blocked_at: new Date().toISOString(),
          });
          results['BlockedRegistration'] = 'ok';
        } catch (e) { results['BlockedRegistration'] = `error: ${e?.message}`; }

        // Phase 7: Delete the User record
        try { await svc.entities.User.delete(targetUserId); results['User'] = 'deleted'; }
        catch (e) { results['User'] = `error: ${e?.message}`; }

        await logAction(svc, caller, 'force_delete', targetUserId, targetHandle || targetEmail, `Force deleted: ${blocklistReason}`);
        return Response.json({ ok: true, results });
      }

      case 'blocklist_add': {
        const email = (body.email || '').trim().toLowerCase();
        const handle = (body.handle || '').trim().toLowerCase();
        const reason = body.reason || 'other';
        const sourceAction = body.source_action || 'manual';
        const notes = body.notes || '';
        if (!email && !handle) return Response.json({ error: 'email or handle required' }, { status: 400 });

        await svc.entities.BlockedRegistration.create({
          email, handle, reason, source_action: sourceAction,
          blocked_by: caller.id, blocked_by_name: caller.full_name || caller.email,
          blocked_at: new Date().toISOString(), notes,
        });
        await logAction(svc, caller, 'blocklist_add', '', handle || email, `Blocked: ${reason}`);
        return Response.json({ ok: true });
      }

      case 'blocklist_remove': {
        const id = body.id;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        await svc.entities.BlockedRegistration.delete(id);
        await logAction(svc, caller, 'blocklist_remove', '', id, 'Removed from blocklist');
        return Response.json({ ok: true });
      }

      case 'search_users': {
        const query = String(body.query || '').trim().toLowerCase();
        if (!query || query.length < 2) return Response.json({ users: [] });
        try {
          const all = await svc.entities.User.list('-created_date', 2000);
          const users = (all || [])
            .filter((u: any) =>
              (u.email && u.email.toLowerCase().includes(query)) ||
              (u.username && u.username.toLowerCase().includes(query)))
            .slice(0, 20)
            .map((u: any) => ({ id: u.id, email: u.email, username: u.username, did: u.did, full_name: u.full_name }));
          return Response.json({ users });
        } catch (e) {
          console.error('enforcement: search_users failed', e?.message);
          return Response.json({ users: [] });
        }
      }

      case 'list': {
        const [suspensions, shadowBans, blocklist, logs] = await Promise.all([
          svc.entities.AccountStatus.filter({ status: 'suspended' }, '-suspended_at', 200).catch(() => []),
          svc.entities.AccountStatus.filter({ status: 'shadow_banned' }, '-shadow_banned_at', 200).catch(() => []),
          svc.entities.BlockedRegistration.list('-blocked_at', 200).catch(() => []),
          svc.entities.ModerationLog.filter({ action: { $in: ENFORCEMENT_ACTIONS } }, '-created_date', 50).catch(() => []),
        ]);
        const now = new Date();
        const suspensionsWithExpiry = suspensions.map((s: any) => ({
          ...s, expired: s.suspended_until ? new Date(s.suspended_until) < now : false,
        }));
        return Response.json({ suspensions: suspensionsWithExpiry, shadow_bans: shadowBans, blocklist, logs });
      }

      default:
        return Response.json({ error: 'Unknown op' }, { status: 400 });
    }
  } catch (error) {
    console.error('enforcement error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}

async function upsertAccountStatus(svc: any, user: any, status: string, fields: Record<string, any>) {
  const existing = await svc.entities.AccountStatus.filter({ user_id: user.id }, '-updated_date', 1);
  if (existing.length > 0) {
    await svc.entities.AccountStatus.update(existing[0].id, { status, ...fields });
  } else {
    await svc.entities.AccountStatus.create({
      user_id: user.id, user_email: user.email || '', user_handle: user.username || '',
      user_did: user.did || '', status, ...fields,
    });
  }
}

async function logAction(svc: any, caller: any, action: string, targetUserId: string, targetAuthor: string, notes: string) {
  try {
    await svc.entities.ModerationLog.create({
      moderator_id: caller.id, moderator_name: caller.full_name || caller.email,
      action, target_user_id: targetUserId, target_author: targetAuthor,
      notes, auto_generated: false,
    });
  } catch (e) { console.error('enforcement: ModerationLog failed', e?.message); }
}