export const theme = {
  colors: {
    background: '#FEFEFE',
    text: '#212121',
    primary: '#0D47A1',
    secondary: '#1976D2',
    accent: '#FFC107',
    unallocated: '#F0F0F0',
    border: '#E0E0E0',
    error: '#D32F2F',
  },
  spacing: {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
  },
  layout: {
    minutesToHeight: 4, // 1 minute = 4 logical pixels
    snapIncrement: 5,   // Snap to 5 minutes
  },
  shadows: {
    lifted: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
    }
  }
};
