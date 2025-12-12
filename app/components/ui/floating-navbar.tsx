"use client";
import React, { useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "motion/react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const FloatingNav = ({
  navItems,
  className,
  actions,
}: {
  navItems: {
    name: string;
    link: string;
    icon?: React.ReactNode;
  }[];
  className?: string;
  actions?: React.ReactNode;
}) => {
  return (
    <div className="flex justify-center w-full fixed top-4 z-[5000] px-4">
      <motion.div
        initial={{
          opacity: 0,
          y: -20,
        }}
        animate={{
          y: 0,
          opacity: 1,
        }}
        transition={{
          duration: 0.2,
        }}
        className={cn(
          "flex w-full max-w-4xl border-2 border-zinc-900 bg-white rounded-none px-8 py-3 items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
          className
        )}
      >
        <div className="flex items-center space-x-6">
          {navItems.map((navItem: any, idx: number) => (
            <Link
              key={`link=${idx}`}
              href={navItem.link}
              className={cn(
                "relative items-center flex space-x-1 text-zinc-600 hover:text-zinc-900 transition-colors font-mono uppercase tracking-widest text-xs font-bold"
              )}
            >
              <span className="block sm:hidden">{navItem.icon}</span>
              <span className="hidden sm:block">{navItem.name}</span>
            </Link>
          ))}
        </div>
        
        <div className="flex items-center space-x-4">
            {actions}
        </div>
      </motion.div>
    </div>
  );
};
