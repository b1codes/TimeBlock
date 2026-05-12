import { Easing } from 'react-native-reanimated';

export const theme = {
  colors: {
    background: '#050507',
    text: '#FFFFFF',
    textSecondary: 'rgba(255, 255, 255, 0.62)',
    textTertiary: 'rgba(255, 255, 255, 0.38)',
    primary: '#0D47A1',
    secondary: '#1976D2',
    accent: '#FFC107',
    unallocated: 'rgba(255, 255, 255, 0.03)',
    border: 'rgba(255, 255, 255, 0.08)',
    error: '#FF3B30',

    // LLC Proprietary Materials — "Technical Luxury"
    glass: {
      base: 'rgba(255, 255, 255, 0.05)',
      raised: 'rgba(255, 255, 255, 0.07)',
      sunken: 'rgba(0, 0, 0, 0.25)',
      border: 'rgba(255, 255, 255, 0.12)',
      borderStrong: 'rgba(255, 255, 255, 0.22)',
      highlight: 'rgba(255, 255, 255, 0.18)',
      // Top specular rim — the brightest hairline at a glass surface's top edge
      specular: 'rgba(255, 255, 255, 0.42)',
    },
    thermal: {
      core: '#FF3B30',
      corona: '#FF9500',
      glow: ['#FF3B30', '#FF9500'] as [string, string],
      // Translucent thermal layers for additive build-up (plus-lighter analog)
      coreSoft: 'rgba(255, 59, 48, 0.32)',
      coronaSoft: 'rgba(255, 149, 0, 0.18)',
      bleed: 'rgba(255, 79, 40, 0.10)',
    },
    cool: {
      // Cool atmospheric bleed for environmental depth
      bleed: 'rgba(20, 90, 200, 0.10)',
      bleedStrong: 'rgba(30, 110, 220, 0.16)',
    },
  },

  physics: {
    dragResistance: 0.15,
    // Per llc-react/kinetic-utility — Liquid Glass standard
    spring: {
      stiffness: 180,
      damping: 12,
      mass: 1.2,
    },
    // Per llc-react/gpu-acceleration — Slow-In / Snap-Out
    motionCurve: [0.23, 1, 0.32, 1] as const,
    quartOut: Easing.bezier(0.23, 1, 0.32, 1),
    // Thermal Glow phases (interaction-physics.md)
    thermal: {
      excitation: 50,   // ms
      dissipation: 300, // ms
    },
  },

  spacing: {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 40,
  },

  layout: {
    minutesToHeight: 4,
    snapIncrement: 5,
    radius: {
      s: 10,
      m: 16,
      l: 22,
      xl: 28,
    },
    hairline: 1,
  },

  shadows: {
    // Soft ambient drop — base elevation
    lifted: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.45,
      shadowRadius: 24,
      elevation: 12,
    },
    // Thermal-tinted shadow — radiating energy
    thermal: {
      shadowColor: '#FF3B30',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 24,
      elevation: 10,
    },
    // Inset specular — simulates light catching the top edge of glass
    inset: {
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 0,
      elevation: 0,
    },
  },

  typography: {
    display: { fontFamily: 'Montserrat-Bold', fontSize: 56, letterSpacing: -1.2 },
    h1: { fontFamily: 'Montserrat-Bold', fontSize: 28, letterSpacing: 2 },
    h2: { fontFamily: 'Montserrat-Bold', fontSize: 18, letterSpacing: 1.5 },
    body: { fontFamily: 'OpenSans-Regular', fontSize: 14, letterSpacing: 0.2 },
    caption: { fontFamily: 'OpenSans-Light', fontSize: 11, letterSpacing: 1.8 },
    micro: { fontFamily: 'OpenSans-Light', fontSize: 9, letterSpacing: 2.2 },
  },
};
