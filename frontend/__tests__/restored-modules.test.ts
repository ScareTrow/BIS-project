import fs from 'fs';
import path from 'path';
import { translations, useTranslation } from '../lib/i18n';
import { getCityByName, searchKazakhstanCities } from '../lib/kazakhstanCities';
import { validatePassword } from '../lib/passwordValidation';
import { useStore } from '../lib/store';

test('every literal translation key in the application exists in three languages', () => {
  function visit(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
      entry.isDirectory() ? visit(path.join(dir, entry.name)) :
      entry.name.endsWith('.tsx') ? [path.join(dir, entry.name)] : []);
  }
  for (const file of [...visit('app'), ...visit('components')]) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\bt\(['"]([^'"]+)['"]/g)) {
      expect(translations[match[1]]).toHaveLength(3);
      for (const language of ['ru', 'kk', 'en'] as const)
        expect(useTranslation(language)(match[1])).not.toBe(match[1]);
    }
  }
});

test('city aliases resolve to coordinates and prefix filtering is honored', () => {
  expect(getCityByName('Almaty')?.name).toBe('Алматы');
  expect(getCityByName('Қызылорда')?.lat).toBeCloseTo(44.8488);
  expect(searchKazakhstanCities('Ал', true).map(c => c.name)).toContain('Алматы');
  expect(searchKazakhstanCities('маты', true)).toEqual([]);
});

test('password validation matches backend success and weak-pattern cases', () => {
  expect(validatePassword('Asar8!River2').isValid).toBe(true);
  expect(validatePassword('Test1234!@#$').isValid).toBe(false);
  expect(validatePassword('short').isValid).toBe(false);
});

test('logout clears the session and language changes persist', () => {
  useStore.getState().setUser({ id: 1, email: 'test@example.com', first_name: 'Test', isAdmin: false });
  useStore.getState().setUser(null);
  expect(useStore.getState().user).toBeNull();
  useStore.getState().setLanguage('kk');
  expect(localStorage.getItem('language')).toBe('kk');
  useStore.getState().setLanguage('ru');
});
