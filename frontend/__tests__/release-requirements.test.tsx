import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import NewApplicationPage from '../app/applications/new/page';
import SOSDialog from '../components/home/SOSDialog';
import HomePage from '../app/page';
import { apiClient } from '../lib/api';
import { useStore } from '../lib/store';

const mockPush = jest.fn();
const mockRouter = { push: mockPush };
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter, usePathname: () => '/' }));
jest.mock('next/dynamic', () => () => function Map({ onLocationSelect }: { onLocationSelect?: (latitude: number, longitude: number) => void }) {
  return <button type="button" onClick={() => onLocationSelect?.(0, 0)}>Выбрать точку</button>;
});
jest.mock('../components/home/MapView', () => () => <div>Карта</div>);
jest.mock('../components/home/ListView', () => () => <div>Список</div>);
jest.mock('../components/home/CursorEffect', () => ({ children }: { children: React.ReactNode }) => <div>{children}</div>);
jest.mock('../lib/community-api', () => ({ communityApi: { capabilities: jest.fn().mockResolvedValue([]) } }));
jest.mock('../lib/api', () => ({ apiClient: {
  searchLocations: jest.fn(), createApplication: jest.fn(), createSOS: jest.fn(), getApplications: jest.fn().mockResolvedValue([]),
  getApplicationsList: jest.fn().mockResolvedValue([]), getRegionalStats: jest.fn().mockResolvedValue({ total: 0, active: 0, emergency: 0 }),
} }));

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  useStore.setState({ authLoading: false, viewMode: 'map', shouldRefreshApplications: false, user: {
    id: 1, first_name: 'Test', email: 'test@example.com', city: 'Алматы',
    isAdmin: false, is_authenticated: true, rating_sum: 0, rating_count: 0,
  } });
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
    getCurrentPosition: jest.fn((_success, failure) => failure({ code: 1 })),
  } });
});

async function fillRequest() {
  render(<NewApplicationPage />);
  await screen.findByLabelText('Город');
  fireEvent.change(screen.getByLabelText('Опишите ситуацию и какая помощь нужна'), { target: { value: 'Нужна помощь с продуктами' } });
}

function submitRequest() {
  fireEvent.submit(screen.getByRole('button', { name: 'Отправить на проверку' }).closest('form')!);
}

test('requires a selected location and keeps zero coordinates valid', async () => {
  await fillRequest();
  const input = screen.getByLabelText<HTMLInputElement>(/Фото:/);
  fireEvent.change(input, { target: { files: [new File(['png'], 'proof.png', { type: 'image/png' })] } });
  submitRequest();
  expect(await screen.findByRole('alert')).toHaveTextContent('Найдите адрес');
  expect(apiClient.createApplication).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Выбрать точку' }));
  jest.mocked(apiClient.createApplication).mockResolvedValue({ success: true, id: 42 });
  submitRequest();
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/applications/42'));
  const data = jest.mocked(apiClient.createApplication).mock.calls[0][0];
  expect(data).toBeInstanceOf(FormData);
  if (data instanceof FormData) expect(data.get('latitude')).toBe('0');
});

test.each([
  ['no photo', [], 'от 1 до 3'],
  ['four photos', Array.from({ length: 4 }, () => new File(['png'], 'proof.png', { type: 'image/png' })), 'от 1 до 3'],
  ['empty photo', [new File([], 'proof.png', { type: 'image/png' })], 'пуст'],
  ['renamed executable', [new File(['exe'], 'proof.exe')], 'JPEG'],
  ['oversized photo', [new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'proof.png', { type: 'image/png' })], '10 МБ'],
])('rejects %s before sending', async (_label, files, error) => {
  await fillRequest();
  fireEvent.click(screen.getByRole('button', { name: 'Выбрать точку' }));
  fireEvent.change(screen.getByLabelText(/Фото:/), { target: { files } });
  submitRequest();
  expect(await screen.findByRole('alert')).toHaveTextContent(error);
  expect(apiClient.createApplication).not.toHaveBeenCalled();
});

