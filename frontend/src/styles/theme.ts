export const theme = {
  colors: {
    background: '#050505', // Deep space base
    text: '#FFFFFF',
    textSecondary: 'rgba(255, 255, 255, 0.6)',
    primary: '#0D47A1',
    secondary: '#1976D2',
    accent: '#FFC107',
    unallocated: 'rgba(255, 255, 255, 0.03)',
    border: 'rgba(255, 255, 255, 0.1)',
    error: '#FF3B30',
    
    // LLC Proprietary Materials
    glass: {
      base: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(255, 255, 255, 0.08)',
      highlight: 'rgba(255, 255, 255, 0.12)',
    },
    thermal: {
      core: '#FF3B30',
      corona: '#FF9500',
      glow: ['#FF3B30', '#FF9500'],
    }
  },
  physics: {
    dragResistance: 0.15,
    spring: {
      stiffness: 180,
      damping: 12,
      mass: 1.2,
    },
    motionCurve: [0.23, 1, 0.32, 1], // cubic-bezier
  },
  spacing: {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
  },
  layout: {
    minutesToHeight: 4,
    snapIncrement: 5,
  },
  shadows: {
    lifted: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    }
  },
  typography: {
    h1: { fontFamily: 'Montserrat-Bold', fontSize: 24 },
    h2: { fontFamily: 'Montserrat-Bold', fontSize: 18 },
    body: { fontFamily: 'OpenSans-Regular', fontSize: 14 },
    caption: { fontFamily: 'OpenSans-Light', fontSize: 12 },
  },
};
