export type AuthResponse = {
  access_token: string;
  token_type: string;
  role: string;
};

export type AuthRole = "user" | "admin";

export type Booking = {
  id: number;
  user_id: number;
  driver_id: number | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  driver_vehicle_model?: string | null;
  driver_vehicle_number?: string | null;
  driver_rating?: number | null;
  pickup_address: string;
  drop_address: string;
  distance_km: number;
  eta_minutes: number;
  fare_total: number;
  weather_category?: string | null;
  weather_code?: number | null;
  precip_mm?: number | null;
  ethical_guardrail_applied?: boolean;
  ethical_reason?: string | null;
  base_fare?: number | null;
  original_predicted_fare?: number | null;
  final_fare?: number | null;
  shap_base_value?: number | null;
  shap_contributions?: { feature: string; rupees: number }[];
  user_rating?: number | null;
  user_review?: string | null;
  cancellation_reason?: string | null;
  ride_otp?: string | null;
  status: string;
  created_at: string;
};

export type Driver = {
  id: number;
  user_id?: number | null;
  name: string;
  phone: string;
  vehicle_model: string;
  vehicle_number: string;
  rating: number;
  is_active: boolean;
};

export type NearbyDrivers = {
  active_drivers: number;
  estimated_wait_minutes: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aurumride_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (!token) localStorage.removeItem("aurumride_token");
  else localStorage.setItem("aurumride_token", token);
}

export function getRole(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aurumride_role");
}

export function setRole(role: string | null) {
  if (typeof window === "undefined") return;
  if (!role) localStorage.removeItem("aurumride_role");
  else localStorage.setItem("aurumride_role", role);
}

export function getEmail(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aurumride_email");
}

export function setEmail(email: string | null) {
  if (typeof window === "undefined") return;
  if (!email) localStorage.removeItem("aurumride_email");
  else localStorage.setItem("aurumride_email", email);
}

async function parseError(res: Response): Promise<ApiError> {
  let detail = "";
  try {
    const data = (await res.json()) as { detail?: unknown };
    if (typeof data.detail === "string") detail = data.detail;
  } catch {
    detail = await res.text();
  }
  return new ApiError(res.status, detail || "Request failed");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    throw await parseError(res);
  }
  return (await res.json()) as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, role: AuthRole) =>
    request<AuthResponse>("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password, role }) }),
  forgotPassword: (email: string) =>
    request<{ message: string; demo_otp?: string | null }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (email: string, otp: string, new_password: string) =>
    request<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, otp, new_password }),
    }),
  updatePassword: (current_password: string, new_password: string) =>
    request<{ message: string }>("/api/auth/update-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),
  health: () => request<{ status: string }>("/health"),
  createBooking: (payload: {
    pickup_address: string;
    drop_address: string;
    pickup_lat: number;
    pickup_lon: number;
    drop_lat: number;
    drop_lon: number;
    distance_km: number;
    eta_minutes: number;
    fare_total: number;
    base_fare?: number;
    original_predicted_fare?: number;
    final_fare?: number;
    weather_category?: string;
    weather_code?: number | null;
    precip_mm?: number | null;
    ethical_guardrail_applied?: boolean;
    ethical_reason?: string | null;
    shap_base_value?: number | null;
    shap_contributions?: { feature: string; rupees: number }[];
  }) => request<Booking>("/api/bookings/", { method: "POST", body: JSON.stringify(payload) }),
  myBookings: () => request<Booking[]>("/api/bookings/me"),
  adminBookings: () => request<Booking[]>("/api/bookings/admin"),
  driverBookings: () => request<Booking[]>("/api/bookings/driver/me"),
  quote: (params: { distance_km: number; hour: number; lat: number; lon: number }) => {
    const qs = new URLSearchParams({
      distance_km: String(params.distance_km),
      hour: String(params.hour),
      lat: String(params.lat),
      lon: String(params.lon),
    });
    return request<{
      base_fare: number;
      model_predicted_fare: number;
      final_fare: number;
      ethical_guardrail_applied: boolean;
      ethical_reason: string | null;
      weather: { category: string; code: number | null; precip_mm: number | null };
      shap: { base_value: number | null; contributions: { feature: string; rupees: number }[] };
    }>(`/api/pricing/quote?${qs.toString()}`);
  },
  cancelBooking: (bookingId: number) =>
    request<Booking>(`/api/bookings/${bookingId}/cancel`, { method: "POST", body: "{}" }),
  rateBooking: (bookingId: number, payload: { rating: number; review?: string }) =>
    request<Booking>(`/api/bookings/${bookingId}/rate`, { method: "POST", body: JSON.stringify(payload) }),
  adminUpdateBookingStatus: (
    bookingId: number,
    status: "pending" | "confirmed" | "approaching" | "in_progress" | "completed" | "cancelled",
  ) =>
    request<Booking>(`/api/bookings/admin/${bookingId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  driverStartRide: (bookingId: number, otp: string) =>
    request<Booking>(`/api/bookings/admin/${bookingId}/start`, {
      method: "POST",
      body: JSON.stringify({ otp }),
    }),
  adminAssignDriver: (bookingId: number, driverId: number) =>
    request<Booking>(`/api/bookings/admin/${bookingId}/assign_driver`, {
      method: "PATCH",
      body: JSON.stringify({ driver_id: driverId }),
    }),
  listDrivers: () => request<Driver[]>("/api/drivers/"),
  nearbyDrivers: () => request<NearbyDrivers>("/api/drivers/nearby"),
  myDriverProfile: () => request<Driver>("/api/drivers/me"),
  updateMyDriverProfile: (payload: { name?: string; phone?: string; vehicle_model?: string; vehicle_number?: string }) =>
    request<Driver>("/api/drivers/me", { method: "PATCH", body: JSON.stringify(payload) }),
  createDriver: (payload: { name: string; phone: string; vehicle_model: string }) =>
    request<Driver>("/api/drivers/", { method: "POST", body: JSON.stringify(payload) }),
  toggleDriverActive: (driverId: number, is_active: boolean) =>
    request<Driver>(`/api/drivers/${driverId}`, { method: "PATCH", body: JSON.stringify({ is_active }) }),
  deleteDriver: (driverId: number) => request<void>(`/api/drivers/${driverId}`, { method: "DELETE" as const }),
};

