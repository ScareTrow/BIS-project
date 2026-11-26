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

  it('shows the request description in the popup', () => {
    render(<ApplicationMarker application={base} />);
    expect(screen.getByText(base.description)).toBeInTheDocument();
  });

  it('links to the request details', () => {
    render(<ApplicationMarker application={base} />);
    expect(screen.getByRole('link', { name: /Подробнее/ })).toHaveAttribute('href', '/applications/7');
  });

  it.each([
    [90, 180], [-90, -180], [0, 0],
  ])('renders boundary coordinates %p, %p', (latitude, longitude) => {
    render(<ApplicationMarker application={{ ...base, latitude, longitude }} />);
    expect(screen.getByTestId('marker')).toHaveAttribute('data-lat', String(latitude));
    expect(screen.getByTestId('marker')).toHaveAttribute('data-lng', String(longitude));
  });

  it('uses the category colour', () => {
    render(<ApplicationMarker application={{ ...base, category: 'medicine' } as Application} />);
    expect(screen.getByTestId('marker').dataset.icon).toContain('#0f766e');
  });

  it('uses a distinct icon and colour for household requests', () => {
    render(<ApplicationMarker application={{ ...base, category: 'household' } as Application} />);
    expect(screen.getByTestId('marker').dataset.icon).toContain('lucide-wrench');
  });

  it('marks SOS requests with a badge and a pulsing icon', () => {
    render(<ApplicationMarker application={{ ...base, is_sos: true }} />);
    expect(screen.getByText('SOS')).toBeInTheDocument();
    expect(screen.getByTestId('marker').dataset.icon).toContain('application-pin-sos');
  });
});
