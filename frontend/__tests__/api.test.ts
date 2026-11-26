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
  
  const mockAxios = Object.assign(jest.fn(() => mockAxiosInstance), {
    create: jest.fn(() => mockAxiosInstance),
    post: jest.fn(),
    isAxiosError: (error: { isAxiosError?: boolean }) => error?.isAxiosError === true,
  })
  
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

  it('falls back to the legacy session route during an API rollout', async () => {
    const user = { id: 1, first_name: 'Test' };
    mocks.mockGet.mockRejectedValueOnce({ isAxiosError: true, response: { status: 404 } });
    mocks.mockGet.mockResolvedValueOnce({ data: { user } });

    await expect(apiClient.getSession()).resolves.toEqual({ user });
    expect(mocks.mockGet.mock.calls.map(([path]: [string]) => path)).toEqual(['/auth/session', '/user/current']);
  });

  it('does not retry when the session is unauthenticated', async () => {
    const error = { isAxiosError: true, response: { status: 401 } };
    mocks.mockGet.mockRejectedValueOnce(error);

    await expect(apiClient.getSession()).rejects.toBe(error);
    expect(mocks.mockGet).toHaveBeenCalledTimes(1);
  });

  describe('getApplications', () => {
    it('reads GeoJSON longitude/latitude into map coordinates', async () => {
      mocks.mockGet.mockResolvedValue({ data: { type: 'FeatureCollection', features: [{
        id: 7, geometry: { type: 'Point', coordinates: [76.8512, 43.222] },
        properties: { description: 'Need help', status: 'open' },
      }] } });
      const result = await apiClient.getApplications(false, 'Алматы', 'open');
      expect(result[0]).toEqual({ id: 7, description: 'Need help', status: 'open', latitude: 43.222, longitude: 76.8512 });
      expect(mocks.mockGet).toHaveBeenCalledWith('/map/points', { params: { city: 'Алматы', status: 'open', format: 'geojson' } });
    });

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
