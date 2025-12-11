import { Activity, Award, Crown, Flame, Star, Target, Trophy, Zap } from "lucide-react";
import { useState } from "react";

interface RunnerBadgeProps {
  level: number;
  levelName: string;
  xp: number;
  maxXp: number;
  distance: number;
  rank: string;
  speed: number;
  streak: number;
  achievements: string[];
  glowColor?: "cyan" | "magenta" | "purple";
  isSelected?: boolean;
  onClick?: () => void;
}

const achievementIcons: Record<string, { icon: any; name: string; color: string }> = {
  "speed-demon": { icon: Zap, name: "Speed Demon", color: "text-yellow-400" },
  "distance-master": { icon: Target, name: "Distance Master", color: "text-blue-400" },
  "early-bird": { icon: Star, name: "Early Bird", color: "text-orange-400" },
  "night-owl": { icon: Crown, name: "Night Owl", color: "text-purple-400" },
  "marathon": { icon: Award, name: "Marathon", color: "text-green-400" },
};

export function RunnerBadge({
  level,
  levelName,
  xp,
  maxXp,
  distance,
  rank,
  speed,
  streak,
  achievements,
  glowColor = "cyan",
  isSelected = false,
  onClick,
}: RunnerBadgeProps) {
  const [showAchievements, setShowAchievements] = useState(false);
  const xpPercentage = (xp / maxXp) * 100;

  const glowColors = {
    cyan: {
      border: "border-cyan-400",
      shadow: "shadow-[0_0_20px_rgba(34,211,238,0.5),0_0_40px_rgba(34,211,238,0.3),inset_0_0_20px_rgba(34,211,238,0.1)]",
      text: "text-cyan-400",
      bg: "bg-cyan-500/10",
      innerGlow: "shadow-[0_0_10px_rgba(34,211,238,0.6)]",
      gradient: "from-cyan-500 to-cyan-300",
    },
    magenta: {
      border: "border-fuchsia-400",
      shadow: "shadow-[0_0_20px_rgba(232,121,249,0.5),0_0_40px_rgba(232,121,249,0.3),inset_0_0_20px_rgba(232,121,249,0.1)]",
      text: "text-fuchsia-400",
      bg: "bg-fuchsia-500/10",
      innerGlow: "shadow-[0_0_10px_rgba(232,121,249,0.6)]",
      gradient: "from-fuchsia-500 to-fuchsia-300",
    },
    purple: {
      border: "border-purple-400",
      shadow: "shadow-[0_0_20px_rgba(192,132,252,0.5),0_0_40px_rgba(192,132,252,0.3),inset_0_0_20px_rgba(192,132,252,0.1)]",
      text: "text-purple-400",
      bg: "bg-purple-500/10",
      innerGlow: "shadow-[0_0_10px_rgba(192,132,252,0.6)]",
      gradient: "from-purple-500 to-purple-300",
    },
  };

  const colors = glowColors[glowColor];

  return (
    <div 
      className="relative group cursor-pointer"
      onClick={onClick}
    >
      {/* Outer glow effect */}
      <div
        className={`absolute inset-0 ${colors.shadow} rounded-lg transition-all duration-300 ${
          isSelected ? 'opacity-100 scale-105' : 'opacity-75 group-hover:opacity-100 group-hover:scale-[1.02]'
        }`}
      />

      {/* Main badge container */}
      <div
        className={`relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 ${colors.border} rounded-lg p-6 ${colors.shadow} overflow-hidden transition-transform duration-300 ${
          isSelected ? 'scale-105' : ''
        }`}
      >
        {/* Animated scan lines */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white to-transparent h-full w-full animate-[scan_3s_linear_infinite]" />
        </div>

        {/* Hexagon pattern background */}
        <div className="absolute inset-0 opacity-5">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id={`hexagons-${glowColor}`} x="0" y="0" width="50" height="43.4" patternUnits="userSpaceOnUse">
                <polygon points="24.8,22 37.3,14.4 37.3,0.8 24.8,0 12.3,7.6 12.3,21.2" fill="none" stroke="currentColor" strokeWidth="0.5" className={colors.text} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#hexagons-${glowColor})`} />
          </svg>
        </div>

        {/* Header with level and rank */}
        <div className="flex items-start justify-between mb-4 relative z-10">
          {/* Level badge */}
          <div className={`${colors.bg} ${colors.border} border rounded-lg px-4 py-2 ${colors.innerGlow}`}>
            <div className="flex items-center gap-2">
              <Trophy className={`w-5 h-5 ${colors.text}`} />
              <div>
                <div className="text-slate-400">LVL</div>
                <div className={`${colors.text} tracking-wider`}>{level}</div>
              </div>
            </div>
          </div>

          {/* Rank badge */}
          <div
            className={`${colors.text} ${colors.innerGlow} px-4 py-2 border-2 ${colors.border} rounded-lg backdrop-blur-sm ${colors.bg}`}
          >
            <div className="text-slate-400">RANK</div>
            <div className="tracking-wider text-center">{rank}</div>
          </div>
        </div>

        {/* Level name */}
        <div className="mb-4 relative z-10">
          <h3 className={`${colors.text} tracking-wider mb-2`}>{levelName}</h3>
          
          {/* XP Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>XP</span>
              <span>{xp.toLocaleString()} / {maxXp.toLocaleString()}</span>
            </div>
            <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden border border-slate-600 relative">
              <div
                className={`h-full bg-gradient-to-r ${colors.gradient} ${colors.innerGlow} rounded-full transition-all duration-1000 relative overflow-hidden`}
                style={{ width: `${xpPercentage}%` }}
              >
                {/* Animated shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]" />
              </div>
            </div>
          </div>
        </div>

        {/* Streak counter */}
        <div className={`${colors.bg} border ${colors.border} rounded-lg p-3 mb-4 relative z-10`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-400 animate-pulse" />
              <div>
                <div className="text-slate-400">Streak</div>
                <div className="text-orange-400">{streak} Days</div>
              </div>
            </div>
            <div className={`${colors.text} tracking-wider`}>
              +{streak * 10} XP
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-4 relative z-10">
          {/* Distance stat */}
          <div className={`${colors.bg} border ${colors.border} rounded-lg p-3 hover:bg-slate-800/50 transition-colors`}>
            <div className="flex items-center gap-2 mb-1">
              <Target className={`w-4 h-4 ${colors.text}`} />
              <span className="text-slate-400">Distance</span>
            </div>
            <div className={`${colors.text}`}>{distance} km</div>
            <div className="text-slate-500 mt-1">+{distance * 2} XP</div>
          </div>

          {/* Speed stat */}
          <div className={`${colors.bg} border ${colors.border} rounded-lg p-3 hover:bg-slate-800/50 transition-colors`}>
            <div className="flex items-center gap-2 mb-1">
              <Zap className={`w-4 h-4 ${colors.text}`} />
              <span className="text-slate-400">Speed</span>
            </div>
            <div className={`${colors.text}`}>{speed} km/h</div>
            <div className="text-slate-500 mt-1">+{Math.round(speed * 10)} XP</div>
          </div>
        </div>

        {/* Achievements */}
        <div className="relative z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAchievements(!showAchievements);
            }}
            className="w-full"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Award className={`w-4 h-4 ${colors.text}`} />
                <span className="text-slate-400">Achievements</span>
              </div>
              <span className={`${colors.text}`}>{achievements.length}/5</span>
            </div>
          </button>

          {/* Achievement icons */}
          <div className={`grid grid-cols-5 gap-2 transition-all duration-300 ${showAchievements ? 'mb-3' : ''}`}>
            {Object.keys(achievementIcons).map((key) => {
              const achievement = achievementIcons[key];
              const isUnlocked = achievements.includes(key);
              const Icon = achievement.icon;
              
              return (
                <div
                  key={key}
                  className={`${colors.border} border rounded-md p-2 flex items-center justify-center transition-all ${
                    isUnlocked
                      ? `${colors.bg} ${colors.innerGlow}`
                      : 'bg-slate-900/50 opacity-30'
                  }`}
                  title={achievement.name}
                >
                  <Icon
                    className={`w-5 h-5 ${isUnlocked ? achievement.color : 'text-slate-600'}`}
                  />
                </div>
              );
            })}
          </div>

          {/* Achievement details */}
          {showAchievements && (
            <div className={`${colors.bg} border ${colors.border} rounded-lg p-3 space-y-2 animate-[slideDown_0.3s_ease-out]`}>
              {achievements.map((key) => {
                const achievement = achievementIcons[key];
                if (!achievement) return null;
                const Icon = achievement.icon;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${achievement.color}`} />
                    <span className="text-slate-300">{achievement.name}</span>
                    <span className="text-slate-500 ml-auto">+50 XP</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Performance indicator */}
        <div className="mt-4 relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Activity className={`w-4 h-4 ${colors.text}`} />
            <span className="text-slate-400">Next Level</span>
          </div>
          <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden border border-slate-600">
            <div
              className={`h-full bg-gradient-to-r ${colors.gradient} ${colors.innerGlow} rounded-full transition-all duration-1000`}
              style={{ width: `${Math.min((distance / 500) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Corner accents with animated pulse */}
        <div className={`absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 ${colors.border} rounded-tl-lg ${isSelected ? 'animate-pulse' : ''}`} />
        <div className={`absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 ${colors.border} rounded-tr-lg ${isSelected ? 'animate-pulse' : ''}`} />
        <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 ${colors.border} rounded-bl-lg ${isSelected ? 'animate-pulse' : ''}`} />
        <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 ${colors.border} rounded-br-lg ${isSelected ? 'animate-pulse' : ''}`} />
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
        
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
