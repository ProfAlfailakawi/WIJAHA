import React from 'react';

/**
 * "Invitation envelope": a visual wrapper shown while a result streams. The ivory envelope receives a gold
 * seal (understanding), the seal is pressed (retrieving), then the flap opens (generating) and the streamed
 * blocks descend out of it as ceremonial cards. It only reads the existing stream stage; stream handling is
 * untouched.
 */
export type EnvelopeStage = 'understanding' | 'retrieving' | 'generating';

export function InvitationEnvelope({ stage, blocks }: { stage: EnvelopeStage; blocks: number }) {
  const open = stage === 'generating' || blocks > 0;
  return (
    <div className="wj-envelope" data-stage={stage} data-open={open ? 'true' : 'false'} aria-hidden="true" data-testid="invitation-envelope">
      <svg viewBox="0 0 320 210" className="w-full h-full">
        <defs>
          <linearGradient id="wj-env-paper" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFDF6" />
            <stop offset="1" stopColor="#EFE6D2" />
          </linearGradient>
          <radialGradient id="wj-env-seal" cx=".4" cy=".35" r=".7">
            <stop offset="0" stopColor="#F3D68F" />
            <stop offset=".6" stopColor="#C9A24F" />
            <stop offset="1" stopColor="#8A6526" />
          </radialGradient>
        </defs>
        {/* letter peeking out once open */}
        <g className="wj-env-letter">
          <rect x="44" y="40" width="232" height="140" rx="4" fill="#FFFDF8" stroke="#D9C7A3" />
          <path d="M80 78H240M80 98H220M80 118H232" stroke="#D9C7A3" strokeWidth="3" strokeLinecap="round" />
        </g>
        {/* back + pockets */}
        <rect x="20" y="60" width="280" height="140" rx="6" fill="url(#wj-env-paper)" stroke="#CDBB93" />
        <path d="M20 200L160 120L300 200" fill="#F6EEDC" stroke="#CDBB93" />
        <path d="M20 62L130 140M300 62L190 140" stroke="#E2D4B3" />
        {/* flap */}
        <g className="wj-env-flap">
          <path d="M20 62L160 150L300 62Z" fill="#F8F1E1" stroke="#CDBB93" strokeLinejoin="round" />
        </g>
        {/* seal: eight-point star on gold wax */}
        <g transform="translate(160 146)">
          <g className="wj-env-seal">
          <circle r="22" fill="url(#wj-env-seal)" stroke="#8A6526" strokeWidth="1.2" />
          <g fill="none" stroke="#FFF4D6" strokeWidth="1.6" opacity=".9">
            <rect x="-9" y="-9" width="18" height="18" />
            <rect x="-9" y="-9" width="18" height="18" transform="rotate(45)" />
          </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
