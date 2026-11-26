/**
 * O3 QA: client-side checks of the "new request" form.
 *
 * Spec: description 10..1000 characters, 1..3 JPEG/PNG photos, each up to 10 MB.
 * Since the merge of main (Nov 2026) the form enforces all of it, so the former
 * O3-BUG-01/02/04/06/08 `it.failing` cases are now regression tests.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NewApplicationPage from '@/app/applications/new/page';
import { apiClient } from '@/lib/api';
import { validateRequestPhotos } from '@/lib/requestValidation';

const MIB = 1024 * 1024;

jest.mock('next/dynamic', () => () => ({ selected, onLocationSelect }: {
  selected: boolean; onLocationSelect: (lat: number, lng: number) => void;
}) => <div>
  <button type="button" aria-pressed={selected} onClick={() => onLocationSelect(43.222, 76.8512)}>Выбрать точку</button>
  <button type="button" onClick={() => onLocationSelect(0, 0)}>Точка 0,0</button>
</div>);
jest.mock('next/navigation', () => {
  // Stable router: the page lists `router` in an effect's dependencies.
  const router = { push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() };
  return { useRouter: () => router, usePathname: () => '/applications/new' };
});

jest.mock('@/lib/store', () => {
  // Stable object: the page re-runs an effect whenever `user` changes identity.
  const state = {
    user: { is_authenticated: true, city: 'Almaty' },
    authLoading: false,
    language: 'ru',
    setShouldRefreshApplications: jest.fn(),
  };
  return { useStore: (selector?: (value: typeof state) => unknown) => selector ? selector(state) : state };
});
jest.mock('@/lib/community-api', () => ({
  communityApi: { capabilities: jest.fn().mockResolvedValue([]) },
}));
jest.mock('@/lib/api', () => ({
  apiClient: { reverseLocation: jest.fn().mockResolvedValue({ address: '' }), createApplication: jest.fn().mockResolvedValue({ id: 1 }) },
}));

const createApplication = apiClient.createApplication as jest.Mock;

function fakeFile(name: string, size: number, type = 'image/jpeg') {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function fillAndSubmit(files: File[], description = 'Нужна помощь продуктами', coords = ['43.222', '76.8512']) {
  const { container } = render(<NewApplicationPage />);
  fireEvent.change(screen.getByLabelText('Опишите ситуацию и какая помощь нужна'), { target: { value: description } });
  if (coords.every(Boolean)) {
    fireEvent.click(screen.getByRole('button', { name: coords[0] === '0' ? 'Точка 0,0' : 'Выбрать точку' }));
  }
  fireEvent.change(container.querySelector('input[type=file]')!, { target: { files } });
  fireEvent.submit(container.querySelector('form')!);
}

async function expectRejected(message?: string) {
  const alert = await screen.findByRole('alert');
  if (message) expect(alert).toHaveTextContent(message);
  expect(createApplication).not.toHaveBeenCalled();
}

async function expectSent() {
  await waitFor(() => expect(createApplication).toHaveBeenCalledTimes(1));
  return createApplication.mock.calls[0][0] as FormData;
}

beforeEach(() => createApplication.mockClear());

describe('New request form: files', () => {
  it('sends three 9.9 MB photos as multipart', async () => {
    const photos = [1, 2, 3].map((i) => fakeFile(`p${i}.jpg`, Math.floor(9.9 * MIB)));
    fillAndSubmit(photos);
    const body = await expectSent();
    expect(body).toBeInstanceOf(FormData);
    expect(body.getAll('media_files')).toHaveLength(3);
    expect(body.get('latitude')).toBe('43.222');
    expect(body.get('longitude')).toBe('76.8512');
  });

  it('accepts a 10.0 MB photo', async () => {
    fillAndSubmit([fakeFile('p.jpg', 10 * MIB)]);
    await expectSent();
  });

  it('accepts a PNG', async () => {
    fillAndSubmit([fakeFile('p.png', 1024, 'image/png')]);
    await expectSent();
  });

  it('rejects an empty file', async () => {
    fillAndSubmit([fakeFile('empty.jpg', 0)]);
    await expectRejected('Файл пуст');
  });

  it('rejects a 10.1 MB photo', async () => {
    fillAndSubmit([fakeFile('p.jpg', Math.floor(10.1 * MIB))]);
    await expectRejected('Файл слишком большой (максимум 10 МБ)');
  });

  it('rejects a fourth photo', async () => {
    fillAndSubmit([1, 2, 3, 4].map((i) => fakeFile(`p${i}.jpg`, 1024)));
    await expectRejected('Приложите от 1 до 3 фотографий JPEG/PNG');
  });

  it('requires at least one photo', async () => {
    fillAndSubmit([]);
    await expectRejected('Приложите от 1 до 3 фотографий JPEG/PNG');
  });

  it('restricts the picker to JPEG/PNG', () => {
    const { container } = render(<NewApplicationPage />);
    const input = container.querySelector('input[type=file]')!;
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,.jpg,.jpeg,.png');
    expect(input).toBeRequired();
  });

  it('rejects an .exe even if the picker filter is bypassed', async () => {
    fillAndSubmit([fakeFile('setup.exe', 1024, 'application/x-msdownload')]);
    await expectRejected('Поддерживаются только JPEG и PNG');
  });
});

describe('Photo validation helper (shared with the SOS dialog)', () => {
  it.each([
    ['photo.JPG', 'image/jpeg', null],
    ['photo.jpeg', '', null],
    ['photo.gif', 'image/gif', 'Поддерживаются только JPEG и PNG'],
    ['photo.jpg', 'image/gif', 'Поддерживаются только JPEG и PNG'],
    ['photo.jpg.exe', 'application/octet-stream', 'Поддерживаются только JPEG и PNG'],
  ])('%s (%s)', (name, type, expected) => {
    expect(validateRequestPhotos([fakeFile(name, 1024, type)])).toBe(expected);
  });

  it('accepts exactly 10 MiB and rejects one byte more', () => {
    expect(validateRequestPhotos([fakeFile('p.jpg', 10 * MIB)])).toBeNull();
    expect(validateRequestPhotos([fakeFile('p.jpg', 10 * MIB + 1)])).toBe('Файл слишком большой (максимум 10 МБ)');
  });
});

describe('New request form: coordinates', () => {
  it('does not send a request when no point is selected', async () => {
    fillAndSubmit([fakeFile('p.jpg', 1024)], 'Нужна помощь продуктами', ['', '76.8512']);
    await expectRejected('Найдите адрес или выберите точку на карте');
  });

  it('starts without preset coordinates', () => {
    render(<NewApplicationPage />);
    expect(screen.getByRole('button', { name: 'Выбрать точку' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('sends 0,0 when chosen explicitly', async () => {
    fillAndSubmit([fakeFile('p.jpg', 1024)], 'Нужна помощь продуктами', ['0', '0']);
    const body = await expectSent();
    expect([body.get('latitude'), body.get('longitude')]).toEqual(['0', '0']);
  });
});

describe('New request form: description', () => {
  it('sends a 1000-character description', async () => {
    fillAndSubmit([fakeFile('p.jpg', 1024)], 'а'.repeat(1000));
    const body = await expectSent();
    expect(body.get('description')).toHaveLength(1000);
  });

  it('limits the description field to 1000 characters', () => {
    render(<NewApplicationPage />);
    expect(screen.getByLabelText('Опишите ситуацию и какая помощь нужна')).toHaveAttribute('maxLength', '1000');
  });

  it('rejects a description shorter than 10 characters', async () => {
    fillAndSubmit([fakeFile('p.jpg', 1024)], 'короткое');
    await expectRejected('Описание должно содержать от 10 до 1000 символов');
  });
});
