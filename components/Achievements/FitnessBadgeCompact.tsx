// Removed eslint-disable for import/no-unresolved
import {
    Activity,
    Apple, CheckCircle2,
    Dumbbell,
    FootprintsIcon,
    Heart,
    TrendingDown,
    TrendingUp,
    Zap
} from "lucide-react";

type BadgeType = "runner" | "strongman" | "workout-killer" | "cardio-master" | "walker" | "on-diet" | "mass-builder" | "weight-cutter";

interface FitnessBadgeCompactProps {
  type: BadgeType;
  level: number;
  rank: string;
  xp: number;
  maxXp: number;
  glowColor?: "cyan" | "magenta" | "purple" | "green" | "orange" | "red" | "indigo" | "teal";
}

const badgeIcons = {
  runner: Activity,
  strongman: Dumbbell,
  "workout-killer": CheckCircle2,
  "cardio-master": Heart,
  walker: FootprintsIcon,
  "on-diet": Apple,
  "mass-builder": TrendingUp,
  "weight-cutter": TrendingDown,
};

export function FitnessBadgeCompact({
  type,
  level,
  rank,
  xp,
  maxXp,
  glowColor = "cyan",
}: FitnessBadgeCompactProps) {
  const xpPercentage = (xp / maxXp) * 100;
  const BadgeIcon = badgeIcons[type];

  const glowColors = {
    cyan: {
      border: "border-cyan-400",
      shadow: "shadow-[0_0_15px_rgba(34,211,238,0.6),inset_0_0_15px_rgba(34,211,238,0.2)]",
      text: "text-cyan-400",
      bg: "bg-cyan-500/20",
      gradient: "from-cyan-500 to-cyan-300",
    },
    magenta: {
      border: "border-fuchsia-400",
      shadow: "shadow-[0_0_15px_rgba(232,121,249,0.6),inset_0_0_15px_rgba(232,121,249,0.2)]",
      text: "text-fuchsia-400",
      bg: "bg-fuchsia-500/20",
      gradient: "from-fuchsia-500 to-fuchsia-300",
    },
    purple: {
      border: "border-purple-400",
      shadow: "shadow-[0_0_15px_rgba(192,132,252,0.6),inset_0_0_15px_rgba(192,132,252,0.2)]",
      text: "text-purple-400",
      bg: "bg-purple-500/20",
      gradient: "from-purple-500 to-purple-300",
    },
    green: {
      border: "border-emerald-400",
      shadow: "shadow-[0_0_15px_rgba(52,211,153,0.6),inset_0_0_15px_rgba(52,211,153,0.2)]",
      text: "text-emerald-400",
      bg: "bg-emerald-500/20",
      gradient: "from-emerald-500 to-emerald-300",
    },
    orange: {
      border: "border-orange-400",
      shadow: "shadow-[0_0_15px_rgba(251,146,60,0.6),inset_0_0_15px_rgba(251,146,60,0.2)]",
      text: "text-orange-400",
      bg: "bg-orange-500/20",
      gradient: "from-orange-500 to-orange-300",
    },
    red: {
      border: "border-red-400",
      shadow: "shadow-[0_0_15px_rgba(248,113,113,0.6),inset_0_0_15px_rgba(248,113,113,0.2)]",
      text: "text-red-400",
      bg: "bg-red-500/20",
      gradient: "from-red-500 to-red-300",
    },
    indigo: {
      border: "border-indigo-400",
      shadow: "shadow-[0_0_15px_rgba(129,140,248,0.6),inset_0_0_15px_rgba(129,140,248,0.2)]",
      text: "text-indigo-400",
      bg: "bg-indigo-500/20",
      gradient: "from-indigo-500 to-indigo-300",
    },
    teal: {
      border: "border-teal-400",
      shadow: "shadow-[0_0_15px_rgba(45,212,191,0.6),inset_0_0_15px_rgba(45,212,191,0.2)]",
      text: "text-teal-400",
      bg: "bg-teal-500/20",
      gradient: "from-teal-500 to-teal-300",
    },
  };

  const colors = glowColors[glowColor];

  return (
    <div className="relative group cursor-pointer">
      {/* Outer glow */}
      <div
        className={`absolute inset-0 ${colors.shadow} rounded-lg transition-all duration-300 group-hover:scale-110`}
      />

      {/* Main container - 100x100 */}
      <div
        className={`relative w-[100px] h-[100px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 ${colors.border} rounded-lg ${colors.shadow} overflow-hidden flex flex-col items-center justify-center p-2`}
      >
        {/* Animated background effect */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white to-transparent animate-[scan_3s_linear_infinite]" />
        </div>

        {/* Circuit pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg viewBox="0 0 100 100" className={`w-full h-full ${colors.text}`}>
            <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="0.5" />
            <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="0.5" />
            <line x1="50" y1="15" x2="50" y2="85" stroke="currentColor" strokeWidth="0.5" />
            <line x1="15" y1="50" x2="85" y2="50" stroke="currentColor" strokeWidth="0.5" />
          </svg>
        </div>

        {/* Rank badge - top */}
        <div
          className={`absolute top-1 right-1 ${colors.bg} ${colors.border} border rounded px-1.5 py-0.5 z-10`}
        >
          <span className={`${colors.text} tracking-wider`} style={{ fontSize: '9px' }}>
            {rank}
          </span>
        </div>

        {/* Level icon and number - center */}
        <div className={`relative z-10 flex flex-col items-center gap-1 ${colors.bg} rounded-lg p-2 ${colors.border} border`}>
          <BadgeIcon className={`w-6 h-6 ${colors.text}`} />
          <div className={`${colors.text} tracking-wider`} style={{ fontSize: '16px', lineHeight: '1' }}>
            {level}
          </div>
        </div>

        {/* XP Progress ring - absolute positioned */}
        <svg
          className="absolute inset-0 w-full h-full -rotate-90"
          viewBox="0 0 100 100"
        >
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgba(71, 85, 105, 0.3)"
            strokeWidth="3"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className={colors.text}
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - xpPercentage / 100)}`}
            style={{
              filter: `drop-shadow(0 0 4px currentColor)`,
              transition: 'stroke-dashoffset 1s ease-out',
            }}
          />
        </svg>

        {/* XP indicator - bottom */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10">
          <div className={`${colors.bg} ${colors.border} border rounded px-1.5 py-0.5 flex items-center gap-1`}>
            <Zap className={`w-2.5 h-2.5 ${colors.text}`} />
            <span className={`${colors.text}`} style={{ fontSize: '8px' }}>
              {Math.round(xpPercentage)}%
            </span>
          </div>
        </div>

        {/* Corner accents */}
        <div className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 ${colors.border} rounded-tl-lg`} />
        <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 ${colors.border} rounded-br-lg`} />
      </div>

      <style>{`
        @keyframes scan {
          0% {
            transform: translateY(-100%);
          }
          100% {
            transform: translateY(100%);
          }
        }
      `}</style>
    </div>
  );
}
