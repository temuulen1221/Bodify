export const getLevelAccent = (level) => {
  if (level >= 20) {
    return {
      cardColors: ['#12091F', '#24103C', '#7C3AED'],
      borderColor: 'rgba(196, 181, 253, 0.44)',
      glowColor: 'rgba(168, 85, 247, 0.22)',
      accentText: '#F5D0FE',
      pillColor: 'rgba(168, 85, 247, 0.22)',
    };
  }
  if (level >= 15) {
    return {
      cardColors: ['#1A1110', '#312017', '#F97316'],
      borderColor: 'rgba(253, 186, 116, 0.42)',
      glowColor: 'rgba(249, 115, 22, 0.2)',
      accentText: '#FED7AA',
      pillColor: 'rgba(249, 115, 22, 0.2)',
    };
  }
  if (level >= 10) {
    return {
      cardColors: ['#0E1024', '#1B2150', '#2563EB'],
      borderColor: 'rgba(147, 197, 253, 0.4)',
      glowColor: 'rgba(37, 99, 235, 0.18)',
      accentText: '#BFDBFE',
      pillColor: 'rgba(37, 99, 235, 0.18)',
    };
  }
  if (level >= 5) {
    return {
      cardColors: ['#091224', '#16244B', '#0B6D88'],
      borderColor: 'rgba(126, 231, 255, 0.35)',
      glowColor: 'rgba(0, 231, 255, 0.14)',
      accentText: '#A5F3FC',
      pillColor: 'rgba(0, 231, 255, 0.14)',
    };
  }
  return {
    cardColors: ['#0A111C', '#102033', '#14B8A6'],
    borderColor: 'rgba(153, 246, 228, 0.32)',
    glowColor: 'rgba(20, 184, 166, 0.14)',
    accentText: '#99F6E4',
    pillColor: 'rgba(20, 184, 166, 0.16)',
  };
};