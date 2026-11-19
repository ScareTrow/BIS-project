import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AboutPage from '../app/about/page';
import ResourcesPage from '../app/resources/page';
import { CurrentLocationControl, useCurrentLocation } from '../components/common/CurrentLocationControl';
import { communityApi } from '../lib/community-api';
import { useStore } from '../lib/store';

jest.mock('../components/common/AddressPicker', () => ({ onChange }: {
  onChange: (point: { address: string; latitude: number; longitude: number }) => void;
}) => <button type="button" onClick={() => onChange({ address: 'Абая 10', latitude: 43, longitude: 76 })}>Выбрать точку</button>);
jest.mock('../lib/community-api', () => ({ communityApi: {
  myResources: jest.fn().mockResolvedValue([]), confirmations: jest.fn().mockResolvedValue([]), createResource: jest.fn(),
} }));

const user = { id: 1, email: 'test@example.com', first_name: 'Test', city: 'Алматы',
  is_authenticated: true, isAdmin: false, rating_sum: 0, rating_count: 0 };

beforeEach(() => {
  jest.clearAllMocks();
  useStore.setState({ user: null, authLoading: false, language: 'ru' });
});

test('guests can go to the home map and sign in to offer a resource', () => {
  render(<ResourcesPage />);
  expect(screen.getByRole('link', { name: /на главной/ })).toHaveAttribute('href', '/#request-map');
  expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/login?next=%2Fresources');
  expect(screen.queryByRole('button', { name: 'Тип ресурса' })).not.toBeInTheDocument();
  expect(communityApi.myResources).not.toHaveBeenCalled();
});

test('offers submit selected coordinates and a photo and show moderation status', async () => {
  useStore.setState({ user });
  jest.mocked(communityApi.createResource).mockResolvedValue({
    id: 2, owner_id: 1, name: 'Питьевая вода', city: 'Алматы', description: '', latitude: 43, longitude: 76,
    category: 'food', availability: 'available', last_confirmed_at: null, moderation_status: 'pending',
  });
  render(<ResourcesPage />);
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Питьевая вода' } });
  fireEvent.click(screen.getByRole('button', { name: 'Выбрать точку' }));
  const proof = new File(['test'], 'proof.png', { type: 'image/png' });
  await userEvent.upload(screen.getByLabelText(/Фото точки/), proof);
  fireEvent.click(screen.getByRole('button', { name: 'Отправить на проверку' }));
  await waitFor(() => expect(communityApi.createResource).toHaveBeenCalledTimes(1));
  expect(jest.mocked(communityApi.createResource).mock.calls[0][0].get('latitude')).toBe('43');
  expect(jest.mocked(communityApi.createResource).mock.calls[0][0].get('media_files')).toMatchObject({ name: 'proof.png' });
  expect(await screen.findByText('На модерации')).toBeInTheDocument();
});

test('about changes its call to action when signed in', () => {
  render(<AboutPage />);
  expect(screen.getByRole('link', { name: 'Регистрация' })).toHaveAttribute('href', '/sign-up');
  act(() => useStore.setState({ user }));
  expect(screen.queryByRole('link', { name: 'Регистрация' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Открыть карту' })).toHaveAttribute('href', '/#request-map');
});

test('location tracking starts only when requested and stops when hidden', () => {
  const watchPosition = jest.fn(() => 42);
  const clearWatch = jest.fn();
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { watchPosition, clearWatch } });
  function Control() { return <CurrentLocationControl {...useCurrentLocation()} />; }
  render(<Control />);
  expect(watchPosition).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Показать, где я' }));
  expect(watchPosition).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Скрыть моё местоположение' }));
  expect(clearWatch).toHaveBeenCalledWith(42);
});
