"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  ChefHat,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Menu,
  Package2,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { UserProfile } from "@/lib/types";
import { logout } from "@/lib/api";

const AuthContext = createContext<{ user: UserProfile | null }>({ user: null });
export function useAuth() {
  return useContext(AuthContext);
}

const navBase = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/bookings", label: "Bookings & rentals", icon: CalendarDays },
  { href: "/inventory", label: "Inventory catalogue", icon: Package2 },
  { href: "/customers", label: "Customers", icon: UsersRound },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/backend/auth/me/", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Not signed in");
        return (await response.json()) as UserProfile;
      })
      .then((profile) => {
        if (active) setUser(profile);
      })
      .catch(() => {
        if (active) router.replace("/login");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [router]);

  const navItems = useMemo(() => {
    const items = [...navBase];
    if (user?.division.has_catering_services) items.push({ href: "/catering", label: "Catering jobs", icon: ChefHat });
    return items;
  }, [user]);

  async function handleLogout() {
    await logout().catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  if (loading || !user) {
    return (
      <main className="screen-loader">
        <div className="loader-mark"><Package2 size={25} /></div>
        <div className="loader-line" />
        <p>Preparing your workspace</p>
      </main>
    );
  }

  return (
    <AuthContext.Provider value={{ user }}>
      <div className="app-shell">
        {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
        <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
          <div className="brand-lockup">
            <div className="brand-mark"><Package2 size={22} strokeWidth={2.3} /></div>
            <div>
              <div className="brand-name">RentLedger</div>
              <div className="brand-caption">Business workspace</div>
            </div>
            <button className="icon-button sidebar-close" aria-label="Close menu" onClick={() => setMobileNavOpen(false)}><X size={18} /></button>
          </div>

          <div className="workspace-label">WORKSPACE</div>
          <div className="division-card">
            <div className="division-avatar">{(user.division.name || "R").slice(0, 1).toUpperCase()}</div>
            <div className="division-info">
              <strong>{user.division.name}</strong>
              <span>Private business book</span>
            </div>
            <ChevronDown size={15} className="muted-icon" />
          </div>

          <nav className="sidebar-nav" aria-label="Main navigation">
            {navItems.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={`nav-link ${active ? "nav-link-active" : ""}`} onClick={() => setMobileNavOpen(false)}>
                  <Icon size={18} strokeWidth={active ? 2.2 : 1.9} />
                  <span>{item.label}</span>
                  {item.href === "/bookings" && <span className="nav-dot" />}
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-spacer" />
          <div className="sidebar-help">
            <div className="help-icon"><CircleHelp size={18} /></div>
            <div><strong>Need a hand?</strong><span>Keep records up to date</span></div>
          </div>
          <div className="sidebar-user">
            <div className="user-avatar">{(user.first_name || user.username || "U").slice(0, 1).toUpperCase()}</div>
            <div className="sidebar-user-text"><strong>{[user.first_name, user.last_name].filter(Boolean).join(" ") || user.username}</strong><span>{user.role.replaceAll("_", " ")}</span></div>
            <button className="icon-button logout-button" title="Sign out" onClick={handleLogout}><LogOut size={17} /></button>
          </div>
        </aside>

        <div className="main-column">
          <header className="topbar">
            <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
            <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-sep">/</span><strong>{navItems.find((item) => item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`))?.label || "Details"}</strong></div>
            <div className="topbar-right">
              <span className="secure-pill"><span /> Private workspace</span>
              <div className="topbar-avatar">{(user.first_name || user.username || "U").slice(0, 1).toUpperCase()}</div>
            </div>
          </header>
          <main className="page-content">{children}</main>
          <footer className="app-footer"><span>RentLedger</span><span>Records that keep your business moving.</span><span className="footer-user"><WalletCards size={14} /> {user.division.code}</span></footer>
        </div>
      </div>
    </AuthContext.Provider>
  );
}
