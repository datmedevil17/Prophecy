"use client";

import { FloatingNav } from "@/components/ui/floating-navbar";
import { Wallet } from "lucide-react";

export function SiteNavbar() {
  const navItems = [
    { name: "Home", link: "/" },
    { name: "Streams", link: "/streams" },
    { name: "Dashboard", link: "/dashboard" },
    { name: "History", link: "/history" },
    { name: "Profile", link: "/profile" },
  ];

  return (
    <FloatingNav
      navItems={navItems}
      className=""
      actions={
        <button className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white px-4 py-2 rounded-full font-medium transition-all shadow-lg hover:shadow-cyan-500/20">
          <Wallet className="h-4 w-4" />
          <span>Connect Wallet</span>
        </button>
      }
    />
  );
}