test('one description field is bounded and coordinates cannot be entered manually', async () => {
  await fillRequest();
  const description = screen.getByLabelText('Опишите ситуацию и какая помощь нужна');
  expect(description).toHaveAttribute('minLength', '10');
  expect(description).toHaveAttribute('maxLength', '1000');
  expect(screen.getAllByRole('textbox').filter(node => node.tagName === 'TEXTAREA')).toHaveLength(1);
  expect(screen.queryByLabelText('Широта')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Долгота')).not.toBeInTheDocument();
});

test('SOS supports manual location after denied geolocation and preserves data on error', async () => {
  const created = jest.fn();
  render(<SOSDialog onClose={jest.fn()} onCreated={created} />);
  expect(screen.getByRole('status')).toHaveTextContent('Выберите точку');
  expect(screen.getByRole('button', { name: 'Подтвердить и отправить SOS' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Выбрать точку' }));
  const input = screen.getByLabelText<HTMLInputElement>(/Фото:/);
  const photo = new File(['png'], 'proof.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [photo] } });
  jest.mocked(apiClient.createSOS).mockRejectedValueOnce(new Error('Лимит SOS достигнут'));
  fireEvent.submit(screen.getByRole('button', { name: 'Подтвердить и отправить SOS' }).closest('form')!);
  expect(await screen.findByRole('alert')).toHaveTextContent('Лимит SOS');
  expect(created).not.toHaveBeenCalled();
  expect(input.files?.[0]).toBe(photo);
  jest.mocked(apiClient.createSOS).mockResolvedValueOnce({ success: true, id: 7 });
  fireEvent.submit(screen.getByRole('button', { name: 'Подтвердить и отправить SOS' }).closest('form')!);
  await waitFor(() => expect(created).toHaveBeenCalledWith(7, [0, 0]));
});

test('status selection reaches the map API', async () => {
  render(<HomePage />);
  fireEvent.change(screen.getByLabelText('Статус заявки'), { target: { value: 'in_progress' } });
  await waitFor(() => expect(apiClient.getApplications).toHaveBeenCalledWith(false, 'Алматы', 'in_progress'));
});


test('address search selects a location and submits its address without coordinate inputs', async () => {
  await fillRequest();
  jest.mocked(apiClient.searchLocations).mockResolvedValueOnce([{ address: 'Алматы, Абая 10', latitude: 43.23, longitude: 76.91 }]);
  fireEvent.change(screen.getByLabelText('Адрес или название здания'), { target: { value: 'Абая 10' } });
  expect(apiClient.searchLocations).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Найти' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Алматы, Абая 10' }));
  fireEvent.change(screen.getByLabelText(/Фото:/), { target: { files: [new File(['png'], 'proof.png', { type: 'image/png' })] } });
  jest.mocked(apiClient.createApplication).mockResolvedValueOnce({ success: true, id: 80 });
  submitRequest();
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/applications/80'));
  const data = jest.mocked(apiClient.createApplication).mock.calls[0][0] as FormData;
  expect(data.get('address')).toBe('Алматы, Абая 10');
  expect(data.get('latitude')).toBe('43.23');
  expect(data.has('needed_help')).toBe(false);
});

test('delivery requires two locations and submits both entrances', async () => {
  await fillRequest();
  fireEvent.change(screen.getByLabelText('Категория'), { target: { value: 'delivery' } });
  const from = screen.getByRole('region', { name: 'Откуда забрать' });
  const to = screen.getByRole('region', { name: 'Куда доставить' });
  fireEvent.click(within(from).getByRole('button', { name: 'Выбрать точку' }));
  submitRequest();
  expect(await screen.findByRole('alert')).toHaveTextContent('куда доставить');
  expect(apiClient.createApplication).not.toHaveBeenCalled();
  fireEvent.click(within(to).getByRole('button', { name: 'Выбрать точку' }));
  fireEvent.change(screen.getByLabelText('Подъезд / вход для получения'), { target: { value: 'Со двора' } });
  fireEvent.change(screen.getByLabelText('Подъезд / вход для доставки'), { target: { value: 'Подъезд 2' } });
  fireEvent.change(screen.getByLabelText(/Фото:/), { target: { files: [new File(['png'], 'proof.png', { type: 'image/png' })] } });
  jest.mocked(apiClient.createApplication).mockResolvedValueOnce({ success: true, id: 81 });
  submitRequest();
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/applications/81'));
  const data = jest.mocked(apiClient.createApplication).mock.calls[0][0] as FormData;
  const route = JSON.parse(String(data.get('delivery_details')));
  expect(route.pickup.entrance).toBe('Со двора');
  expect(route.dropoff.entrance).toBe('Подъезд 2');
  expect(route.dropoff.latitude).toBe(0);
});
