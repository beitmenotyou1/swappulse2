import React from 'react';
import { Mail, Heart, Sparkles, Layers } from 'lucide-react';

// PersonalInfoSection — read-only display of the personal-info fields a viewer
// is permitted to see. `data` is either the owner's full config (owner view) or
// the filtered `personal` object returned by get-profile-config (visitor view).
// Both share the same field names. Renders nothing / an empty state when no
// fields are present.
export default function PersonalInfoSection({ data, isOwner }) {
  if (!data) return null;

  const fields = [];
  if (data.bio) fields.push({ label: 'Bio', value: data.bio, full: true });
  if (data.pronouns) fields.push({ label: 'Pronouns', value: data.pronouns });
  if (data.contact_email) fields.push({ label: 'Email', value: data.contact_email, href: `mailto:${data.contact_email}`, icon: Mail });

  const interests = (data.interests || []).filter(Boolean);
  const favPokemon = (data.favourite_pokemon || []).filter(Boolean);
  const favSets = (data.favourite_sets || []).filter(Boolean);

  const hasAny = fields.length || interests.length || favPokemon.length || favSets.length;
  if (!hasAny) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        {isOwner ? 'Add your personal details from the Customize panel to showcase them here.' : "This collector hasn't added personal details yet."}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1">
      {fields.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.label} className={`rounded-xl border border-border bg-card p-3 ${f.full ? 'sm:col-span-2' : ''}`}>
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{f.label}</p>
              {f.href ? (
                <a href={f.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 break-all text-sm font-medium text-primary hover:underline">
                  {f.icon && <f.icon className="h-3.5 w-3.5 shrink-0" />} {f.value}
                </a>
              ) : (
                <p className="flex items-center gap-1.5 text-sm">
                  {f.icon && <f.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />} {f.value}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {interests.length > 0 && <ChipGroup icon={Heart} title="Interests" items={interests} />}
      {favPokemon.length > 0 && <ChipGroup icon={Sparkles} title="Favourite Pokémon" items={favPokemon} />}
      {favSets.length > 0 && <ChipGroup icon={Layers} title="Favourite sets" items={favSets} />}
    </div>
  );
}

function ChipGroup({ icon: Icon, title, items }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((it, i) => (
          <span key={i} className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">{it}</span>
        ))}
      </div>
    </div>
  );
}