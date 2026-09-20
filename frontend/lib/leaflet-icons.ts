import type * as Leaflet from 'leaflet';
export function initLeafletIcons(L: typeof Leaflet) {
  L.Icon.Default.mergeOptions({
    iconUrl: '/leaflet/marker-icon.png',
    iconRetinaUrl: '/leaflet/marker-icon-2x.png',
    shadowUrl: '/leaflet/marker-shadow.png',
  });
}

