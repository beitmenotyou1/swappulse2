import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getSets, getSet, cardImageUrl } from '@/lib/tcgdex';

/**
 * Fetch the list of available TCGDex sets, sorted by release date (newest first).
 */
export function useAvailableSets() {
  return useQuery({
    queryKey: ['availableSets'],
    queryFn: async () => {
      const sets = await getSets();
      return sets
        .filter((s) => {
          const cc = s.cardCount;
          return cc && (typeof cc === 'number' || cc?.total || cc?.official);
        })
        .map((s) => {
          const cc = s.cardCount;
          const count = typeof cc === 'object' ? (cc.total ?? cc.official ?? 0) : cc;
          return {
            setId: s.id,
            setName: s.name,
            cardCount: count,
            releaseDate: s.releaseDate || '',
          };
        })
        .sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0));
    },
    staleTime: 300_000, // 5 minutes
  });
}

/**
 * Fetch a set's card list from TCGDex and merge with the user's CollectionEntry
 * records to produce a checklist with is_owned flags.
 */
export function useSetChecklist(setId, userId) {
  return useQuery({
    queryKey: ['setChecklist', setId, userId],
    queryFn: async () => {
      if (!setId) throw new Error('Set ID is required');

      const [setData, collection] = await Promise.all([
        getSet(setId),
        userId
          ? base44.entities.CollectionEntry.filter({ created_by_id: userId }, '-updated_date', 500)
          : base44.entities.CollectionEntry.list('-updated_date', 500),
      ]);

      // Build owned lookup sets — match by card_id (most reliable) and local_id (fallback)
      const ownedByCardId = new Set();
      const ownedByLocalId = new Set();
      for (const entry of collection) {
        if (entry.card_id) ownedByCardId.add(entry.card_id);
        if (entry.local_id) ownedByLocalId.add(entry.local_id);
      }

      const cards = (setData?.cards || []).map((c) => {
        const cardId = c.id;
        const localId = c.localId ?? c.id;
        const isOwned = ownedByCardId.has(cardId) || ownedByLocalId.has(localId);
        return {
          tcgdex_id: cardId,
          local_id: localId,
          name: c.name,
          rarity: c.rarity || 'Unknown',
          illustrator: c.illustrator || '',
          image: c.image ? cardImageUrl(c.image) : null,
          image_available: !!c.image,
          is_owned: isOwned,
        };
      });

      const ownedCount = cards.filter((c) => c.is_owned).length;
      const totalCount = cards.length;
      const completionPercentage = totalCount ? Math.round((ownedCount / totalCount) * 100) : 0;

      // Rarity breakdown
      const rarityMap = {};
      for (const c of cards) {
        if (!rarityMap[c.rarity]) rarityMap[c.rarity] = { rarity: c.rarity, total: 0, owned: 0, missing: 0 };
        rarityMap[c.rarity].total++;
        if (c.is_owned) rarityMap[c.rarity].owned++;
        else rarityMap[c.rarity].missing++;
      }

      return {
        set_id: setId,
        set_name: setData?.name || setId,
        card_count: totalCount,
        release_date: setData?.releaseDate || '',
        completion_percentage: completionPercentage,
        owned_count: ownedCount,
        missing_count: totalCount - ownedCount,
        cards,
        rarity_breakdown: Object.values(rarityMap),
      };
    },
    enabled: !!setId,
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Toggle card ownership — adds or removes a CollectionEntry with optimistic update.
 */
export function useToggleCardOwnership(setId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ card, isOwned, setName }) => {
      if (isOwned) {
        // Remove: find and delete the matching CollectionEntry
        await base44.entities.CollectionEntry.deleteMany({ card_id: card.tcgdex_id });
      } else {
        // Add: create a new CollectionEntry
        await base44.entities.CollectionEntry.create({
          card_id: card.tcgdex_id,
          card_name: card.name,
          set_id: setId,
          set_name: setName || '',
          local_id: card.local_id,
          rarity: card.rarity,
          card_image: card.image || '',
        });
      }
    },
    onMutate: async ({ card, isOwned }) => {
      await queryClient.cancelQueries({ queryKey: ['setChecklist', setId] });
      const previousData = queryClient.getQueryData(['setChecklist', setId]);

      if (previousData) {
        const updatedCards = previousData.cards.map((c) =>
          c.tcgdex_id === card.tcgdex_id ? { ...c, is_owned: !isOwned } : c
        );
        const ownedCount = updatedCards.filter((c) => c.is_owned).length;
        const completionPercentage = previousData.card_count
          ? Math.round((ownedCount / previousData.card_count) * 100)
          : 0;

        queryClient.setQueryData(['setChecklist', setId], {
          ...previousData,
          cards: updatedCards,
          owned_count: ownedCount,
          missing_count: previousData.card_count - ownedCount,
          completion_percentage: completionPercentage,
          rarity_breakdown: previousData.rarity_breakdown.map((rb) => {
            if (rb.rarity === card.rarity) {
              return {
                ...rb,
                owned: rb.owned + (isOwned ? -1 : 1),
                missing: rb.missing + (isOwned ? 1 : -1),
              };
            }
            return rb;
          }),
        });
      }

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['setChecklist', setId], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['setChecklist', setId] });
    },
  });
}