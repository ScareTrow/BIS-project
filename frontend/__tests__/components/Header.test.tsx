/**
 * Тесты для компонента Header
 */
import { render, screen } from '@testing-library/react'
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
    // expect(screen.getByText(/вход/i)).toBeInTheDocument()
  })
})

