import React from 'react';
import BlockRenderer from '@/components/profile/BlockRenderer';
import { DEFAULT_BLOCK_ORDER } from '@/lib/profileThemes';

// ProfileBlocks — renders the About-section content blocks in the owner's
// chosen block_order. Used for gradient themes (default look). Platform themes
// use BlockRenderer directly to place blocks in platform-native positions.
export default function ProfileBlocks({ data, blockOrder, did, isOwner }) {
  const order = blockOrder?.length ? blockOrder : DEFAULT_BLOCK_ORDER;
  return (
    <div className="space-y-3 py-4">
      {order.map((key) => (
        <BlockRenderer key={key} blockKey={key} data={data} did={did} isOwner={isOwner} />
      ))}
    </div>
  );
}