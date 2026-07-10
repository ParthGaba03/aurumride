"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { api, type Booking, type Driver } from "@/lib/api";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white/8 px-2 py-1 text-[11px] font-semibold text-white/80 ring-1 ring-white/10">
      {children}
    </span>
  );
}

function formatMoney(n: number) {
  return `₹${Math.round(n)}`;
}

function parseBackendDate(iso: string) {
  const normalized = /[zZ]|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
  return new Date(normalized);
}

function formatDate(iso: string) {
  const d = parseBackendDate(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function TripsPanel() {
  const [items, setItems] = useState<Booking[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ratingByBooking, setRatingByBooking] = useState<Record<number, number>>({});
  const [reviewByBooking, setReviewByBooking] = useState<Record<number, string>>({});

  async function load() {
    setErr(null);
    try {
      const res = await api.myBookings();
      setItems(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="ar-glass p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xl font-black tracking-tight">My Trips</div>
          <div className="text-sm text-white/60">Your booking history</div>
        </div>
        <button
          className="ar-button-ghost px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
          onClick={load}
        >
          Refresh
        </button>
      </div>

      {err && <div className="mt-3 text-sm text-red-200">{err}</div>}
      {!items && !err && <div className="mt-4 text-sm text-white/60">Loading…</div>}

      {items && items.length === 0 && (
        <div className="ar-card mt-4 p-5">
          <div className="text-sm font-semibold">No trips yet</div>
          <div className="text-sm text-white/60 mt-1">Create your first booking from Book Ride.</div>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="mt-4 grid gap-3">
          {items.map((b) => (
            <div key={b.id} className="ar-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-black">#{b.id}</div>
                  <Badge>{b.status.toUpperCase()}</Badge>
                  <Badge>{formatMoney(b.fare_total)}</Badge>
                </div>
                <div className="text-xs text-white/55">{formatDate(b.created_at)}</div>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="ar-card p-3">
                  <div className="text-[11px] font-semibold text-white/60">Pickup</div>
                  <div className="text-sm font-semibold">{b.pickup_address}</div>
                </div>
                <div className="ar-card p-3">
                  <div className="text-[11px] font-semibold text-white/60">Drop</div>
                  <div className="text-sm font-semibold">{b.drop_address}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-white/70">
                  {b.driver_name ? (
                    <span>
                      Driver: <span className="font-semibold">{b.driver_name}</span>{" "}
                      <span className="text-white/45">· {b.driver_vehicle_model}</span>
                    </span>
                  ) : (
                    <span className="text-white/55">Driver not assigned yet</span>
                  )}
                </div>
                {(b.status === "pending" || b.status === "confirmed" || b.status === "approaching") && (
                  <button
                    className="ar-button-ghost px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
                    onClick={async () => {
                      try {
                        await api.cancelBooking(b.id);
                        await load();
                      } catch (e) {
                        setErr(e instanceof Error ? e.message : String(e));
                      }
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
              {(b.status === "completed" || b.status === "cancelled") && (
                <div className="ar-card mt-3 p-3">
                  <div className="text-xs font-semibold text-white/60">Rate your ride</div>
                  {b.user_rating ? (
                    <div className="mt-1 text-sm text-white/80">
                      You rated {b.user_rating}★
                      {b.user_review ? ` · ${b.user_review}` : ""}
                    </div>
                  ) : (
                    <div className="mt-2 grid gap-2">
                      <select
                        className="ar-input px-3 py-2 text-sm"
                        value={ratingByBooking[b.id] ?? ""}
                        onChange={(e) =>
                          setRatingByBooking((prev) => ({ ...prev, [b.id]: Number(e.target.value) }))
                        }
                      >
                        <option value="">Select rating</option>
                        {[5, 4, 3, 2, 1].map((r) => (
                          <option key={r} value={r}>
                            {r}★
                          </option>
                        ))}
                      </select>
                      <input
                        className="ar-input px-3 py-2 text-sm"
                        placeholder="Optional review"
                        aria-label={`Review for booking ${b.id}`}
                        value={reviewByBooking[b.id] ?? ""}
                        onChange={(e) =>
                          setReviewByBooking((prev) => ({ ...prev, [b.id]: e.target.value }))
                        }
                      />
                      <button
                        className="ar-button-ghost px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
                        disabled={!ratingByBooking[b.id]}
                        onClick={async () => {
                          try {
                            await api.rateBooking(b.id, {
                              rating: ratingByBooking[b.id],
                              review: reviewByBooking[b.id] || undefined,
                            });
                            await load();
                          } catch (e) {
                            setErr(e instanceof Error ? e.message : String(e));
                          }
                        }}
                      >
                        Submit rating
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminDriversPanel() {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setErr(null);
    try {
      const profile = await api.myDriverProfile();
      setDriver(profile);
      setName(profile.name);
      setPhone(profile.phone);
      setVehicle(profile.vehicle_model);
      setVehicleNumber(profile.vehicle_number);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="ar-glass p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xl font-black tracking-tight">Driver · Profile</div>
          <div className="text-sm text-white/60">Update your details</div>
        </div>
        <button
          className="ar-button-ghost px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
          onClick={load}
        >
          Refresh
        </button>
      </div>

      {err && <div className="mt-3 text-sm text-red-200">{err}</div>}

      {!driver && !err && <div className="mt-4 text-sm text-white/60">Loading…</div>}

      {driver && (
        <div className="mt-4 max-w-xl rounded-3xl bg-black/15 p-4 ring-1 ring-white/10">
          <div className="text-sm font-black">Your driver details</div>
          <div className="mt-3 grid gap-2">
            <input
              className="ar-input px-3 py-2 text-sm"
              placeholder="Name"
              aria-label="Driver name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="ar-input px-3 py-2 text-sm"
              placeholder="Phone"
              aria-label="Driver phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              className="ar-input px-3 py-2 text-sm"
              placeholder="Car model"
              aria-label="Car model"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
            />
            <input
              className="ar-input px-3 py-2 text-sm"
              placeholder="Vehicle number"
              aria-label="Vehicle number"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
            />
            <div className="text-xs text-white/60">Driver rating: {driver.rating.toFixed(1)}★</div>
            <button
              className="ar-button-primary mt-1 px-4 py-2 text-sm font-black transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setErr(null);
                try {
                  await api.updateMyDriverProfile({ name, phone, vehicle_model: vehicle, vehicle_number: vehicleNumber });
                  await load();
                } catch (e) {
                  setErr(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Saving..." : "Save profile"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminBookingsPanel() {
  const [items, setItems] = useState<Booking[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [otpByBooking, setOtpByBooking] = useState<Record<number, string>>({});

  async function load() {
    setErr(null);
    try {
      setItems(await api.driverBookings());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 3000);
    return () => window.clearInterval(interval);
  }, []);

  async function updateStatus(bookingId: number, status: "confirmed" | "cancelled" | "completed") {
    setUpdatingId(bookingId);
    setErr(null);
    try {
      await api.adminUpdateBookingStatus(bookingId, status);
      await load();
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="ar-glass p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xl font-black tracking-tight">Driver · My Bookings</div>
          <div className="text-sm text-white/60">Bookings assigned to you</div>
        </div>
        <button className="ar-button-ghost px-4 py-2 text-sm font-semibold transition hover:bg-white/10" onClick={load}>
          Refresh
        </button>
      </div>

      {err && <div className="mt-3 text-sm text-red-200">{err}</div>}
      {!items && !err && <div className="mt-4 text-sm text-white/60">Loading…</div>}

      {items && (
        <div className="mt-4 grid gap-3">
          {items.map((b) => (
            <div key={b.id} className="ar-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-black">#{b.id}</div>
                  <Badge>user {b.user_id}</Badge>
                  <Badge>{b.status.toUpperCase()}</Badge>
                  <Badge>{formatMoney(b.fare_total)}</Badge>
                </div>
                <div className="text-xs text-white/55">{formatDate(b.created_at)}</div>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="ar-card p-3">
                  <div className="text-[11px] font-semibold text-white/60">Pickup</div>
                  <div className="text-sm font-semibold">{b.pickup_address}</div>
                </div>
                <div className="ar-card p-3">
                  <div className="text-[11px] font-semibold text-white/60">Drop</div>
                  <div className="text-sm font-semibold">{b.drop_address}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-white/70">
                  Driver: <span className="font-semibold">{b.driver_name || "—"}</span>{" "}
                  <span className="text-white/45">· {b.driver_vehicle_model || "—"}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {b.status === "pending" && (
                    <>
                      <button
                        className="ar-button-primary px-4 py-2 text-sm font-black transition hover:-translate-y-0.5 disabled:opacity-60"
                        disabled={updatingId === b.id}
                        onClick={() => updateStatus(b.id, "confirmed")}
                      >
                        Accept
                      </button>
                      <button
                        className="ar-button-ghost px-4 py-2 text-sm font-black text-white transition hover:bg-white/10 disabled:opacity-60"
                        disabled={updatingId === b.id}
                        onClick={() => updateStatus(b.id, "cancelled")}
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {b.status === "confirmed" && (
                    <div className="rounded-full bg-amber-400/15 px-3 py-2 text-xs font-semibold text-amber-100 ring-1 ring-amber-300/20">
                      Accepted. Approaching starts automatically.
                    </div>
                  )}
                  {b.status === "approaching" && (
                    <div className="flex flex-wrap gap-2">
                      <input
                        className="ar-input w-28 px-3 py-2 text-sm"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="Ride OTP"
                        value={otpByBooking[b.id] ?? ""}
                        onChange={(e) =>
                          setOtpByBooking((prev) => ({
                            ...prev,
                            [b.id]: e.target.value.replace(/\D/g, "").slice(0, 4),
                          }))
                        }
                      />
                      <button
                        className="ar-button-primary px-4 py-2 text-sm font-black transition hover:-translate-y-0.5 disabled:opacity-60"
                        disabled={updatingId === b.id || (otpByBooking[b.id] ?? "").length !== 4}
                        onClick={async () => {
                          setUpdatingId(b.id);
                          setErr(null);
                          try {
                            await api.driverStartRide(b.id, otpByBooking[b.id] ?? "");
                            setOtpByBooking((prev) => ({ ...prev, [b.id]: "" }));
                            await load();
                          } catch (error) {
                            setErr(error instanceof Error ? error.message : String(error));
                          } finally {
                            setUpdatingId(null);
                          }
                        }}
                      >
                        Start journey
                      </button>
                    </div>
                  )}
                  {b.status === "in_progress" && (
                    <div className="rounded-full bg-emerald-400/15 px-3 py-2 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-300/20">
                      Journey running. It will complete automatically.
                    </div>
                  )}
                  {b.status === "completed" && <Badge>Ride completed</Badge>}
                  {b.status === "cancelled" && <Badge>{b.cancellation_reason || "Cancelled"}</Badge>}
                </div>
              </div>
              {(b.user_rating || b.user_review) && (
                <div className="ar-card mt-3 p-3">
                  <div className="text-[11px] font-semibold text-white/60">Passenger feedback</div>
                  <div className="mt-1 text-sm text-white/80">
                    {b.user_rating ? `${b.user_rating} star` : "No rating"}
                    {b.user_review ? ` - ${b.user_review}` : ""}
                  </div>
                </div>
              )}
            </div>
          ))}

          {items.length === 0 && <div className="text-sm text-white/60">No bookings yet.</div>}
        </div>
      )}
    </div>
  );
}

export function AdminAnalyticsPanel() {
  const [items, setItems] = useState<Booking[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      setItems(await api.driverBookings());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    if (!items) return null;
    const total = items.length;
    const revenue = items.reduce((s, b) => s + (b.fare_total || 0), 0);
    const avg = total ? revenue / total : 0;
    const completed = total ? items.filter((b) => b.status === "completed").length / total : 0;
    const byStatus: Record<string, number> = {};
    const byHour: Record<string, number> = {};
    for (const b of items) {
      byStatus[b.status] = (byStatus[b.status] || 0) + 1;
      const h = parseBackendDate(b.created_at).getHours();
      byHour[String(h)] = (byHour[String(h)] || 0) + 1;
    }
    return { total, revenue, avg, completed, byStatus, byHour };
  }, [items]);

  return (
    <div className="ar-glass p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xl font-black tracking-tight">Driver · My Analytics</div>
          <div className="text-sm text-white/60">Insights from your assigned bookings</div>
        </div>
        <button className="ar-button-ghost px-4 py-2 text-sm font-semibold transition hover:bg-white/10" onClick={load}>
          Refresh
        </button>
      </div>

      {err && <div className="mt-3 text-sm text-red-200">{err}</div>}
      {!items && !err && <div className="mt-4 text-sm text-white/60">Loading…</div>}

      {stats && (
        <>
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="ar-glass-2 p-4">
              <div className="text-[11px] font-semibold text-white/60">Total bookings</div>
              <div className="text-2xl font-black">{stats.total}</div>
            </div>
            <div className="ar-glass-2 p-4">
              <div className="text-[11px] font-semibold text-white/60">Revenue</div>
              <div className="text-2xl font-black">{formatMoney(stats.revenue)}</div>
            </div>
            <div className="ar-glass-2 p-4">
              <div className="text-[11px] font-semibold text-white/60">Avg fare</div>
              <div className="text-2xl font-black">{formatMoney(stats.avg)}</div>
            </div>
            <div className="ar-glass-2 p-4">
              <div className="text-[11px] font-semibold text-white/60">Completed</div>
              <div className="text-2xl font-black">{Math.round(stats.completed * 100)}%</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="ar-card p-4 lg:col-span-5">
              <div className="text-sm font-black">Bookings by status</div>
              <div className="mt-3 grid gap-2">
                {Object.entries(stats.byStatus).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between rounded-[14px] bg-white/5 px-3 py-2 ring-1 ring-white/10">
                    <div className="text-sm font-semibold">{k}</div>
                    <Badge>{v}</Badge>
                  </div>
                ))}
              </div>
            </div>
            <div className="ar-card p-4 lg:col-span-7">
              <div className="text-sm font-black">Bookings by hour</div>
              <div className="mt-3 grid grid-cols-6 md:grid-cols-12 gap-2">
                {Array.from({ length: 24 }).map((_, i) => {
                  const v = stats.byHour[String(i)] || 0;
                  const h = i.toString().padStart(2, "0");
                  return (
                    <div key={i} className="rounded-[14px] bg-white/5 p-2 ring-1 ring-white/10">
                      <div className="text-[11px] text-white/60">{h}</div>
                      <div className="text-sm font-black">{v}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


