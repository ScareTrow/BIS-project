import { http, ApplicationCategory, ApplicationRef } from "./api";
export interface Capability {
  id: number;
  code: string;
  name: string;
}
export interface NeedInput {
  resource_name: string;
  unit: string;
  quantity_needed: number;
}
export interface Need extends NeedInput {
  id: number;
  quantity_delivered: number;
  still_needed: number;
  confirmed_by_author?: boolean;
}
export interface Contribution {
  id: number;
  need_id: number;
  response_id: number;
  quantity_delivered: number;
  status: string;
}
export interface Aid {
  needed_help: string | null;
  capabilities: number[];
  needs: Need[];
  contributions: Contribution[];
  response_id: number | null;
  rated_response_ids: number[];
}
export interface Resource {
  id: number;
  owner_id: number;
  name: string;
  description: string;
  address?: string | null;
  city: string;
  category: ApplicationCategory;
  latitude: number;
  longitude: number;
  availability: string;
  last_confirmed_at: string | null;
  moderation_status?: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  photos?: string[];
}
export interface Confirmation {
  id: number;
  resource_id: number;
  answer: string | null;
  expires_at: string;
}
export interface TriageRule {
  id: number;
  category: string | null;
  keyword: string | null;
  priority: string;
  rule_order: number;
  is_active: boolean;
}
export interface Analytics {
  regions: { city: string; count: number }[];
  heatmap: { latitude: number; longitude: number; count: number }[];
}
const get = <T>(path: string, params?: object, signal?: AbortSignal) =>
  http.get<T>(path, { params, signal }).then((r) => r.data);
let capabilities: Promise<Capability[]> | undefined;

export const communityApi = {
  capabilities: () => capabilities ??= get<Capability[]>("/capabilities").catch(error => {
    capabilities = undefined;
    throw error;
  }),
  claimCapabilityOnboarding: () => http.post<{ show: boolean }>("/user/capabilities/onboarding").then(response => response.data),
  preferences: () =>
    get<{ capability_ids: number[]; is_available: boolean }>(
      "/user/capabilities",
    ),
  savePreferences: (data: {
    capability_ids: number[];
    is_available?: boolean;
  }) => http.put("/user/capabilities", data),
  matching: () =>
    get<
      {
        id: number;
        description: string;
        city: string;
        category: ApplicationCategory;
      }[]
    >("/applications/matching"),
  aid: (id: ApplicationRef) => get<Aid>(`/applications/${id}/aid`),
  contribute: (
    id: number,
    data: {
      need_id: number;
      quantity_delivered: number;
    },
  ) => http.put(`/responses/${id}/contributions`, data),
  completeResponse: (id: number) => http.post(`/responses/${id}/complete`),
  rateResponse: (id: number, score: number, comment?: string) =>
    http.post(`/responses/${id}/rating`, { score, ...(comment ? { comment } : {}) }),
  hideReview: (id: number) => http.post(`/admin/reviews/${id}/hide`),
  resources: (category?: string, city?: string, signal?: AbortSignal) => get<Resource[]>("/resources", { category, city }, signal),
  myResources: () => get<Resource[]>('/resources/mine'),
  createResource: (data: FormData) => http.post<Resource>('/resources', data).then(response => response.data),
  resourceReviewQueue: () => get<Resource[]>('/admin/resources'),
  reviewResource: (id: number, decision: 'approved' | 'rejected', reason?: string) =>
    http.post<Resource>(`/admin/resources/${id}/review`, { decision, reason }),
  remind: (id: number) => http.post(`/resources/${id}/reminders`),
  confirmations: () => get<Confirmation[]>("/resource-confirmations"),
  confirm: (id: number, answer: string) =>
    http.post(`/resource-confirmations/${id}/answer`, { answer }),
  rules: () => get<TriageRule[]>("/admin/triage-rules"),
  addRule: (data: Omit<TriageRule, "id">) =>
    http.post<TriageRule[]>("/admin/triage-rules", data).then((r) => r.data),
  analytics: () => get<Analytics>("/admin/community/analytics"),
};
