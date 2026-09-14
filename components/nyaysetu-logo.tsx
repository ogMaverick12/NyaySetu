/**
 * NyaySetuLogo
 * Bespoke SVG logo: tall balanced scales of justice with an Ashoka
 * Chakra 24-spoke wheel at the pivot. Brass/navy palette to match the
 * parchment design system. No wide feet — slim base pedestal only.
 */

interface NyaySetuLogoProps {
  /** Height in px; width scales proportionally. Default: 52 */
  size?: number;
  className?: string;
}

export function NyaySetuLogo({ size = 52, className = "" }: NyaySetuLogoProps) {
  const w = size;
  const h = Math.round(size * 1.4);

  // Colour tokens
  const brass = "#8B6914";
  const brassLight = "#C49A22";
  const navy = "#1A2744";
  const gold = "#D4A017";

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 100 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="NyaySetu — Scales of Justice"
      className={className}
    >
      {/* Vertical central beam */}
      <rect x="48.5" y="18" width="3" height="100" rx="1.5" fill={navy} />

      {/* Base — slim pedestal, not a wide triangle */}
      <rect x="32" y="116" width="36" height="5" rx="2.5" fill={navy} />
      <rect x="24" y="121" width="52" height="6" rx="3" fill={navy} />

      {/* Horizontal cross-arm */}
      <rect x="10" y="43" width="80" height="3" rx="1.5" fill={navy} />

      {/* Ashoka Chakra wheel at pivot */}
      <g transform="translate(50,44)">
        <circle cx="0" cy="0" r="11.5" stroke={gold} strokeWidth="2" fill="white" />
        <circle cx="0" cy="0" r="2.8" fill={gold} />
        {Array.from({ length: 24 }, (_, i) => {
          const rad = ((i * 360) / 24) * (Math.PI / 180);
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          return (
            <line
              key={i}
              x1={cos * 2.8}
              y1={sin * 2.8}
              x2={cos * 9.3}
              y2={sin * 9.3}
              stroke={brass}
              strokeWidth="0.75"
            />
          );
        })}
      </g>

      {/* Chain — left */}
      <line
        x1="19"
        y1="45"
        x2="19"
        y2="72"
        stroke={navy}
        strokeWidth="1.4"
        strokeDasharray="2.2 2"
      />

      {/* Chain — right */}
      <line
        x1="81"
        y1="45"
        x2="81"
        y2="72"
        stroke={navy}
        strokeWidth="1.4"
        strokeDasharray="2.2 2"
      />

      {/* Left pan */}
      <ellipse cx="19" cy="76" rx="14" ry="3.8" fill={brass} opacity="0.88" />
      <path d="M 5 76 Q 19 86 33 76" fill={brassLight} opacity="0.55" />
      <ellipse cx="19" cy="76" rx="14" ry="3.8" stroke={navy} strokeWidth="0.8" fill="none" />

      {/* Right pan — same height as left (balanced) */}
      <ellipse cx="81" cy="76" rx="14" ry="3.8" fill={brass} opacity="0.88" />
      <path d="M 67 76 Q 81 86 95 76" fill={brassLight} opacity="0.55" />
      <ellipse cx="81" cy="76" rx="14" ry="3.8" stroke={navy} strokeWidth="0.8" fill="none" />

      {/* Suspension rings */}
      <circle cx="19" cy="44" r="2.5" fill={gold} />
      <circle cx="81" cy="44" r="2.5" fill={gold} />

      {/* Top finial */}
      <circle cx="50" cy="18" r="4.5" fill={gold} />
      <circle cx="50" cy="18" r="2.4" fill={navy} />
    </svg>
  );
}
