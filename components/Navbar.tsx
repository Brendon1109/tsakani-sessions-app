"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, LogIn, LogOut, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/services", label: "Services" },
  { href: "/gallery", label: "Gallery" },
  { href: "/shop", label: "Shop" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            setIsAdmin(data?.role === "admin");
          });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    window.location.href = "/";
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-gold-500/20">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/tsakani-logo.png"
              alt="Tsakani Sessions"
              width={40}
              height={40}
              className="w-8 h-8 sm:w-10 sm:h-10"
            />
            <Image
              src="/images/tsakani-words.png"
              alt="Tsakani Sessions"
              width={120}
              height={30}
              className="h-5 sm:h-7 w-auto"
            />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-300 hover:text-gold-500 transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}

            {isAdmin && (
              <Link
                href="/admin"
                className="text-sm font-medium text-gold-500 hover:text-gold-400 transition-colors flex items-center gap-1"
              >
                <Shield size={14} />
                Admin
              </Link>
            )}

            {user ? (
              <div className="flex items-center gap-3">
                {user.user_metadata?.avatar_url && (
                  <Image
                    src={user.user_metadata.avatar_url}
                    alt=""
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full border border-gold-500/30"
                  />
                )}
                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/auth/signin"
                className="text-sm font-medium text-gray-300 hover:text-gold-500 transition-colors flex items-center gap-1"
              >
                <LogIn size={14} />
                Sign In
              </Link>
            )}

            <Link
              href="/events"
              className="bg-gold-gradient text-black text-sm font-semibold px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity"
            >
              Book Now
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-white hover:text-gold-500 transition-colors"
            aria-label={isOpen ? "Close menu" : "Open menu"}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Nav */}
        {isOpen && (
          <div className="md:hidden animate-slide-down pb-6 border-t border-gold-500/10 mt-2">
            <div className="flex flex-col gap-1 pt-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="text-base font-medium text-gray-300 hover:text-gold-500 hover:bg-white/5 px-4 py-3 rounded-lg transition-colors"
                >
                  {link.label}
                </Link>
              ))}

              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setIsOpen(false)}
                  className="text-base font-medium text-gold-500 hover:bg-white/5 px-4 py-3 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Shield size={16} />
                  Admin Panel
                </Link>
              )}

              {user ? (
                <button
                  onClick={() => {
                    handleSignOut();
                    setIsOpen(false);
                  }}
                  className="text-base font-medium text-gray-400 hover:text-white hover:bg-white/5 px-4 py-3 rounded-lg transition-colors text-left flex items-center gap-2"
                >
                  {user.user_metadata?.avatar_url && (
                    <Image
                      src={user.user_metadata.avatar_url}
                      alt=""
                      width={24}
                      height={24}
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  Sign Out
                </button>
              ) : (
                <Link
                  href="/auth/signin"
                  onClick={() => setIsOpen(false)}
                  className="text-base font-medium text-gray-300 hover:text-gold-500 hover:bg-white/5 px-4 py-3 rounded-lg transition-colors flex items-center gap-2"
                >
                  <LogIn size={16} />
                  Sign In
                </Link>
              )}

              <Link
                href="/events"
                onClick={() => setIsOpen(false)}
                className="bg-gold-gradient text-black text-base font-semibold px-4 py-3 rounded-lg text-center mt-2 hover:opacity-90 transition-opacity"
              >
                Book Now
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
