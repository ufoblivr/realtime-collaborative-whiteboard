import { render, screen } from '@testing-library/react';
import Whiteboard from './Whiteboard';

test('renders the whiteboard canvas', () => {
  render(<Whiteboard initialBoardId="test-board" />);
  expect(screen.getByLabelText('Drawing canvas')).toBeInTheDocument();
});
