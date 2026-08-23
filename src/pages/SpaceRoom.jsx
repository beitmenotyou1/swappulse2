import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import InPlatformSpace from '@/components/spaces/InPlatformSpace';
import ExternalStreamSpace from '@/components/spaces/ExternalStreamSpace';
import useSEO from '@/hooks/useSEO';
import { useT } from '@/lib/i18n/I18nProvider';

export default function SpaceRoom() {
  const t = useT();
  const { spaceId } = useParams();
  const [space, setSpace] = useState(null);
  const [notFound, setNotFound] = useState(false);
  useSEO({
    title: space?.title || 'Pokémon TCG Voice Space',
    description: 'Join a live Pokémon TCG audio space on SwapPulse.',
    canonicalPath: `/spaces/${spaceId}`,
  });

  useEffect(() => {
    base44.entities.VoiceSpace.get(spaceId)
      .then((s) => setSpace(s))
      .catch(() => setNotFound(true));
  }, [spaceId]);

  if (notFound) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-2 text-center">
        <Radio className="h-8 w-8 text-muted-foreground" />
        <p className="text-lg font-bold">{t('page.space.notFound')}</p>
      </div>
    );
  }
  if (!space) {
    return <div className="flex h-[60vh] items-center justify-center"><Radio className="h-6 w-6 animate-pulse text-primary" /></div>;
  }

  return space.space_mode === 'in_platform'
    ? <InPlatformSpace space={space} />
    : <ExternalStreamSpace space={space} />;
}