/**
 * O3 QA: client-side checks of the "new request" form.
 *
 * Spec: description up to 1000 characters, up to 3 photos, each up to 10 MB.
 * `it.failing` marks checks the form does not perform yet (see QA_O3_REPORT.md);
 * they start failing the run once the check is implemented.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NewApplicationPage from '@/app/applications/new/page';
import { apiClient } from '@/lib/api';

const MIB = 1024 * 1024;

jest.mock('next/dynamic', () => () => () => null);
jest.mock('next/navigation', () => {
  // Stable router: the page lists `router` in an effect's dependencies.
  const router = { push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() };
  return { useRouter: () => router, usePathname: () => '/applications/new' };
});

jest.mock('@/lib/i18n', () => ({ useTranslation: () => (key: string) => key }));
jest.mock('@/lib/store', () => {
  // Stable object: the page re-runs an effect whenever `user` changes identity.
  const state = {
    user: { is_authenticated: true, city: 'Almaty' },
    authLoading: false,
    language: 'ru',
    setShouldRefreshApplications: jest.fn(),
  };
  return { useStore: () => state };
});
jest.mock('@/lib/community-api', () => ({
  communityApi: { capabilities: jest.fn().mockResolvedValue([]) },
}));
jest.mock('@/lib/api', () => ({
  apiClient: { createApplication: jest.fn().mockResolvedValue({ id: 1 }) },
}));

const createApplication = apiClient.createApplication as jest.Mock;

function fakeFile(name: string, size: number, type = 'image/jpeg') {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function fillAndSubmit(files: File[], description = 'Нужна помощь продуктами') {
  const { container } = render(<NewApplicationPage />);
  fireEvent.change(screen.getByLabelText('Опишите ситуацию'), { target: { value: description } });
  fireEvent.change(container.querySelector('input[type=file]')!, { target: { files } });
  fireEvent.submit(container.querySelector('form')!);
}

async function expectRejected() {
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(createApplication).not.toHaveBeenCalled();
}

async function expectSent() {
  await waitFor(() => expect(createApplication).toHaveBeenCalledTimes(1));
}

beforeEach(() => createApplication.mockClear());

describe('New request form: files', () => {
  it('sends three 9.9 MB photos as multipart', async () => {
    const photos = [1, 2, 3].map((i) => fakeFile(`p${i}.jpg`, Math.floor(9.9 * MIB)));
    fillAndSubmit(photos);
    await expectSent();
    const body = createApplication.mock.calls[0][0] as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.getAll('media_files')).toHaveLength(3);
    expect(body.get('latitude')).toBe('43.222');
    expect(body.get('longitude')).toBe('76.8512');
  });

  it('accepts a 10.0 MB photo', async () => {
    fillAndSubmit([fakeFile('p.jpg', 10 * MIB)]);
    await expectSent();
  });

  it('rejects an empty file', async () => {
    fillAndSubmit([fakeFile('empty.jpg', 0)]);
    await expectRejected();
  });

  it('rejects a file over 50 MiB (current limit)', async () => {
    fillAndSubmit([fakeFile('big.jpg', 50 * MIB + 1)]);
    await expectRejected();
  });

  it.failing('rejects a 10.1 MB photo (spec limit, O3-BUG-04)', async () => {
    fillAndSubmit([fakeFile('p.jpg', Math.floor(10.1 * MIB))]);
    await expectRejected();
  });

  it.failing('rejects a fourth photo (O3-BUG-02)', async () => {
    fillAndSubmit([1, 2, 3, 4].map((i) => fakeFile(`p${i}.jpg`, 1024)));
    await expectRejected();
  });

  it('restricts the picker to images', () => {
    const { container } = render(<NewApplicationPage />);
    expect(container.querySelector('input[type=file]')).toHaveAttribute('accept', 'image/*');
  });

  it.failing('rejects an .exe even if the picker filter is bypassed (O3-BUG-06)', async () => {
    fillAndSubmit([fakeFile('setup.exe', 1024, 'application/x-msdownload')]);
    await expectRejected();
  });
});

describe('New request form: coordinates', () => {
  it.failing('does not send latitude 0 when the field is cleared (O3-BUG-08)', async () => {
    const { container } = render(<NewApplicationPage />);
    fireEvent.change(screen.getByLabelText('Опишите ситуацию'), { target: { value: 'Нужна помощь' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Широта' }), { target: { value: '' } });
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(createApplication).toHaveBeenCalledTimes(1));
    expect(createApplication.mock.calls[0][0].latitude).not.toBe(0);
  });
});

describe('New request form: description', () => {
  it('sends a 1000-character description', async () => {
    fillAndSubmit([fakeFile('p.jpg', 1024)], 'а'.repeat(1000));
    await expectSent();
    expect((createApplication.mock.calls[0][0] as FormData).get('description')).toHaveLength(1000);
  });

  it.failing('limits the description field to 1000 characters (O3-BUG-01)', () => {
    render(<NewApplicationPage />);
    expect(screen.getByLabelText('Опишите ситуацию')).toHaveAttribute('maxLength', '1000');
  });
});
