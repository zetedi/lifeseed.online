import React, { useId } from 'react';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

const Logo: React.FC<LogoProps> = ({ className, width = 64, height = 64 }) => {
  const uniqueId = useId();
  const clipPathId = `clean-${uniqueId}`;

  // Dark Mode: White strokes, Black fills (inverse of Light mode usually)
  // Light Mode: Dark strokes, White fills
  
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 262 262" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <clipPath id={clipPathId}>
          <circle cx="131" cy="131" r="131" />
        </clipPath>
      </defs>
      <g>
        {/* Main Circle: White in Light mode, Black in Dark mode */}
        <circle cx="131" cy="131" r="131" className="fill-white stroke-slate-700 dark:fill-slate-900 dark:stroke-slate-100" strokeWidth="7" clipPath={`url(#${clipPathId})`} />

        {/* Small Circles: Stroke only */}
        {[
            // Left Column
            [-35.28, -29], [-35.28, 35], [-35.28, 99], [-35.28, 163], [-35.28, 227], [-35.28, 291],
            // Mid-Left
            [20.15, 3], [20.15, 67], [20.15, 131], [20.15, 195], [20.15, 259],
            // Center
            [75.57, -29], [75.57, 35], [75.57, 99], [75.57, 163], [75.57, 227], [75.57, 291],
            // Mid-Right
            [131, 3], [131, 67], [131, 131], [131, 195], [131, 259],
            // Right
            [186.43, -29], [186.43, 35], [186.43, 99], [186.43, 163], [186.43, 227], [186.43, 291],
            // Far Right
            [241.85, 3], [241.85, 67], [241.85, 131], [241.85, 195], [241.85, 259],
            // Outer Right
            [297.28, -29], [297.28, 35], [297.28, 99], [297.28, 163], [297.28, 227], [297.28, 291]
        ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="64" fill="none" className="stroke-slate-700 dark:stroke-slate-100" strokeWidth=".7" clipPath={`url(#${clipPathId})`} />
        ))}

        {/* Inner Seed Circles: Filled */}
        {[
            [75.57, 99], [75.57, 163],
            [131, 67], [131, 131], [131, 195],
            [186.43, 99], [186.43, 163]
        ].map(([cx, cy], i) => (
            <circle key={`inner-${i}`} cx={cx} cy={cy} r="16" className="fill-white stroke-slate-700 dark:fill-slate-900 dark:stroke-slate-100" strokeWidth="3" clipPath={`url(#${clipPathId})`} />
        ))}
      </g>
    </svg>
  );
};

export default Logo;