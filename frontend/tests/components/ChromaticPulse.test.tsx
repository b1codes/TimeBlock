import React from 'react';
import { render } from '@testing-library/react-native';
import { ChromaticPulse } from '../../src/components/ChromaticPulse';
import { SkeletonTaskCard } from '../../src/components/SkeletonTaskCard';

describe('ChromaticPulse & SkeletonTaskCard', () => {
  it('should render ChromaticPulse without crashing', () => {
    const { toJSON } = render(
      <ChromaticPulse style={{ width: 100, height: 20 }} testID="chromatic-pulse" />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('should render SkeletonTaskCard component', () => {
    const { getByTestId } = render(<SkeletonTaskCard />);
    expect(getByTestId('skeleton-task-card')).toBeTruthy();
  });
});
