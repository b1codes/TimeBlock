import React from 'react';
import { render } from '@testing-library/react-native';
import App from '../src/App';

describe('App', () => {
  it('renders the NoiseBackground component', () => {
    const { getByTestId, queryByTestId } = render(<App />);
    // We haven't added testID to NoiseBackground yet, but we can check if it exists in the tree.
    // Better: let's add a testID to NoiseBackground in our implementation or check for it here.
    // For now, I'll just check if it's in the snapshot or if I can find it by type if possible.
    // But since I'm doing TDD, I'll write a test that fails.
    
    // Let's assume we'll give it a testID="noise-background"
    expect(queryByTestId('noise-background')).toBeTruthy();
  });
});
