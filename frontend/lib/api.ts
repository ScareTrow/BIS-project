import axios from 'axios';

export type ApplicationCategory = 'food' | 'medicine' | 'shelter' | 'emergency' | 'clothing' | 'household' | 'delivery' | 'volunteering' | 'social_project';

export interface User {
  id: number; email: string; first_name: string; last_name?: string | null;
  isAdmin: boolean; is_super_admin?: boolean; is_authenticated?: boolean;
  avatar?: string | null; city?: string | null; city_hidden?: boolean;
  social_links?: string | null; telegram_id?: string | null;
  rating_sum: number; rating_count: number; average_rating?: number; badge?: string | null;
  is_blocked?: boolean; blocked_until?: string | null; blocked_reason?: string | null;
  capability_onboarding_seen?: boolean;
}
export interface ApplicationResponse {
  id: number; responder_id: number; status: string; created_at: string;
  responder?: Pick<User, 'id' | 'first_name' | 'last_name' | 'avatar'> | null;
}
export interface ResponseRating { response_id: number; score: number; comment?: string }
export type ApplicationStatus = 'active' | 'open' | 'in_progress' | 'completed';
export type ApplicationRef = string | number;
export interface LocationPoint { address: string; latitude: number; longitude: number }
export interface DeliveryRoute {
  pickup: LocationPoint & { entrance: string };
  dropoff: LocationPoint & { entrance: string };
}
export interface Application {
  id: number; number?: number; description: string; category: ApplicationCategory;
  latitude: number; longitude: number; date: string; status: string;
  lifecycle?: string; rating_pending?: boolean; moderated_at?: string | null; user_response?: ApplicationResponse | null;
  moderation_status?: string; rejection_reason?: string | null; is_sos: boolean; is_resolved: boolean; is_false_call: boolean;
  user_id: number; priority: number; city?: string | null; region?: string | null;
  location?: string; address?: string; expires_at?: string | null; duration_days?: number;
  needed_help?: string | null; delivery_details?: DeliveryRoute | null;
  creator?: { id: number; first_name: string; last_name?: string | null; avatar?: string | null };
  media_files?: { id: number; file_path: string; file_type: string }[];
  responses?: ApplicationResponse[];
  author_contact?: { phone: string | null };
  is_own?: boolean;
  public_id?: string;
}
export interface Notification {
  id: number; title: string; message: string; notification_type: string;
  is_read: boolean; created_at: string; related_application_id?: number | null;
  related_application_public_id?: string | null;
  related_application_category?: ApplicationCategory | null;
}
interface AuthResult { success: boolean; user: User; message?: string }
interface MapFeatures {
  type: 'FeatureCollection';
  features: { id: number; geometry: { type: 'Point'; coordinates: [number, number] }; properties: Application }[];
}
interface Result { success: boolean; message?: string; id?: number; public_id?: string; error?: string }
export interface NewsItem {
  id: number; title: string; content: string; news_type: string; is_published: boolean;
  created_at: string; updated_at: string; author: { id: number; first_name: string; last_name?: string | null };
}
type NewsInput = { title: string; content: string; news_type: string; is_published: boolean };
export const http = axios.create({ baseURL: '/api', withCredentials: true });
http.interceptors.response.use(
  response => response,
  error => {
    const detail = error.response?.data;
    error.message = detail?.error || detail?.message || error.message;
    return Promise.reject(error);
  },
);
const get = <T>(path: string, params?: object): Promise<T> => http.get<T>(path, { params }).then(r => r.data);
const post = <T = Result>(path: string, body?: unknown): Promise<T> => http.post<T>(path, body).then(r => r.data);

