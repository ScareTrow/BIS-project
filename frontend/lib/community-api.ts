import { http, ApplicationCategory } from "./api";
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
  quantity_promised: number;
  quantity_delivered: number;
  still_needed: number;
  unpromised: number;
}
export interface Contribution {
  id: number;
  need_id: number;
  response_id: number;
  quantity_promised: number;
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
  city: string;
  category: ApplicationCategory;
  latitude: number;
  longitude: number;
  availability: string;
  last_confirmed_at: string | null;
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
const get = <T>(path: string, params?: object) =>
  http.get<T>(path, { params }).then((r) => r.data);
export const communityApi = {
  capabilities: () => get<Capability[]>("/capabilities"),
  preferences: () =>
    get<{ capability_ids: number[]; is_available: boolean }>(
      "/user/capabilities",
    ),
  savePreferences: (data: {
    capability_ids: number[];
    is_available: boolean;
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
  aid: (id: number) => get<Aid>(`/applications/${id}/aid`),
  contribute: (
    id: number,
    data: {
      need_id: number;
      quantity_promised: number;
      quantity_delivered: number;
    },
  ) => http.put(`/responses/${id}/contributions`, data),
  completeResponse: (id: number) => http.post(`/responses/${id}/complete`),
  rateResponse: (id: number, score: number) =>
    http.post(`/responses/${id}/rating`, { score }),
  resources: (city?: string) => get<Resource[]>("/resources", { city }),
  createResource: (
    data: Omit<
      Resource,
      "id" | "owner_id" | "availability" | "last_confirmed_at"
    >,
  ) => http.post<Resource>("/resources", data).then((r) => r.data),
  remind: (id: number) => http.post(`/resources/${id}/reminders`),
  confirmations: () => get<Confirmation[]>("/resource-confirmations"),
  confirm: (id: number, answer: string) =>
    http.post(`/resource-confirmations/${id}/answer`, { answer }),
  rules: () => get<TriageRule[]>("/admin/triage-rules"),
  addRule: (data: Omit<TriageRule, "id">) =>
    http.post<TriageRule[]>("/admin/triage-rules", data).then((r) => r.data),
  analytics: () => get<Analytics>("/admin/community/analytics"),
};
