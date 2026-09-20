export interface CityData { name: string; region: string; lat: number; lng: number; aliases?: string[] }
export const kazakhstanCities: CityData[] = [
  { name: 'Алматы', region: 'Алматы', lat: 43.2220, lng: 76.8512, aliases: ['Almaty', 'Алма-Ата'] },
  { name: 'Астана', region: 'Астана', lat: 51.1694, lng: 71.4491, aliases: ['Astana', 'Нур-Султан'] },
  { name: 'Шымкент', region: 'Шымкент', lat: 42.3155, lng: 69.5869, aliases: ['Shymkent'] },
  { name: 'Караганда', region: 'Карагандинская область', lat: 49.8047, lng: 73.1094, aliases: ['Қарағанды', 'Karaganda'] },
  { name: 'Актобе', region: 'Актюбинская область', lat: 50.2839, lng: 57.1670, aliases: ['Ақтөбе', 'Aktobe'] },
  { name: 'Тараз', region: 'Жамбылская область', lat: 42.9000, lng: 71.3667, aliases: ['Taraz'] },
  { name: 'Павлодар', region: 'Павлодарская область', lat: 52.2873, lng: 76.9674, aliases: ['Pavlodar'] },
  { name: 'Усть-Каменогорск', region: 'Восточно-Казахстанская область', lat: 49.9483, lng: 82.6275, aliases: ['Өскемен', 'Oskemen'] },
  { name: 'Семей', region: 'Область Абай', lat: 50.4111, lng: 80.2275, aliases: ['Semey', 'Семипалатинск'] },
  { name: 'Атырау', region: 'Атырауская область', lat: 47.0945, lng: 51.9238, aliases: ['Atyrau'] },
  { name: 'Костанай', region: 'Костанайская область', lat: 53.2144, lng: 63.6246, aliases: ['Қостанай', 'Kostanay'] },
  { name: 'Кызылорда', region: 'Кызылординская область', lat: 44.8488, lng: 65.4823, aliases: ['Қызылорда', 'Qyzylorda'] },
  { name: 'Уральск', region: 'Западно-Казахстанская область', lat: 51.2278, lng: 51.3865, aliases: ['Орал', 'Oral', 'Uralsk'] },
  { name: 'Петропавловск', region: 'Северо-Казахстанская область', lat: 54.8753, lng: 69.1628, aliases: ['Петропавл', 'Petropavl'] },
  { name: 'Актау', region: 'Мангистауская область', lat: 43.6511, lng: 51.1975, aliases: ['Ақтау', 'Aktau'] },
  { name: 'Туркестан', region: 'Туркестанская область', lat: 43.2973, lng: 68.2518, aliases: ['Түркістан', 'Turkistan'] },
  { name: 'Кокшетау', region: 'Акмолинская область', lat: 53.2833, lng: 69.3833, aliases: ['Көкшетау', 'Kokshetau'] },
  { name: 'Талдыкорган', region: 'Область Жетісу', lat: 45.0156, lng: 78.3739, aliases: ['Талдықорған', 'Taldykorgan'] },
  { name: 'Жезказган', region: 'Область Ұлытау', lat: 47.7833, lng: 67.7667, aliases: ['Жезқазған', 'Zhezkazgan'] },
  { name: 'Конаев', region: 'Алматинская область', lat: 43.8833, lng: 77.0833, aliases: ['Қонаев', 'Konaev', 'Капчагай'] },
];
const normalize = (value: string) => value.trim().toLocaleLowerCase();
export function searchKazakhstanCities(query: string, startsWith = false): CityData[] {
  const value = normalize(query);
  if (!value) return [];
  return kazakhstanCities.filter(city => [city.name, ...(city.aliases || [])].some(name => (startsWith ? normalize(name).startsWith(value) : normalize(name).includes(value)))).slice(0, 10);
}
export function getCityByName(name: string): CityData | undefined {
  return kazakhstanCities.find(city => [city.name, ...(city.aliases || [])].some(value => normalize(value) === normalize(name)));
}

