/**
 * O3 QA: map markers use latitude/longitude from the API in [lat, lng] order.
 */
import { render, screen } from '@testing-library/react';
import ApplicationMarker from '@/components/home/ApplicationMarker';
import type { Application } from '@/lib/api';

jest.mock('leaflet', () => ({
  __esModule: true,
  default: { divIcon: (options: { html: string }) => ({ options }) },
}));

jest.mock('react-leaflet', () => ({
  Marker: ({ position, icon, children }: any) => (
    <div
      data-testid="marker"
      data-lat={position[0]}
      data-lng={position[1]}
      data-icon={icon.options.html}
    >
      {children}
    </div>
  ),
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
}));

const base = {
  id: 7,
  latitude: 43.238949,
  longitude: 76.889709,
  category: 'food',
  description: 'Нужна помощь продуктами',
  is_sos: false,
} as unknown as Application;

describe('ApplicationMarker', () => {
  it('places the marker at [latitude, longitude]', () => {
    render(<ApplicationMarker application={base} />);
    const marker = screen.getByTestId('marker');
    expect(Number(marker.dataset.lat)).toBe(43.238949);
    expect(Number(marker.dataset.lng)).toBe(76.889709);
  });

  it('shows coordinates in the popup rounded to 4 decimals', () => {
    render(<ApplicationMarker application={base} />);
    expect(screen.getByText('Координаты: 43.2389, 76.8897')).toBeInTheDocument();
  });

  it('links to the request details', () => {
    render(<ApplicationMarker application={base} />);
    expect(screen.getByRole('link', { name: /Подробнее/ })).toHaveAttribute('href', '/applications/7');
  });

  it.each([
    [90, 180, '90.0000, 180.0000'],
    [-90, -180, '-90.0000, -180.0000'],
    [0, 0, '0.0000, 0.0000'],
  ])('renders boundary coordinates %p, %p', (latitude, longitude, text) => {
    render(<ApplicationMarker application={{ ...base, latitude, longitude }} />);
    expect(screen.getByText(`Координаты: ${text}`)).toBeInTheDocument();
  });

  it('uses the category colour', () => {
    render(<ApplicationMarker application={{ ...base, category: 'medicine' } as Application} />);
    expect(screen.getByTestId('marker').dataset.icon).toContain('#dc3545');
  });

  it('falls back to grey for categories without a colour', () => {
    render(<ApplicationMarker application={{ ...base, category: 'household' } as Application} />);
    expect(screen.getByTestId('marker').dataset.icon).toContain('#6c757d');
  });

  it('marks SOS requests with a badge and a pulsing icon', () => {
    render(<ApplicationMarker application={{ ...base, is_sos: true }} />);
    expect(screen.getByText('SOS')).toBeInTheDocument();
    expect(screen.getByTestId('marker').dataset.icon).toContain('animation: pulse');
  });
});
