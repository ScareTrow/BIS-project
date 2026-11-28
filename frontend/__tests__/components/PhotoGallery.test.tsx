import { fireEvent, render, screen } from '@testing-library/react';
import PhotoGallery from '../../components/common/PhotoGallery';
import { useStore } from '../../lib/store';

const photos = [{ src: '/api/uploads/a.jpg', alt: 'Фото 1' }, { src: '/api/uploads/b.png', alt: 'Фото 2' }];

beforeEach(() => useStore.setState({ language: 'ru' }));

test('photos open in a modal on the page, not in a new tab', () => {
  const { container } = render(<PhotoGallery photos={photos} />);
  expect(container.querySelector('a[target="_blank"]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Открыть фото 2' }));
  const dialog = container.querySelector('dialog')!;
  expect(dialog).toHaveAttribute('open');
  expect(dialog.querySelector('img')).toHaveAttribute('src', '/api/uploads/b.png');
  expect(screen.getByText('2 из 2')).toBeInTheDocument();
});

test('arrows cycle photos and Close removes the modal', () => {
  const { container } = render(<PhotoGallery photos={photos} />);
  fireEvent.click(screen.getByRole('button', { name: 'Открыть фото 2' }));
  fireEvent.click(screen.getByRole('button', { name: 'Следующее фото' }));
  expect(container.querySelector('dialog img')).toHaveAttribute('src', '/api/uploads/a.jpg');
  fireEvent.keyDown(container.querySelector('dialog')!, { key: 'ArrowLeft' });
  expect(container.querySelector('dialog img')).toHaveAttribute('src', '/api/uploads/b.png');
  fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
  expect(container.querySelector('dialog')).toBeNull();
});

test('a single photo has no navigation', () => {
  render(<PhotoGallery photos={[photos[0]]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Открыть фото 1' }));
  expect(screen.queryByRole('button', { name: 'Следующее фото' })).toBeNull();
});
