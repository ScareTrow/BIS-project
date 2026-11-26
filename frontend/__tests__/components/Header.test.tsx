/**
 * Тесты для компонента Header
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import Header from '../../components/layout/Header'
import { apiClient } from '../../lib/api'
import { useStore } from '../../lib/store'

// Мокаем next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/',
  }),
  usePathname: () => '/',
}))

// Мокаем API
jest.mock('../../lib/api', () => ({
  apiClient: {
    getCurrentUser: jest.fn(),
    logout: jest.fn(),
    getNotifications: jest.fn().mockResolvedValue({ notifications: [], unread_count: 0 }),
  },
}))

afterEach(() => useStore.getState().setUser(null))

test.each([[false, 'Профиль'], [true, 'Админ-панель']])(
  'places logout after the account link and signs out (admin=%s)',
  async (isAdmin, accountLabel) => {
    const user = { id: 1, email: 'user@example.test', first_name: 'User', is_authenticated: true, isAdmin };
    useStore.getState().setUser(user);
    jest.mocked(apiClient.logout).mockResolvedValue({ success: true });

    render(<Header />);

    const logout = screen.getByRole('button', { name: 'Выйти' });
    expect(logout.previousElementSibling).toBe(screen.getByRole('link', { name: accountLabel }));
    expect(logout.nextElementSibling).toContainElement(screen.getByRole('button', { name: 'Ещё' }));

    fireEvent.click(logout);
    await waitFor(() => expect(useStore.getState().user).toBeNull());
    expect(apiClient.logout).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Войти' })).toBeInTheDocument();
  },
);

describe('Header Component', () => {
  it('renders header', () => {
    render(<Header />)
    // Проверяем наличие основных элементов
    const header = screen.getByRole('banner')
    expect(header).toBeInTheDocument()
  })

  it('shows login link when not authenticated', () => {
    const { apiClient } = require('../../lib/api')
    apiClient.getCurrentUser.mockRejectedValue(new Error('Not authenticated'))

    render(<Header />)
    // Должна быть ссылка на вход
    expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/login')
  })
})



test('mobile menu opens, closes with Escape and has no signup link', () => {
  render(<Header />);
  const toggle = screen.getByRole('button', { name: 'Открыть меню' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(toggle);
  expect(screen.getByRole('button', { name: 'Закрыть меню' })).toHaveAttribute('aria-expanded', 'true');
  expect(document.getElementById('mobile-navigation')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Создать аккаунт|Регистрация|Зарегистрироваться/ })).not.toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(document.getElementById('mobile-navigation')).not.toBeInTheDocument();
});
