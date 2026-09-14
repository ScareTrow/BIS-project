/**
 * Тесты для API клиента
 */

// Мокаем axios перед импортом api
const mockGet = jest.fn()
const mockPost = jest.fn()

jest.mock('axios', () => {
  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    interceptors: {
      response: {
        use: jest.fn(),
      },
    },
  }
  
  const mockAxios = jest.fn(() => mockAxiosInstance)
  mockAxios.create = jest.fn(() => mockAxiosInstance)
  mockAxios.post = jest.fn()
  
  return {
    __esModule: true,
    default: mockAxios,
  }
})

// Импортируем после мока
import axios from 'axios'
import { apiClient } from '../lib/api'

// Получаем доступ к мокам через созданный инстанс
const getMocks = () => {
  const instance = (axios as any).create()
  return {
    mockGet: instance.get,
    mockPost: instance.post,
  }
}

describe('API Client', () => {
  let mocks: ReturnType<typeof getMocks>

  beforeEach(() => {
    jest.clearAllMocks()
    mocks = getMocks()
  })

  describe('getApplications', () => {
    it('should fetch applications', async () => {
      const mockData = [{ id: 1, description: 'Test' }]
      mocks.mockGet.mockResolvedValue({ data: mockData })

      const result = await apiClient.getApplications()
      expect(result).toEqual(mockData)
      expect(mocks.mockGet).toHaveBeenCalled()
    })

    it('should fetch applications with city filter', async () => {
      const mockData = [{ id: 1, city: 'Almaty' }]
      mocks.mockGet.mockResolvedValue({ data: mockData })

      const result = await apiClient.getApplications(false, 'Almaty')
      expect(result).toEqual(mockData)
      expect(mocks.mockGet).toHaveBeenCalled()
    })
  })

  describe('login', () => {
    it('should login user', async () => {
      const mockResponse = {
        success: true,
        user: { id: 1, email: 'test@example.com' },
      }
      mocks.mockPost.mockResolvedValue({ data: mockResponse })

      const result = await apiClient.login('test@example.com', 'password')
      expect(result).toEqual(mockResponse)
      expect(mocks.mockPost).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password',
      })
    })
  })

  describe('signup', () => {
    it('should signup new user', async () => {
      const mockResponse = {
        success: true,
        user: { id: 1, email: 'new@example.com' },
      }
      mocks.mockPost.mockResolvedValue({ data: mockResponse })

      const result = await apiClient.signup({
        email: 'new@example.com',
        firstName: 'New',
        password1: 'Test1234!@#$',
        password2: 'Test1234!@#$',
        phone: '+77001234567',
        city: 'Almaty',
      })
      expect(result).toEqual(mockResponse)
      expect(mocks.mockPost).toHaveBeenCalled()
    })
  })

  describe('createApplication', () => {
    it('should create application', async () => {
      const mockResponse = { id: 1, description: 'Test app' }
      mocks.mockPost.mockResolvedValue({ data: mockResponse })

      const result = await apiClient.createApplication({
        latitude: 43.2220,
        longitude: 76.8512,
        category: 'food',
        description: 'Test app',
      })
      expect(result).toEqual(mockResponse)
      expect(mocks.mockPost).toHaveBeenCalledWith('/applications', {
        latitude: 43.2220,
        longitude: 76.8512,
        category: 'food',
        description: 'Test app',
      })
    })
  })
})
