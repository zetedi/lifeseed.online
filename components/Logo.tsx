import React from 'react';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

const Logo: React.FC<LogoProps> = ({ className, width = 64, height = 64 }) => {
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 262 262" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <clipPath id="clean">
          <circle cx="131" cy="131" r="131" />
        </clipPath>
      </defs>
      <g>
        <circle cx="131" cy="131" r="131" fill="white" stroke="#334155" strokeWidth="7" clipPath="url(#clean)" />

        {/* Left Column */}
        <circle cx="-35.28" cy="-29" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="-35.28" cy="35" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="-35.28" cy="99" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="-35.28" cy="163" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="-35.28" cy="227" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="-35.28" cy="291" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />

        {/* Mid-Left Column */}
        <circle cx="20.15" cy="3" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="20.15" cy="67" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="20.15" cy="131" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="20.15" cy="195" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="20.15" cy="259" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />

        {/* Center Column */}
        <circle cx="75.57" cy="-29" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="75.57" cy="35" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="75.57" cy="99" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="75.57" cy="163" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="75.57" cy="227" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="75.57" cy="291" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />

        {/* Mid-Right Column */}
        <circle cx="131" cy="3" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="131" cy="67" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="131" cy="131" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="131" cy="195" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="131" cy="259" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />

        {/* Right Columns */}
        <circle cx="186.43" cy="-29" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="186.43" cy="35" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="186.43" cy="99" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="186.43" cy="163" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="186.43" cy="227" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="186.43" cy="291" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />

        <circle cx="241.85" cy="3" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="241.85" cy="67" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="241.85" cy="131" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="241.85" cy="195" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="241.85" cy="259" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />

        <circle cx="297.28" cy="-29" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="297.28" cy="35" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="297.28" cy="99" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="297.28" cy="163" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="297.28" cy="227" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />
        <circle cx="297.28" cy="291" r="64" fill="none" stroke="#334155" strokeWidth=".7" clipPath="url(#clean)" />

        {/* Inner Seed Circles */}
        <circle cx="75.57" cy="99" r="16" fill="white" stroke="#334155" strokeWidth="3" clipPath="url(#clean)" />
        <circle cx="75.57" cy="163" r="16" fill="white" stroke="#334155" strokeWidth="3" clipPath="url(#clean)" />
        <circle cx="131" cy="67" r="16" fill="white" stroke="#334155" strokeWidth="3" clipPath="url(#clean)" />
        <circle cx="131" cy="131" r="16" fill="white" stroke="#334155" strokeWidth="3" clipPath="url(#clean)" />
        <circle cx="131" cy="195" r="16" fill="white" stroke="#334155" strokeWidth="3" clipPath="url(#clean)" />
        <circle cx="186.43" cy="99" r="16" fill="white" stroke="#334155" strokeWidth="3" clipPath="url(#clean)" />
        <circle cx="186.43" cy="163" r="16" fill="white" stroke="#334155" strokeWidth="3" clipPath="url(#clean)" />
      </g>
    </svg>
  );
};

export default Logo;