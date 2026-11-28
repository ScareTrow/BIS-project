import { fireEvent, render, screen, within } from '@testing-library/react';
import AdminApplicationsPage from '../app/admin/applications/page';
import { apiClient } from '../lib/api';
import { useStore } from '../lib/store';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams('status=pending'),
  usePathname: () => '/admin/applications',
}));
jest.mock('next/dynamic', () => () => () => <div data-testid="map" />);
jest.mock('../lib/api', () => ({ apiClient: { getAdminApplications: jest.fn(), getApplication: jest.fn(), setApplicationPriority: jest.fn(), approveApplication: jest.fn() } }));

const pending = {
  id: 2, public_id: 'f520a80b', description: 'Пожилой соседке нужны продукты', category: 'food',
  latitude: 43.2389, longitude: 76.8897, date: '2026-11-28T15:26:31+05:00', status: 'pending',
  moderation_status: 'pending', is_sos: false, is_resolved: false, is_false_call: false, user_id: 3, priority: 0,
  address: 'Алматы, ул. Абая 52', user: { id: 3, first_name: 'Пользователь', email: 'user@asar.local' },
};

beforeEach(() => {
  jest.clearAllMocks();
  useStore.setState({ authLoading: false, language: 'ru', user: { id: 1, email: 'admin@asar.local', first_name: 'Админ', isAdmin: true, is_authenticated: true } as never });
  jest.mocked(apiClient.getAdminApplications).mockResolvedValue([pending] as never);
  jest.mocked(apiClient.getApplication).mockResolvedValue({ ...pending, created_via: 'web', needed_help: 'Крупы и молоко',
    responses: [{ id: 7, responder_id: 5, status: 'pending', created_at: '2026-11-28T16:00:00+05:00', responder: { id: 5, first_name: 'Алия' } }] } as never);
});

test('"Подробнее" expands the request in place instead of navigating away', async () => {
  render(<AdminApplicationsPage />);
  const toggle = await screen.findByRole('button', { name: 'Подробнее' });
  expect(screen.queryByRole('link', { name: 'Открыть' })).toBeNull();
  expect(apiClient.getApplication).not.toHaveBeenCalled();

  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const panel = document.getElementById('application-details-2')!;
  expect(await within(panel).findByText('Алия')).toBeInTheDocument();
  expect(within(panel).getByText('Крупы и молоко')).toBeInTheDocument();
  expect(within(panel).getByText('user@asar.local')).toBeInTheDocument();
  expect(apiClient.getApplication).toHaveBeenCalledWith('f520a80b');
  expect(push).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Свернуть' }));
  expect(document.getElementById('application-details-2')).toBeNull();
});

test('priority saves with one click and only that card changes', async () => {
  jest.mocked(apiClient.setApplicationPriority).mockResolvedValue({} as never);
  render(<AdminApplicationsPage />);
  const select = await screen.findByRole('combobox', { name: 'Приоритет' });
  expect(apiClient.getAdminApplications).toHaveBeenCalledTimes(1);

  fireEvent.change(select, { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  expect(await screen.findByText('Приоритет заявки #2: 3.')).toBeInTheDocument();
  expect(apiClient.setApplicationPriority).toHaveBeenCalledWith(2, 3);
  expect(screen.queryByRole('button', { name: 'Подтвердить' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Сохранить' })).toBeNull();
  expect(select).toHaveValue('3');
  expect(apiClient.getAdminApplications).toHaveBeenCalledTimes(1);
});

test('approving updates the card in place without reloading the list', async () => {
  jest.mocked(apiClient.approveApplication).mockResolvedValue({} as never);
  render(<AdminApplicationsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Подробнее' }));
  fireEvent.click(screen.getByRole('button', { name: /Одобрить/ }));
  expect(await screen.findByText('Заявка #2 одобрена — волонтёры её видят.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Одобрить/ })).toBeNull();
  expect(document.getElementById('application-details-2')).not.toBeNull();
  expect(apiClient.getAdminApplications).toHaveBeenCalledTimes(1);
});
