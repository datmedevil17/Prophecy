"use client";

import { AuroraBackground } from "@/components/ui/aurora-background";
import { motion } from "motion/react";

export default function Home() {
  return (
    <div className="relative w-full overflow-hidden bg-black">
      <AuroraBackground>
        <motion.div
          initial={{ opacity: 0.0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.3,
            duration: 0.8,
            ease: "easeInOut",
          }}
          className="relative flex flex-col gap-4 items-center justify-center px-4"
        >
          <div className="font-press-start text-xs text-yellow-400 mb-4 tracking-widest uppercase">
            Alpha v0.1
          </div>
          <div className="text-3xl md:text-7xl font-bold dark:text-white text-center font-orbitron tracking-tighter">
            Live Sports. Real Stakes.
          </div>
          <div className="font-sans font-light text-base md:text-xl dark:text-neutral-200 py-4 text-center max-w-lg mx-auto">
            Watch live streams and place your bets in real-time. Experience the future of sports betting.
          </div>
          
          <div className="flex gap-8 mb-8 font-space-grotesk">
             <div className="text-center">
                <div className="text-2xl font-bold text-green-400">$1.2M+</div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Volume</div>
             </div>
             <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">24k+</div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Active Users</div>
             </div>
          </div>

          <a
            href="/streams"
            className="bg-black dark:bg-white rounded-full w-fit text-white dark:text-black px-6 py-3 hover:scale-105 transition-transform font-bold font-orbitron"
          >
            Enter Arena
          </a>
        </motion.div>
      </AuroraBackground>
    </div>
  );
}
