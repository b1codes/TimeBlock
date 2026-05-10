import React from 'react';
import { render } from '@testing-library/react-native';
import { TaskBlock } from '../../src/components/TaskBlock';
import { theme } from '../../src/styles/theme';

describe('TaskBlock', () => {
  it('should render the title and correct height based on duration', () => {
    const { getByText, getByTestId } = render(
      <TaskBlock task_id="1" title="Research" duration_minutes={30} min_duration={10} isLimitReached={false} />
    );
    
    expect(getByText('Research')).toBeTruthy();
    
    const container = getByTestId('task-block-1');
    expect(container.props.style.some((s: any) => s.height === 30 * theme.layout.minutesToHeight)).toBeTruthy();
  });

  it('should show error border when isLimitReached is true', () => {
    const { getByTestId } = render(
      <TaskBlock task_id="1" title="Research" duration_minutes={10} min_duration={10} isLimitReached={true} />
    );
    const container = getByTestId('task-block-1');
    expect(container.props.style.some((s: any) => s.borderColor === theme.colors.error)).toBeTruthy();
  });
});
