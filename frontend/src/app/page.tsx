"use client";

import { useEffect, useMemo, useState } from "react";
import type { LatLngLiteral } from "leaflet";
import { TopBar } from "@/components/TopBar";
import { api, ApiError, getEmail, getRole, setEmail, setRole, setToken, type AuthRole } from "@/lib/api";
import { MapHero } from "@/app/_components/MapHero";
import { AdminAnalyticsPanel, AdminBookingsPanel, AdminDriversPanel, TripsPanel } from "@/app/_components/Panels";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

function haversineKm(a: LatLngLiteral, b: LatLngLiteral): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.asin(Math.sqrt(s));
  return R * c * 1.3;
}

function lerpPos(a: LatLngLiteral, b: LatLngLiteral, t: number): LatLngLiteral {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    lat: a.lat + (b.lat - a.lat) * clamped,
    lng: a.lng + (b.lng - a.lng) * clamped,
  };
}

async function reverseGeocode(pos: LatLngLiteral): Promise<string> {
  const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${pos.lat}&lon=${pos.lng}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Could not fetch address");
  const data = (await res.json()) as { display_name?: string };
  return data.display_name || `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
}

async function searchAddress(query: string): Promise<{ label: string; pos: LatLngLiteral } | null> {
  const q = query.trim();
  if (!q) return null;
  const url = `${NOMINATIM_BASE}/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Search failed");
  const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  if (!data.length) return null;
  return {
    label: data[0].display_name,
    pos: { lat: Number(data[0].lat), lng: Number(data[0].lon) },
  };
}

