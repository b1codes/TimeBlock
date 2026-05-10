import React from 'react';
import { render } from '@testing-library/react-native';
import { NoiseBackground } from '../../src/components/NoiseBackground';

describe('NoiseBackground', () => {
  it('renders correctly', () => {
    const { toJSON } = render(<NoiseBackground />);
    expect(toJSON()).toMatchSnapshot();
  });
});
