"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ROLE_LABEL } from "@/lib/auth/access";
import { useMe } from "@/lib/auth/use-me";
import { NAV_ITEMS } from "@/lib/site";
import { NouriMark } from "./NouriMark";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const me = useMe();
  const user = me?.user ?? null;
  const items = NAV_ITEMS.filter((item) => me?.nav?.includes(item.href));
  // Family members land on their patient's page; give it a menu entry.
  if (user?.role === "family" && me?.home?.startsWith("/patients/")) items.unshift({ href: me.home, label: "My family member", description: "Updates they chose to share" });

  return (
    <header data-reveal className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <nav
        aria-label="Main"
        className={`mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-2xl px-3 py-2.5 transition-all duration-500 sm:px-4 ${
          scrolled || open ? "glass shadow-[0_10px_40px_-12px_rgb(0_0_0/0.6)]" : "border border-transparent"
        }`}
      >
        <Link href="/" className="flex items-center gap-2.5 rounded-xl px-1.5 py-1" onClick={() => setOpen(false)}>
          <NouriMark className="h-7 w-9" />
          <span className="font-display text-xl font-semibold tracking-tight whitespace-nowrap text-white">
            Nouri <span className="font-sans text-base font-medium text-glow-300">Care</span>
          </span>
        </Link>

        <ul className="hidden items-center gap-0.5 xl:flex">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`rounded-xl px-3.5 py-2 text-[0.95rem] font-medium whitespace-nowrap transition-colors ${
                  isActive(item.href) ? "bg-white/[0.07] text-white" : "text-mist-300 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-right leading-tight sm:block">
                <span className="block text-[0.95rem] font-medium whitespace-nowrap text-white">{user.name}</span>
                <span className="block text-xs text-mist-400">{ROLE_LABEL[user.role]}</span>
              </span>
              <LogoutButton className="hidden sm:inline-flex" />
            </>
          ) : (
            me &&
            pathname !== "/login" && (
              <Link
                href="/login"
                className="hidden rounded-xl bg-glow-300 px-4 py-2.5 text-[0.95rem] font-semibold whitespace-nowrap text-night-950 shadow-[0_0_30px_-6px_var(--color-glow-400)] transition hover:bg-glow-200 sm:inline-flex"
              >
                Log in
              </Link>
            )
          )}
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-mist-100 hover:bg-white/5 xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      <div
        id="mobile-nav"
        hidden={!open}
        className="mx-auto mt-2 max-w-7xl rounded-2xl border border-white/[0.08] bg-night-850/[0.97] p-2 backdrop-blur-xl shadow-[0_20px_60px_-20px_rgb(0_0_0/0.8)] xl:hidden"
      >
        <ul className="grid gap-1 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`block rounded-xl px-4 py-3 transition-colors ${
                  isActive(item.href) ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                }`}
              >
                <span className="block text-lg font-semibold text-white">{item.label}</span>
                <span className="block text-sm text-mist-400">{item.description}</span>
              </Link>
            </li>
          ))}
        </ul>
        {user ? (
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/[0.06] px-2 pt-3 pb-1">
            <span className="text-mist-300">
              {user.name} · <span className="text-mist-400">{ROLE_LABEL[user.role]}</span>
            </span>
            <LogoutButton />
          </div>
        ) : (
          <Link href="/login" onClick={() => setOpen(false)} className="mt-1 block rounded-xl px-4 py-3 text-lg font-semibold text-glow-300 hover:bg-white/[0.04]">
            Log in
          </Link>
        )}
      </div>
    </header>
  );
}
