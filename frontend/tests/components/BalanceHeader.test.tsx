import React from 'react';
import { render } from '@testing-library/react-native';
import { BalanceHeader } from '../../src/components/BalanceHeader';

describe('BalanceHeader', () => {
  it('should display the correct unassigned minutes', () => {
    const { getByText } = render(<BalanceHeader unassignedMinutes={15} />);
    expect(getByText('Unassigned: 15m')).toBeTruthy();
  });
});
