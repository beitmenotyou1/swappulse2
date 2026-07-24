// §2.5 getBinder — resolves a binder's slots to card details from the owner's
// collection. Simulated XRPC procedure (org.swappulse.social.getBinder).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const binderId = body.binderId;
    if (!binderId) return Response.json({ error: 'binderId required' }, { status: 400 });

    const binder = await svc.entities.Binder.get(binderId);
    if (!binder) return Response.json({ error: 'Binder not found' }, { status: 404 });

    const isOwner = binder.created_by_id === user.id || (!!binder.did && binder.did === user.did);
    if (binder.visibility === 'private' && !isOwner) {
      return Response.json({ error: 'Not available' }, { status: 403 });
    }

    // Resolve the owner's collection entries so slots can render card art.
    const ownerFilter = binder.did ? { did: binder.did } : { created_by_id: binder.created_by_id };
    const entries = await svc.entities.CollectionEntry.filter(ownerFilter, '-updated_date', 500);
    const map = new Map(entries.map((e) => [e.id, e]));

    const pages = (binder.pages || []).map((pg) => ({
      page_number: pg.page_number,
      slots: (pg.slots || []).map((s) => {
        const entry = s.collection_entry_uri ? map.get(s.collection_entry_uri) : null;
        return {
          slot_index: s.slot_index,
          custom_caption: s.custom_caption,
          card: entry
            ? {
                card_id: entry.card_id,
                card_name: entry.card_name,
                card_image: entry.card_image,
                set_name: entry.set_name,
                rarity: entry.rarity,
                condition: entry.condition,
                variant: entry.variant,
              }
            : null,
        };
      }),
    }));

    return Response.json({
      binder: {
        id: binder.id,
        title: binder.title,
        description: binder.description,
        cover_image_uri: binder.cover_image_uri,
        theme: binder.theme,
        visibility: binder.visibility,
        like_count: binder.like_count || 0,
        view_count: binder.view_count || 0,
      },
      author: {
        did: binder.did,
        name: binder.author_name,
        handle: binder.author_handle,
        avatar: binder.author_avatar,
      },
      pages,
      isOwner,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});