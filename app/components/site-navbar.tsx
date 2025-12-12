"use client";

import { FloatingNav } from "@/components/ui/floating-navbar";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState } from "react";

export function SiteNavbar() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
        <div className="hidden md:flex items-center">
          {isMounted && (
            <WalletMultiButton
              style={{
                backgroundColor: "#18181b", // zinc-900
                color: "white",
                borderRadius: "0px",
                border: "2px solid #18181b",
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                boxShadow: "4px 4px 0px 0px rgba(0,0,0,0.2)",
              }}
            />
          )}
        </div>
      }
    />
  );
}
