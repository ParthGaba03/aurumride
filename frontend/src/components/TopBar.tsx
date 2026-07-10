"use client";

import { useMemo, useState } from "react";

type Props = {
  onNavigate: (page: string) => void;
  page: string;
  role: string | null;
  email: string | null;
  onLogout: () => void;
};

const PAGES_BASE: Array<{ id: string; label: string }> = [
  { id: "book", label: "Book Ride" },
  { id: "trips", label: "My Trips" },
];

const PAGES_ADMIN: Array<{ id: string; label: string }> = [
  { id: "admin-bookings", label: "Driver - My Bookings" },
  { id: "admin-analytics", label: "Driver - Analytics" },
  { id: "admin-drivers", label: "Driver - Profile" },
];

export function TopBar({ onNavigate, page, role, email, onLogout }: Props) {
  const [open, setOpen] = useState<null | "menu" | "account">(null);
  const displayName = email?.split("@")[0] ?? null;

  const pages = useMemo(() => {
    if (!role) {
      return [
        { id: "login", label: "Login" },
        { id: "register", label: "Register" },
        { id: "forgot-password", label: "Forgot Password" },
      ];
    }
    if (role === "admin") {
      return [...PAGES_ADMIN, { id: "update-password", label: "Update Password" }];
    }
    const base = [...PAGES_BASE];
    base.push({ id: "update-password", label: "Update Password" });
    return base;
  }, [role]);

  return (
    <div className="sticky top-0 z-50 border-b border-white/10 bg-[#080b12]/72 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-linear-to-br from-amber-300 via-cyan-300 to-rose-300 text-sm font-black text-slate-950 ring-1 ring-white/20 shadow-lg shadow-amber-300/10">
            AR
          </div>
          <div>
            <div className="text-sm font-black tracking-tight text-white">AurumRide</div>
            <div className="text-xs text-white/55">Ethical dynamic pricing</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className={
              "ar-button-ghost px-3 py-2 text-sm font-semibold transition hover:bg-white/10 " +
              (open === "menu" ? "bg-white/5" : "")
            }
            onClick={() => setOpen(open === "menu" ? null : "menu")}
          >
            Menu
          </button>
          <button
            className={
              "ar-button-ghost px-3 py-2 text-sm font-semibold transition hover:bg-white/10 " +
              (open === "account" ? "bg-white/5" : "")
            }
            onClick={() => setOpen(open === "account" ? null : "account")}
          >
            {displayName ?? "Account"}
          </button>
        </div>
      </div>

      {open === "menu" && (
        <div className="mx-auto max-w-6xl px-4 pb-3">
          <div className="ar-glass-2 grid gap-2 p-3">
            {pages.map((p) => (
              <button
                key={p.id}
                className={
                  "flex items-center justify-between rounded-2xl px-3 py-2 text-left text-sm font-semibold transition " +
                  (page === p.id
                    ? "bg-linear-to-r from-amber-400/20 to-cyan-400/10 ring-1 ring-amber-300/20"
                    : "hover:bg-white/5")
                }
                onClick={() => {
                  onNavigate(p.id);
                  setOpen(null);
                }}
              >
                <span>{p.label}</span>
                {page === p.id && <span className="text-xs text-amber-200">Active</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {open === "account" && (
        <div className="mx-auto max-w-6xl px-4 pb-4">
          <div className="ar-glass-2 p-4">
            {role ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold">Signed in</div>
                  <div className="text-xs text-white/60">
                    {email} - Role: {role}
                  </div>
                </div>
                <button
                  className="ar-button-primary px-4 py-2 text-sm font-black transition hover:-translate-y-0.5"
                  onClick={() => {
                    onLogout();
                    onNavigate("login");
                    setOpen(null);
                  }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="grid gap-2">
                <button
                  className="ar-button-ghost px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
                  onClick={() => {
                    onNavigate("login");
                    setOpen(null);
                  }}
                >
                  Go to Login
                </button>
                <button
                  className="ar-button-ghost px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
                  onClick={() => {
                    onNavigate("register");
                    setOpen(null);
                  }}
                >
                  Go to Register
                </button>
                <button
                  className="ar-button-ghost px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
                  onClick={() => {
                    onNavigate("forgot-password");
                    setOpen(null);
                  }}
                >
                  Forgot Password
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
