import React from 'react';
import { Image } from '@/components/ui/image';

const LOGO_URL = 'https://media.base44.com/images/public/6a63d9d64a4d65d370c70892/9c6b5d870_a_transparent_version_of_the_socialpulse_logo_a_digital_pulse_line_forming_an_s1.svg';

export default function Logo({ size = 32, withText = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative shrink-0 overflow-hidden rounded-xl" style={{ width: size, height: size }}>
        <Image
          src={LOGO_URL}
          alt="SwapPulse logo"
          fittingType="fit"
          className="h-full w-full object-contain"
        />
      </div>
      {withText && (
        <span className="hidden text-xl font-extrabold tracking-tight xl:inline">
          Swap<span className="text-gradient-pulse">Pulse</span>
        </span>
      )}
    </div>
  );
}