export const apiClient = {
  searchLocations: (query: string, city = '') => post<LocationPoint[]>('/locations/search', { query, city }),
  reverseLocation: (latitude: number, longitude: number) => post<LocationPoint>('/locations/reverse', { latitude, longitude }),
  getApplications: async (_forceRefresh = false, city?: string, status: ApplicationStatus = 'active') => {
    const data = await get<MapFeatures | Application[]>('/map/points', { city, status, format: 'geojson' });
    if (Array.isArray(data)) return data;
    return data.features.map(feature => ({ ...feature.properties, id: feature.id,
      latitude: feature.geometry.coordinates[1], longitude: feature.geometry.coordinates[0] }));
  },
  getApplicationsList: (params: { city?: string; status: ApplicationStatus; category?: ApplicationCategory; q?: string; limit: number; offset: number }) =>
    get<Application[]>('/applications/list', params),
  getApplication: (id: ApplicationRef) => get<Application>('/applications/' + id),
  createApplication: (data: FormData | { latitude: number; longitude: number; category: string; description: string; expires_days?: number }) => post('/applications', data),
  createSOS: (data: FormData) => post('/sos', data),
  getVolunteerLocation: () => get<{ latitude: number | null; longitude: number | null }>('/user/location'),
  saveVolunteerLocation: (latitude: number, longitude: number) => http.put('/user/location', { latitude, longitude }),
  clearVolunteerLocation: () => http.delete('/user/location'),
  login: (email: string, password: string) => post<AuthResult>('/auth/login', { email, password }),
  signup: (data: { email: string; firstName: string; lastName?: string; password1: string; password2: string; phone: string; city: string; cityHidden?: boolean; telegram_id?: string }) => post<AuthResult>('/auth/signup', data),
  logout: () => post('/auth/logout'),
  getSession: async () => {
    try {
      return await get<{ user: User }>('/auth/session');
    } catch (error) {
      // The frontend and API deploy independently.
      if (!axios.isAxiosError(error) || error.response?.status !== 404) throw error;
      return get<{ user: User }>('/user/current');
    }
  },
  getCurrentUser: () => get<{ user: User; name_changes_remaining: number; total_applications: number; active_applications: number; help_given: number }>('/user/current'),
  getUser: (id: number) => get<User & { is_super_admin: boolean; is_blocked: boolean; average_rating: number; total_applications: number; active_applications: number; resolved_applications: number; false_calls_count: number; help_given: number; help_total: number; received_ratings: { id: number; rating_value: number; comment: string; created_at: string; rater: { first_name: string; last_name?: string } }[] }>('/users/' + id),
  getUserApplications: (limit = 10, offset = 0) => get<{ applications: Application[]; total: number }>('/user/applications', { limit, offset }),
  getUserResponses: (limit = 10, offset = 0) => get<{ applications: Application[]; total: number }>('/user/responses', { limit, offset }),
  updateProfile: (data: FormData) => post('/profile/edit', data),
  getNotifications: () => get<{ notifications: Notification[]; unread_count: number }>('/notifications'),
  markNotificationRead: (id: number) => post('/notifications/' + id + '/read'),
  markAllNotificationsRead: () => post('/notifications/read-all'),
  getRegionalStats: (city?: string) => get<{ total: number; active: number; emergency: number; city: string }>('/stats/regional', { city }),
  getTelegramBotInfo: () => get<{ bot_url?: string; bot_username?: string }>('/telegram-bot-info'),
  createTelegramLink: () => post<{ bot_url: string; expires_in: number }>('/telegram/link'),
  getAdminCounts: () => get<{ pending_applications: number; pending_sos: number; pending_resources: number }>('/admin/counts'),
  getAdminStats: () => get<{ total_applications: number; pending_applications: number; approved_applications: number; rejected_applications: number; total_responses: number; volunteers_count: number; false_calls_count: number; category_stats: { category: string; count: number }[] }>('/admin/stats'),
  getAdminUsers: () => get<(User & { total_applications: number; resolved_applications: number; false_calls_count: number; help_given: number; average_rating: number; is_super_admin: boolean; is_blocked: boolean })[]>('/admin/users'),
  getAdminApplications: (status = 'all', params?: { user_id?: number; limit?: number; offset?: number; q?: string }) =>
    get<Application[]>('/admin/applications', { status, ...params }),
  approveApplication: (id: ApplicationRef) => post('/admin/applications/' + id + '/approve'),
  rejectApplication: (id: ApplicationRef, reason: string) => post('/admin/applications/' + id + '/reject', { reason }),
  markFalseApplication: (id: ApplicationRef) => post('/admin/applications/' + id + '/mark-false'),
  setApplicationPriority: (id: ApplicationRef, priority: number) => post('/admin/applications/' + id + '/set-priority', { priority }),
  makeAdmin: (id: number) => post('/admin/users/' + id + '/make-admin'),
  blockUser: (id: number, days: number, reason: string) => post('/admin/users/' + id + '/block', { days, reason }),
  unblockUser: (id: number) => post('/admin/users/' + id + '/unblock'),
  deleteUser: (id: number) => post('/admin/users/' + id + '/delete'),
  respondToApplication: (id: ApplicationRef) => post('/applications/' + id + '/respond'),
  acceptResponse: (id: ApplicationRef, responseId: number) => post('/applications/' + id + '/responses/' + responseId + '/accept'),
  rejectResponse: (id: ApplicationRef, responseId: number) => post('/applications/' + id + '/responses/' + responseId + '/reject'),
  resolveApplication: (id: ApplicationRef, ratings?: ResponseRating[]) =>
    post('/applications/' + id + '/resolve', ratings ? { ratings } : undefined),
  rateVolunteer: (id: ApplicationRef, helper_id: number, is_positive: boolean) => post('/applications/' + id + '/rate-volunteer-simple', { helper_id, is_positive }),
  getNews: (limit = 20, offset = 0) => get<{ news: NewsItem[]; total: number }>('/news', { limit, offset }),
  getSingleNews: (id: number) => get<NewsItem>('/news/' + id),
  getAdminNews: () => get<{ news: NewsItem[]; total: number }>('/admin/news'),
  createNews: (data: NewsInput) => post('/admin/news', data),
  updateNews: (id: number, data: Partial<NewsInput>) => http.put('/admin/news/' + id, data).then(r => r.data),
  deleteNews: (id: number) => http.delete('/admin/news/' + id).then(r => r.data),
};

