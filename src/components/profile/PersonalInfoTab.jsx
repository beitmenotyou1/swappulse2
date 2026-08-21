import React from 'react';
import { Field, TagInput } from './EditorControls';

// PersonalInfoTab — bio, pronouns, interests, favourite Pokémon/sets, each
// with a per-field visibility selector.
export default function PersonalInfoTab({ draft, update }) {
  const fv = draft.field_visibility || {};
  const setVis = (field, v) => update({ field_visibility: { ...fv, [field]: v } });

  return (
    <div className="space-y-4">
      <Field label="Bio" visibility={fv.bio} onVis={(v) => setVis('bio', v)}>
        <textarea
          value={draft.bio || ''}
          onChange={(e) => update({ bio: e.target.value })}
          maxLength={256}
          rows={3}
          placeholder="A short bio about your collecting journey…"
          className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <p className="mt-1 text-right text-[11px] text-muted-foreground">{(draft.bio || '').length}/256</p>
      </Field>

      <Field label="Pronouns" visibility={fv.pronouns} onVis={(v) => setVis('pronouns', v)}>
        <input
          value={draft.pronouns || ''}
          onChange={(e) => update({ pronouns: e.target.value })}
          maxLength={40}
          placeholder="e.g. she/her"
          className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </Field>

      <Field label="Interests & hobbies" visibility={fv.interests} onVis={(v) => setVis('interests', v)}>
        <TagInput value={draft.interests || []} onChange={(interests) => update({ interests })} placeholder="Add an interest, then press Enter" />
      </Field>

      <Field label="Favourite Pokémon" visibility={fv.favourite_pokemon} onVis={(v) => setVis('favourite_pokemon', v)}>
        <TagInput value={draft.favourite_pokemon || []} onChange={(favourite_pokemon) => update({ favourite_pokemon })} placeholder="Add a Pokémon, then press Enter" />
      </Field>

      <Field label="Favourite sets" visibility={fv.favourite_sets} onVis={(v) => setVis('favourite_sets', v)}>
        <TagInput value={draft.favourite_sets || []} onChange={(favourite_sets) => update({ favourite_sets })} placeholder="Add a set, then press Enter" />
      </Field>
    </div>
  );
}