import { act, render } from '@testing-library/react';
import NewApplicationPage from '../app/applications/new/page';
import AdminNewsPage from '../app/admin/news/page';
import { useStore } from '../lib/store';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('next/dynamic', () => () => function EmptyMap() { return null; });

test.each([
  ['new request', NewApplicationPage, '/login'],
  ['admin news', AdminNewsPage, '/'],
] as const)('%s waits for session restoration before redirecting', (_name, Page, destination) => {
  mockPush.mockClear();
  useStore.setState({ user: null, authLoading: true });
  const view = render(<Page />);
  expect(mockPush).not.toHaveBeenCalled();
  act(() => useStore.setState({ authLoading: false }));
  expect(mockPush).toHaveBeenCalledWith(destination);
  view.unmount();
});
