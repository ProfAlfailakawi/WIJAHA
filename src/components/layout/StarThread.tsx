import React from 'react';
import { useLocation } from 'react-router-dom';

/**
 * The eight-point star as a transition thread between pages: on every page change a gold hairline draws
 * across the top of the page with the star travelling along it. Decorative and pointer-transparent; hidden
 * with reduced motion and in print.
 */
export function StarThread() {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="wj-star-thread no-print" aria-hidden="true" data-testid="star-thread">
      <span className="wj-star-thread-line" />
      <svg className="wj-star-thread-star" viewBox="-12 -12 24 24" width="22" height="22">
        <g fill="#E8C882" stroke="#A8834A" strokeWidth="1">
          <rect x="-7" y="-7" width="14" height="14" />
          <rect x="-7" y="-7" width="14" height="14" transform="rotate(45)" />
        </g>
        <circle r="2.6" fill="#0F1B33" />
      </svg>
    </div>
  );
}
