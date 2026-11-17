/**
 * Тесты для компонента Header
 */
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import Header from '../../components/layout/Header'

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
  },
}))

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
