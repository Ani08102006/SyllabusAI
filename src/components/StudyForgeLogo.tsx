import React from 'react';

interface StudyForgeLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textColorClass?: string;
}

export default function StudyForgeLogo({
  className = '',
  size = 36,
  showText = true,
  textColorClass = 'text-zinc-900 dark:text-zinc-50'
}: StudyForgeLogoProps) {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* SVG Vector Logo */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-300 hover:scale-105"
      >
        <defs>
          {/* Main Gradient for the Brand Logo */}
          <linearGradient id="forgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />   {/* Tech Blue */}
            <stop offset="50%" stopColor="#8B5CF6" />  {/* AI Purple */}
            <stop offset="100%" stopColor="#D946EF" /> {/* Forge Pink/Spark */}
          </linearGradient>

          {/* Glow/Shadow filter for a premium, clean look */}
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Neural Network Nodes & Connection Lines */}
        <g stroke="url(#forgeGradient)" strokeWidth="1.5" opacity="0.6">
          <line x1="25" y1="50" x2="50" y2="35" strokeDasharray="2,2" />
          <line x1="75" y1="50" x2="50" y2="35" strokeDasharray="2,2" />
          <line x1="50" y1="35" x2="50" y2="15" />
          <line x1="25" y1="50" x2="15" y2="40" />
          <line x1="75" y1="50" x2="85" y2="40" />
        </g>

        {/* Neural Network Node Circles */}
        <circle cx="25" cy="50" r="3.5" fill="#3B82F6" />
        <circle cx="75" cy="50" r="3.5" fill="#D946EF" />
        <circle cx="15" cy="40" r="2.5" fill="#3B82F6" opacity="0.8" />
        <circle cx="85" cy="40" r="2.5" fill="#D946EF" opacity="0.8" />

        {/* Modern Open Book Outline (The Foundation of Learning) */}
        <path
          d="M15,68 C25,64 45,64 50,75 C55,64 75,64 85,68 L85,45 C75,41 55,41 50,52 C45,41 25,41 15,45 Z"
          fill="none"
          stroke="url(#forgeGradient)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Pages under the cover */}
        <path
          d="M15,73 C25,69 45,69 50,80 L50,52"
          stroke="url(#forgeGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.8"
        />
        <path
          d="M85,73 C75,69 55,69 50,80"
          stroke="url(#forgeGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.8"
        />

        {/* Center Spine of Book */}
        <path
          d="M50,52 L50,80"
          stroke="url(#forgeGradient)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Subtle Forge Spark / Digital Brilliance Symbol at the Top Center */}
        {/* Representing the "digital forge" of knowledge creation */}
        <path
          d="M50,12 L53,24 L65,27 L53,30 L50,42 L47,30 L35,27 L47,24 Z"
          fill="url(#forgeGradient)"
          filter="url(#softGlow)"
        />

        {/* Mini Accent Sparks */}
        <path
          d="M32,20 L33.5,23 L36.5,23.5 L33.5,24 L32,27 L30.5,24 L27.5,23.5 L30.5,23 Z"
          fill="#3B82F6"
          opacity="0.7"
        />
        <path
          d="M68,20 L69.5,23 L72.5,23.5 L69.5,24 L68,27 L66.5,24 L63.5,23.5 L66.5,23 Z"
          fill="#D946EF"
          opacity="0.7"
        />
      </svg>

      {/* Brand Text */}
      {showText && (
        <span className={`text-lg font-bold tracking-tight font-sans ${textColorClass}`}>
          StudyForge <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent font-extrabold">AI</span>
        </span>
      )}
    </div>
  );
}