function formatRupees(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}Rs ${Math.abs(n).toFixed(2)}`;
}

function shapImpactClass(n: number): string {
  if (n > 0.01) return "text-amber-200";
  if (n < -0.01) return "text-emerald-200";
  return "text-white/70";
}

function defaultPageForRole(currentRole: string | null): string {
  if (!currentRole) return "login";
  return currentRole === "admin" ? "admin-bookings" : "book";
}

function isAdminPage(p: string): boolean {
  return p === "admin-drivers" || p === "admin-bookings" || p === "admin-analytics";
}

const RIDE_STAGES = [
  { status: "pending", label: "Request sent" },
  { status: "confirmed", label: "Driver assigned" },
  { status: "approaching", label: "Driver approaching" },
  { status: "in_progress", label: "Journey started" },
  { status: "completed", label: "Ride completed" },
] as const;

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [role, setRoleState] = useState<string | null>(null);
  const [email, setEmailState] = useState<string | null>(null);
  const [page, setPage] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authRole, setAuthRole] = useState<AuthRole>("user");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [resetOtp, setResetOtp] = useState("");
  const [resetOtpRequested, setResetOtpRequested] = useState(false);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [pickup, setPickup] = useState<LatLngLiteral | null>(null);
  const [drop, setDrop] = useState<LatLngLiteral | null>(null);
  const [pickupAddress, setPickupAddress] = useState<string>("");
  const [dropAddress, setDropAddress] = useState<string>("");
  const [pickupQuery, setPickupQuery] = useState("");
  const [dropQuery, setDropQuery] = useState("");
  const [addressBusy, setAddressBusy] = useState<null | "pickup" | "drop">(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [latestBooking, setLatestBooking] = useState<null | Awaited<ReturnType<typeof api.createBooking>>>(null);
  const [driverPos, setDriverPos] = useState<LatLngLiteral | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<number | null>(null);
  const [estimatedWait, setEstimatedWait] = useState<number | null>(null);
  const [quote, setQuote] = useState<null | Awaited<ReturnType<typeof api.quote>>>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const activeStatuses = ["pending", "confirmed", "approaching", "in_progress"];
  const latestBookingId = latestBooking?.id;
  const latestBookingStatus = latestBooking?.status;
  const hasActiveRide = !!latestBooking && activeStatuses.includes(latestBooking.status);
  const showRideProgress = !!latestBooking;
  const rideStageIndex = latestBooking
    ? latestBooking.status === "cancelled"
      ? -1
      : Math.max(0, RIDE_STAGES.findIndex((stage) => stage.status === latestBooking.status))
    : -1;
  const liveStatus = latestBooking
    ? latestBooking.status === "cancelled"
      ? "Booking cancelled"
      : RIDE_STAGES.find((stage) => stage.status === latestBooking.status)?.label
    : undefined;

  useEffect(() => {
    const storedRole = getRole();
    const storedEmail = getEmail();
    setRoleState(storedRole);
    setEmailState(storedEmail);
    setPage(defaultPageForRole(storedRole));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!role && page !== "register" && page !== "forgot-password") {
      setPage("login");
      return;
    }
    if (role === "admin" && (page === "book" || page === "trips")) {
      setPage("admin-bookings");
      return;
    }
    if (role === "user" && isAdminPage(page)) {
      setPage("book");
    }
  }, [hydrated, page, role]);

  const distanceKm = useMemo(
    () => (pickup && drop ? haversineKm(pickup, drop) : null),
    [pickup, drop],
  );
  const etaMins = useMemo(
    () => (distanceKm ? Math.max(3, Math.round((distanceKm / 25) * 60)) : null),
    [distanceKm],
  );
  const fare = useMemo(() => (distanceKm ? 50 + distanceKm * 15 : null), [distanceKm]);

  useEffect(() => {
    // reset quote when route changes
    setQuote(null);
    setQuoteErr(null);
  }, [pickup?.lat, pickup?.lng, drop?.lat, drop?.lng]);

  useEffect(() => {
    if (!role) return;
    let mounted = true;
    api
      .nearbyDrivers()
      .then((res) => {
        if (!mounted) return;
        setNearbyDrivers(res.active_drivers);
        setEstimatedWait(res.estimated_wait_minutes);
      })
      .catch(() => {
        if (!mounted) return;
        setNearbyDrivers(null);
        setEstimatedWait(null);
      });
    return () => {
      mounted = false;
    };
  }, [role, pickup?.lat, pickup?.lng]);

  useEffect(() => {
    if (!latestBookingStatus || !pickup || !drop) return;
    if (latestBookingStatus === "cancelled") {
      setDriverPos(null);
      return;
    }
    if (latestBookingStatus === "completed") {
      setDriverPos(drop);
      return;
    }
    if (latestBookingStatus === "pending" || latestBookingStatus === "confirmed") {
      setDriverPos(lerpPos(drop, pickup, 0.1));
      return;
    }

    const target = latestBookingStatus === "approaching" ? pickup : drop;
    if (latestBookingStatus === "in_progress") setDriverPos((current) => current ?? pickup);
    const moveTimer = window.setInterval(() => {
      setDriverPos((prev) => {
        const from = prev ?? (latestBookingStatus === "approaching" ? lerpPos(drop, pickup, 0.1) : pickup);
        const next = lerpPos(from, target, 0.18);
        const remaining = haversineKm(next, target);
        return remaining < 0.08 ? target : next;
      });
    }, 1000);
    return () => {
      window.clearInterval(moveTimer);
    };
  }, [latestBookingStatus, pickup, drop]);

  useEffect(() => {
    if (!latestBookingId || !latestBookingStatus || role !== "user") return;
    if (latestBookingStatus === "completed" || latestBookingStatus === "cancelled") return;
    let active = true;
    const bookingId = latestBookingId;
    const refresh = async () => {
      try {
        const bookings = await api.myBookings();
        if (!active) return;
        const fresh = bookings.find((b) => b.id === bookingId);
        if (!fresh) return;
        setLatestBooking(fresh);
        if (fresh.status === "completed" || fresh.status === "cancelled") {
          setDriverPos(fresh.status === "completed" ? drop : null);
        }
      } catch {
        // no-op
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 3000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [latestBookingId, latestBookingStatus, role, drop]);

  async function loadQuote() {
    if (!pickup || !drop || !distanceKm) return;
    setQuoteErr(null);
    setQuoteBusy(true);
    try {
      const hour = new Date().getHours();
      const q = await api.quote({ distance_km: distanceKm, hour, lat: pickup.lat, lon: pickup.lng });
      setQuote(q);
    } catch (e) {
      setQuoteErr(e instanceof Error ? e.message : String(e));
    } finally {
      setQuoteBusy(false);
    }
  }

  async function confirmBooking() {
    if (!pickup || !drop || !distanceKm || !etaMins || !quote) {
      setToast("Calculate the final AI fare before confirming your booking.");
      setTimeout(() => setToast(null), 3500);
      return;
    }
    setBusy(true);
    try {
      const created = await api.createBooking({
        pickup_address: pickupAddress || `${pickup.lat.toFixed(5)}, ${pickup.lng.toFixed(5)}`,
        drop_address: dropAddress || `${drop.lat.toFixed(5)}, ${drop.lng.toFixed(5)}`,
        pickup_lat: pickup.lat,
        pickup_lon: pickup.lng,
        drop_lat: drop.lat,
        drop_lon: drop.lng,
        distance_km: distanceKm,
        eta_minutes: etaMins,
        fare_total: quote.final_fare,
        base_fare: quote.base_fare,
        original_predicted_fare: quote.model_predicted_fare,
        final_fare: quote.final_fare,
        weather_category: quote.weather.category,
        weather_code: quote.weather.code,
        precip_mm: quote.weather.precip_mm,
        ethical_guardrail_applied: quote.ethical_guardrail_applied,
        ethical_reason: quote.ethical_reason,
        shap_base_value: quote.shap.base_value,
        shap_contributions: quote.shap.contributions,
      });
      setLatestBooking(created);
      setToast(`Booking #${created.id} created (${created.status})`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 3500);
    }
  }

  function humanizeAuthError(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.status === 401) return "Incorrect email or password. Please try again.";
      if (e.status === 409) return "This email is already registered. Please login instead.";
      if (e.status === 404) return "No account found with this email.";
      if (e.status === 400) return e.detail || "The reset OTP is invalid or expired.";
      if (e.status === 429) return "Too many attempts. Request a new OTP.";
      if (e.status === 422) return "Please enter a valid email and a password with at least 8 characters.";
      if (e.detail === "Current password is incorrect") return "Current password is incorrect.";
      if (e.detail === "New password must be different") return "New password must be different from current password.";
      return e.detail || "Something went wrong. Please try again.";
    }
    return e instanceof Error ? e.message : "Something went wrong. Please try again.";
  }

  async function submitAuth(mode: "login" | "register") {
    setAuthError(null);
    if (!authEmail.trim() || !authEmail.includes("@")) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    if (authPassword.length < 8) {
      setAuthError("Password must contain at least 8 characters.");
      return;
    }
    setAuthBusy(true);
    try {
      const response =
        mode === "login"
          ? await api.login(authEmail, authPassword)
          : await api.register(authEmail, authPassword, authRole);

      if (mode === "login" && response.role !== authRole) {
        setAuthError(`This account is not ${authRole}. Please use the correct role option.`);
        return;
      }

      setToken(response.access_token);
      setRole(response.role);
      setEmail(authEmail);
      setRoleState(response.role);
      setEmailState(authEmail);
      setPage(defaultPageForRole(response.role));
      setAuthPassword("");
      setToast(`Welcome, ${authEmail.split("@")[0]}!`);
    } catch (e) {
      setAuthError(humanizeAuthError(e));
    } finally {
      setAuthBusy(false);
      setTimeout(() => setToast(null), 3500);
    }
  }

  async function handleForgotPassword() {
    setAuthError(null);
    if (!authEmail.trim() || !authEmail.includes("@")) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    setAuthBusy(true);
    try {
      const res = await api.forgotPassword(authEmail);
      setToast(res.message);
      setDemoOtp(res.demo_otp ?? null);
      setResetOtpRequested(true);
    } catch (e) {
      setAuthError(humanizeAuthError(e));
    } finally {
      setAuthBusy(false);
      setTimeout(() => setToast(null), 3500);
    }
  }

  async function handleResetPassword() {
    setAuthError(null);
    if (!/^\d{6}$/.test(resetOtp)) {
      setAuthError("Enter the 6-digit reset OTP.");
      return;
    }
    if (authPassword.length < 8) {
      setAuthError("New password must contain at least 8 characters.");
      return;
    }
    setAuthBusy(true);
    try {
      const res = await api.resetPassword(authEmail, resetOtp, authPassword);
      setToast(res.message);
      setResetOtp("");
      setResetOtpRequested(false);
      setDemoOtp(null);
      setAuthPassword("");
      setPage("login");
    } catch (e) {
      setAuthError(humanizeAuthError(e));
    } finally {
      setAuthBusy(false);
      setTimeout(() => setToast(null), 3500);
    }
  }

  async function handleUpdatePassword() {
    setAuthError(null);
    if (!authEmail || authPassword.length < 8) {
      setAuthError("Enter your current password and a new password of at least 8 characters.");
      return;
    }
    setAuthBusy(true);
    try {
      const res = await api.updatePassword(authEmail, authPassword);
      setToast(res.message);
      setAuthEmail("");
      setAuthPassword("");
    } catch (e) {
      setAuthError(humanizeAuthError(e));
    } finally {
      setAuthBusy(false);
      setTimeout(() => setToast(null), 3500);
    }
  }

  async function setPickupWithAddress(pos: LatLngLiteral) {
    setPickup(pos);
    setDrop(null);
    setDropAddress("");
    setAddressBusy("pickup");
    try {
      setPickupAddress(await reverseGeocode(pos));
    } catch {
      setPickupAddress(`${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`);
    } finally {
      setAddressBusy(null);
    }
  }

  async function setDropWithAddress(pos: LatLngLiteral) {
    setDrop(pos);
    setAddressBusy("drop");
    try {
      setDropAddress(await reverseGeocode(pos));
    } catch {
      setDropAddress(`${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`);
    } finally {
      setAddressBusy(null);
    }
  }

  function logout() {
    setToken(null);
    setRole(null);
    setEmail(null);
    setRoleState(null);
    setEmailState(null);
    setPage("login");
  }

  return (
    <div className="min-h-full">
      <TopBar onNavigate={setPage} page={page} role={role} email={email} onLogout={logout} />

      <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        {page === "login" || page === "register" || page === "forgot-password" || page === "update-password" ? (
          <div className="mx-auto grid max-w-5xl items-stretch gap-5 md:grid-cols-[1.05fr_0.95fr]">
            <div className="ar-glass hidden min-h-[520px] overflow-hidden p-7 md:flex md:flex-col md:justify-between">
              <div>
                <div className="inline-flex rounded-full bg-amber-300/12 px-3 py-1 text-xs font-semibold text-amber-100 ring-1 ring-amber-200/20">
                  Ethical AI fare intelligence
                </div>
                <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight text-white">
                  Premium rides with transparent pricing.
                </h1>
                <p className="mt-4 max-w-md text-sm leading-6 text-white/62">
                  AurumRide combines booking, driver workflows, XGBoost fare prediction, SHAP explanations, and auditable ethical surge controls.
                </p>
              </div>
              <div className="grid gap-3">
                {[
                  ["Explainable fare", "SHAP rupee-level contribution breakdown"],
                  ["Ethical guardrails", "Backend surge caps for sensitive weather"],
                  ["Audit ready", "Booking-level pricing trace stored server-side"],
                ].map(([title, body]) => (
                  <div key={title} className="ar-card p-4">
                    <div className="text-sm font-black text-white">{title}</div>
                    <div className="mt-1 text-xs leading-5 text-white/58">{body}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ar-glass p-6 md:p-7">
              <div className="text-2xl font-black tracking-tight">
                {page === "login"
                  ? "Welcome back"
                  : page === "register"
                    ? "Create account"
                    : page === "forgot-password"
                      ? "Reset password"
                      : "Update password"}
              </div>
              <div className="mt-1 text-sm text-white/60">
                {page === "login"
                  ? "Sign in to continue booking rides."
                  : page === "register"
                    ? "Create a new account to start."
                    : page === "forgot-password"
                      ? resetOtpRequested
                        ? "Enter the short-lived OTP and choose a new password."
                        : "Request a short-lived OTP to securely reset your password."
                      : "Change password for your logged-in account."}
              </div>
              <div className="mt-5 grid gap-3">
                {(page === "login" || page === "register") && (
                  <div className="grid grid-cols-2 gap-2 rounded-[16px] bg-black/18 p-1 ring-1 ring-white/10">
                    <button
                      className={
                        "rounded-[12px] px-3 py-2 text-sm font-semibold transition " +
                        (authRole === "user" ? "bg-white/12 text-white shadow-sm" : "text-white/62 hover:bg-white/6")
                      }
                      onClick={() => setAuthRole("user")}
                    >
                      User
                    </button>
                    <button
                      className={
                        "rounded-[12px] px-3 py-2 text-sm font-semibold transition " +
                        (authRole === "admin" ? "bg-white/12 text-white shadow-sm" : "text-white/62 hover:bg-white/6")
                      }
                      onClick={() => setAuthRole("admin")}
                    >
                      Driver
                    </button>
                  </div>
                )}
                <input
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder={page === "update-password" ? "Current password" : "Email"}
                  type={page === "update-password" ? "password" : "text"}
                  aria-label={page === "update-password" ? "Current password" : "Email address"}
                  autoComplete={page === "update-password" ? "current-password" : "email"}
                  className="ar-input w-full px-3 py-3 text-sm placeholder:text-white/38"
                />
                {page === "forgot-password" && resetOtpRequested && (
                  <input
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit OTP"
                    inputMode="numeric"
                    aria-label="Reset OTP"
                    autoComplete="one-time-code"
                    className="ar-input w-full px-3 py-3 text-sm placeholder:text-white/38"
                  />
                )}
                {(page !== "forgot-password" || resetOtpRequested) && (
                  <input
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder={page === "forgot-password" || page === "update-password" ? "New password" : "Password"}
                    type="password"
                    aria-label={page === "forgot-password" || page === "update-password" ? "New password" : "Password"}
                    autoComplete={page === "login" ? "current-password" : "new-password"}
                    className="ar-input w-full px-3 py-3 text-sm placeholder:text-white/38"
                  />
                )}
                {page === "forgot-password" && demoOtp && (
                  <div className="rounded-[14px] bg-amber-400/10 p-3 text-sm text-amber-100 ring-1 ring-amber-300/20">
                    Demo OTP: <span className="font-black tracking-widest">{demoOtp}</span>
                  </div>
                )}
                {authError && <div className="rounded-[14px] bg-red-500/10 p-3 text-sm text-red-200 ring-1 ring-red-300/15">{authError}</div>}
                <button
                  className="ar-button-primary px-4 py-3 text-sm font-black transition hover:-translate-y-0.5 disabled:opacity-60"
                  disabled={authBusy}
                  onClick={async () => {
                    if (page === "login" || page === "register") {
                      await submitAuth(page === "login" ? "login" : "register");
                    } else if (page === "forgot-password") {
                      if (resetOtpRequested) await handleResetPassword();
                      else await handleForgotPassword();
                    } else {
                      await handleUpdatePassword();
                    }
                  }}
                >
                  {authBusy
                    ? "Please wait..."
                    : page === "login"
                      ? "Sign in"
                      : page === "register"
                        ? "Create account"
                        : page === "forgot-password"
                          ? resetOtpRequested
                            ? "Verify OTP and reset"
                            : "Request reset OTP"
                          : "Update password"}
                </button>
                {page === "forgot-password" && resetOtpRequested && (
                  <button
                    className="text-sm text-white/70 underline underline-offset-4 hover:text-white"
                    onClick={() => {
                      setResetOtpRequested(false);
                      setResetOtp("");
                      setDemoOtp(null);
                      setAuthError(null);
                    }}
                  >
                    Request another OTP
                  </button>
                )}
                {(page === "login" || page === "register") && (
                  <div className="grid gap-2 pt-1 text-center">
                    <button
                      className="text-sm text-white/70 underline underline-offset-4 hover:text-white"
                      onClick={() => setPage(page === "login" ? "register" : "login")}
                    >
                      {page === "login" ? "Need an account? Go to Register" : "Already have an account? Go to Login"}
                    </button>
                    <button
                      className="text-sm text-white/70 underline underline-offset-4 hover:text-white"
                      onClick={() => setPage("forgot-password")}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : page === "book" ? (
          <div className="grid gap-5">
            <MapHero
              pickup={pickup}
              drop={drop}
              onPick={(p) => void setPickupWithAddress(p)}
              onDrop={(p) => void setDropWithAddress(p)}
              activeDrivers={nearbyDrivers ?? undefined}
              estimatedWaitMinutes={(hasActiveRide ? latestBooking.eta_minutes : estimatedWait) ?? undefined}
              driverPos={driverPos}
              liveStatus={showRideProgress ? liveStatus : undefined}
            />

            <div className="ar-glass grid gap-4 p-5 md:p-6">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="ar-card grid gap-2 p-3">
                  <div className="text-xs font-semibold text-white/60">Manual pickup search</div>
                  <div className="flex gap-2">
                    <input
                      value={pickupQuery}
                      onChange={(e) => setPickupQuery(e.target.value)}
                      placeholder="Search pickup address"
                      aria-label="Search pickup address"
                      className="ar-input w-full px-3 py-2 text-sm"
                    />
                    <button
                      className="ar-button-ghost px-3 py-2 text-sm font-semibold hover:bg-white/10"
                      onClick={async () => {
                        setSearchError(null);
                        try {
                          const found = await searchAddress(pickupQuery);
                          if (!found) return setSearchError("Pickup address not found.");
                          await setPickupWithAddress(found.pos);
                          setPickupAddress(found.label);
                        } catch {
                          setSearchError("Pickup search failed.");
                        }
                      }}
                    >
                      Search
                    </button>
                  </div>
                </div>
                <div className="ar-card grid gap-2 p-3">
                  <div className="text-xs font-semibold text-white/60">Manual drop search</div>
                  <div className="flex gap-2">
                    <input
                      value={dropQuery}
                      onChange={(e) => setDropQuery(e.target.value)}
                      placeholder="Search drop address"
                      aria-label="Search drop address"
                      className="ar-input w-full px-3 py-2 text-sm"
                    />
                    <button
                      className="ar-button-ghost px-3 py-2 text-sm font-semibold hover:bg-white/10"
                      onClick={async () => {
                        setSearchError(null);
                        try {
                          const found = await searchAddress(dropQuery);
                          if (!found) return setSearchError("Drop address not found.");
                          await setDropWithAddress(found.pos);
                          setDropAddress(found.label);
                        } catch {
                          setSearchError("Drop search failed.");
                        }
                      }}
                    >
                      Search
                    </button>
                  </div>
                </div>
              </div>
              {searchError && <div className="text-sm text-red-300">{searchError}</div>}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-black tracking-tight">Trip Summary</div>
                  <div className="text-sm text-white/60">Pickup → Drop</div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="ar-button-ghost px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
                    onClick={() => {
                      setPickup(null);
                      setDrop(null);
                      setPickupAddress("");
                      setDropAddress("");
                      setLatestBooking(null);
                      setDriverPos(null);
                    }}
                  >
                    Reset
                  </button>
                  <button
                    className="ar-button-ghost px-4 py-2 text-sm font-black text-white transition hover:bg-white/10 disabled:opacity-60"
                    disabled={!pickup || !drop || quoteBusy}
                    onClick={loadQuote}
                  >
                    {quoteBusy ? "Calculating..." : quote ? "Refresh final fare" : "Calculate final fare"}
                  </button>
                  <button
                    className="ar-button-primary px-5 py-2 text-sm font-black transition hover:-translate-y-0.5 disabled:opacity-60"
                    disabled={!pickup || !drop || !quote || busy}
                    onClick={confirmBooking}
                  >
                    {busy ? "Creating..." : "Confirm booking"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="ar-card p-4">
                  <div className="text-xs font-semibold text-white/60">Distance</div>
                  <div className="text-xl font-black">
                    {distanceKm ? `${distanceKm.toFixed(1)} km` : "—"}
                  </div>
                </div>
                <div className="ar-card p-4">
                  <div className="text-xs font-semibold text-white/60">ETA</div>
                  <div className="text-xl font-black">{etaMins ? `${etaMins} mins` : "—"}</div>
                </div>
                <div className="ar-card p-4">
  <div className="text-xs font-semibold text-white/60">
                    {latestBooking ? "Booked Fare" : quote ? "Final AI Fare" : "Estimated Fare"}
  </div>

  <div className="text-xl font-black">
    {latestBooking
      ? `₹${Math.round(latestBooking.fare_total)}`
      : fare
      ? `₹${Math.round(quote ? quote.final_fare : fare)}`
      : "—"}
  </div>
  {!quote && fare && (
    <div className="mt-1 text-[11px] text-white/50">Calculate the final fare before booking.</div>
  )}
</div>
              </div>
              {showRideProgress && latestBooking && (
                <div className="rounded-3xl bg-emerald-500/10 p-4 ring-1 ring-emerald-300/20">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-base font-black">
                      {latestBooking.status === "completed"
                        ? "Your ride is complete"
                        : latestBooking.status === "cancelled"
                          ? latestBooking.cancellation_reason || "Booking cancelled"
                        : latestBooking.status === "pending"
                          ? `Waiting for ${latestBooking.driver_name || "driver"} to accept`
                          : latestBooking.status === "confirmed"
                            ? "Driver accepted your booking"
                            : latestBooking.status === "approaching"
                              ? "Driver is approaching pickup"
                              : "Your ride is in progress"}
                    </div>
                    <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-300/20">
                      {latestBooking.status === "completed"
                        ? "Completed"
                        : latestBooking.status === "cancelled"
                          ? "Cancelled"
                        : latestBooking.status === "in_progress"
                          ? "Journey in progress"
                          : latestBooking.status === "pending"
                            ? "Driver responding"
                            : `ETA ${latestBooking.eta_minutes} min`}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                    {RIDE_STAGES.map((stage, idx) => (
                      <div
                        key={stage.status}
                        className={
                          "rounded-2xl px-3 py-2 text-xs font-semibold ring-1 " +
                          (idx <= rideStageIndex
                            ? "bg-emerald-400/15 text-emerald-100 ring-emerald-300/20"
                            : "bg-white/5 text-white/60 ring-white/10")
                        }
                      >
                        {stage.label}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="ar-card p-3">
                      <div className="text-[11px] font-semibold text-white/60">Driver details</div>
                      <div className="mt-1 text-sm font-semibold">{latestBooking.driver_name || "Driver assigning..."}</div>
                      <div className="text-sm text-white/70">Phone: {latestBooking.driver_phone || "Will be updated shortly"}</div>
                      <div className="text-sm text-white/70">
                        Vehicle: {latestBooking.driver_vehicle_model || "Will be updated shortly"}
                      </div>
                      <div className="text-sm text-white/70">
                        Vehicle No: {latestBooking.driver_vehicle_number || "Will be updated shortly"}
                      </div>
                      {latestBooking.status === "completed" &&
                        latestBooking.user_rating &&
                        latestBooking.driver_rating &&
                        latestBooking.driver_rating > 0 && (
                          <div className="text-sm text-white/70">
                            Updated rating: {latestBooking.driver_rating.toFixed(1)}/5
                          </div>
                        )}
                    </div>
                    <div className="ar-card p-3">
                      <div className="text-[11px] font-semibold text-white/60">Ride details</div>
                      <div className="mt-1 text-sm text-white/80">Booking ID: #{latestBooking.id}</div>
                      <div className="text-sm text-white/80">
                        Fare: ₹{Math.round(latestBooking.fare_total)}
                      </div>
                      <div className="text-sm text-white/80">Status: {latestBooking.status}</div>
                      {latestBooking.cancellation_reason && (
                        <div className="mt-1 text-sm text-amber-100">{latestBooking.cancellation_reason}</div>
                      )}
                      {latestBooking.status === "approaching" && latestBooking.ride_otp && (
                        <div className="mt-3 rounded-2xl bg-amber-400/15 p-3 ring-1 ring-amber-300/20">
                          <div className="text-[11px] font-semibold text-amber-100/70">Share this OTP with driver</div>
                          <div className="mt-1 text-2xl font-black tracking-widest text-amber-100">
                            {latestBooking.ride_otp}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="ar-card p-3">
                  <div className="text-xs font-semibold text-white/60">Pickup address</div>
                  <div className="mt-1 text-sm">
                    {addressBusy === "pickup" ? "Resolving..." : pickupAddress || "Select pickup on map/search"}
                  </div>
                </div>
                <div className="ar-card p-3">
                  <div className="text-xs font-semibold text-white/60">Drop address</div>
                  <div className="mt-1 text-sm">
                    {addressBusy === "drop" ? "Resolving..." : dropAddress || "Select drop on map/search"}
                  </div>
                </div>
              </div>

              {(quoteErr || quote) && (
  <div className="ar-card mt-2 p-4">
    <div className="text-sm font-black">
      Explainable pricing
    </div>

    {quoteErr && (
      <div className="mt-2 text-sm text-red-200">
        {quoteErr}
      </div>
    )}

    {quote && (
      <div className="mt-4 grid gap-4">

        {/* Weather Status */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/8 px-3 py-1 text-[11px] font-semibold ring-1 ring-white/10">
            Weather:{" "}
            {quote.weather.category.replace("_", " ")}
            {quote.weather.precip_mm != null
              ? ` · ${quote.weather.precip_mm} mm/h`
              : ""}
          </span>

          {quote.ethical_guardrail_applied && (
            <span className="rounded-full bg-amber-400/15 px-3 py-1 text-[11px] font-semibold text-amber-100 ring-1 ring-amber-300/15">
              Ethical safeguard applied
            </span>
          )}
        </div>

        {/* Pricing Summary */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

          <div className="ar-card p-4">
            <div className="text-[11px] font-semibold text-white/60">
              Base fare
            </div>

            <div className="mt-1 text-2xl font-black">
              ₹{Math.round(quote.base_fare)}
            </div>
          </div>

          <div className="ar-card p-4">
            <div className="text-[11px] font-semibold text-white/60">
              AI predicted fare
            </div>

            <div className="mt-1 text-2xl font-black">
              {quote.model_predicted_fare < 0
                ? "Below base fare"
                : `₹${Math.round(
                    quote.model_predicted_fare
                  )}`}
            </div>
          </div>

          <div className="ar-card p-4">
            <div className="text-[11px] font-semibold text-white/60">
              Final AI fare
            </div>

            <div className="mt-1 text-2xl font-black text-emerald-300">
              ₹{Math.round(quote.final_fare)}
            </div>
          </div>

        </div>

        {/* Ethical Pricing Insight */}
        <div className="rounded-3xl border border-amber-300/15 bg-amber-400/10 p-5">

          <div className="text-lg font-black text-amber-100">
            Ethical Pricing Insight
          </div>

          <div className="mt-5 grid gap-4">

            <div className="rounded-2xl bg-black/15 p-4">
              <div className="text-sm font-semibold text-white/60">
                Weather category
              </div>

              <div className="mt-1 text-lg font-black capitalize">
                {quote.weather.category.replace("_", " ")}
              </div>
            </div>

            <div className="rounded-2xl bg-black/15 p-4">
              <div className="text-sm font-semibold text-white/60">
                Model predicted fare
              </div>

              <div className="mt-1 text-lg font-black">
                {quote.model_predicted_fare < 0
                  ? "Below safe pricing range"
                  : `₹${Math.round(
                      quote.model_predicted_fare
                    )}`}
              </div>
            </div>

            <div className="rounded-2xl bg-black/15 p-4">
              <div className="text-sm font-semibold text-white/60">
                Blended final fare
              </div>

              <div className="mt-1 text-lg font-black text-emerald-300">
                ₹{Math.round(quote.final_fare)}
              </div>
              <div className="mt-1 text-xs text-white/55">
                70% transparent base fare + 30% model prediction, then safety limits.
              </div>
            </div>

            <div className="rounded-2xl bg-black/15 p-4">
              <div className="text-sm font-semibold text-white/60">
                Reason
              </div>

              <div className="mt-2 text-sm leading-6 text-white/75">
                {quote.ethical_reason ??
                  "AI pricing remained within safe and transparent pricing limits."}
              </div>
            </div>

          </div>
        </div>

        {/* Passenger explanation with optional technical SHAP details */}
        <div className="rounded-3xl border border-cyan-300/15 bg-cyan-400/10 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-lg font-black text-cyan-100">
                How your fare was calculated
              </div>
              <div className="mt-1 text-sm leading-6 text-white/65">
                A transparent distance fare is adjusted slightly using the AI model, then checked by safety rules.
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-black/15 p-4 ring-1 ring-white/10">
              <div className="text-xs font-semibold text-white/55">Distance fare</div>
              <div className="mt-2 text-base font-black text-white">₹{Math.round(quote.base_fare)}</div>
              <div className="mt-1 text-xs text-white/55">
                ₹50 + {distanceKm?.toFixed(1)} km × ₹15
              </div>
            </div>
            <div className="rounded-2xl bg-black/15 p-4 ring-1 ring-white/10">
              <div className="text-xs font-semibold text-white/55">AI adjustment</div>
              <div
                className={
                  "mt-2 text-base font-black " +
                  shapImpactClass(quote.final_fare - quote.base_fare)
                }
              >
                {formatRupees(quote.final_fare - quote.base_fare)}
              </div>
              <div className="mt-1 text-xs text-white/55">Based on time and trip conditions</div>
            </div>
            <div className="rounded-2xl bg-black/15 p-4 ring-1 ring-white/10">
              <div className="text-xs font-semibold text-white/55">Weather</div>
              <div className="mt-2 text-base font-black capitalize text-white">
                {quote.weather.category.replace("_", " ")}
              </div>
              <div className="mt-1 text-xs text-white/55">
                {quote.ethical_guardrail_applied ? "Safety cap applied" : "No weather cap needed"}
              </div>
            </div>
            <div className="rounded-2xl bg-emerald-400/10 p-4 ring-1 ring-emerald-300/20">
              <div className="text-xs font-semibold text-emerald-100/70">You pay</div>
              <div className="mt-2 text-base font-black text-emerald-300">
                ₹{Math.round(quote.final_fare)}
              </div>
              <div className="mt-1 text-xs text-emerald-100/60">Final confirmed fare</div>
            </div>
          </div>

          <details className="mt-4 rounded-2xl bg-black/15 p-4 ring-1 ring-white/10">
            <summary className="cursor-pointer text-sm font-black text-cyan-100">
              Technical SHAP details
            </summary>
            <div className="mt-2 text-xs leading-5 text-white/55">
              SHAP explains the raw model prediction relative to the model&apos;s learned average, not relative to a zero-rupee fare.
            </div>
            {quote.shap.base_value != null && (
              <div className="mt-3 text-xs font-semibold text-white/70">
                Model baseline: Rs {quote.shap.base_value.toFixed(2)}
              </div>
            )}
            <div className="mt-3 grid gap-2">
              {quote.shap.contributions.map((item) => (
                <div
                  key={item.feature}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2"
                >
                  <div className="text-xs font-semibold text-white/75">
                    {item.feature.replaceAll("_", " ")}
                  </div>
                  <div className={"text-xs font-black " + shapImpactClass(item.rupees)}>
                    {formatRupees(item.rupees)}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>

      </div>
    )}
  </div>
)}
            </div>
          </div>
        ) : page === "trips" ? (
          <TripsPanel />
        ) : page === "admin-drivers" ? (
          <AdminDriversPanel />
        ) : page === "admin-bookings" ? (
          <AdminBookingsPanel />
        ) : page === "admin-analytics" ? (
          <AdminAnalyticsPanel />
        ) : (
          <div className="rounded-[28px] ar-glass p-8">
            <div className="text-xl font-black">Unknown page</div>
            <div className="mt-2 text-sm text-white/60">Use the menu to navigate.</div>
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-999 -translate-x-1/2 rounded-full bg-black/35 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 backdrop-blur-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
