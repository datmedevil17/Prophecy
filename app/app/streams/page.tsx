"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { Users, Play, Loader2 } from "lucide-react"
import { useEffect, useState, useMemo } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { getProvider, getAllStreams } from "@/services/service"

// Helper to extract YouTube ID (reused)
const getYoutubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export default function StreamsPage() {
  const { publicKey, sendTransaction, signTransaction } = useWallet()
  const [streams, setStreams] = useState<any[]>([])
  const [filteredStreams, setFilteredStreams] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"active" | "ended">("active")

  const program = useMemo(
    () => getProvider(publicKey, signTransaction, sendTransaction),
    [publicKey, signTransaction, sendTransaction]
  )

  useEffect(() => {
    const fetchStreams = async () => {
      if (!program) return;
      
      setIsLoading(true);
      try {
        const data = await getAllStreams(program);
        const formattedStreams = data.map((item: any) => {
          const account = item.account;
          const videoId = getYoutubeId(account.streamLink);
          const currentTime = Date.now() / 1000;
          const isLive = account.isActive && currentTime < account.endTime;
          
          return {
            id: account.streamId.toString(),
            title: `${account.teamAName} vs ${account.teamBName}`,
            streamer: account.authority.toBase58().slice(0, 4) + '...' + account.authority.toBase58().slice(-4),
            viewers: 0, 
            thumbnail: videoId 
              ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` 
              : "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop",
            youtubeId: videoId,
            isActive: isLive, 
          }
        });
        
        // Sort by ID descending (newest first)
        formattedStreams.sort((a: any, b: any) => Number(b.id) - Number(a.id));
        
        setStreams(formattedStreams);
      } catch (error) {
        console.error("Error fetching streams:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStreams();
  }, [program]);

  useEffect(() => {
    if (activeTab === "active") {
      setFilteredStreams(streams.filter(s => s.isActive));
    } else {
      setFilteredStreams(streams.filter(s => !s.isActive));
    }
  }, [streams, activeTab]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 pt-24 px-4 sm:px-6 lg:px-8 pb-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4 font-orbitron tracking-wider"
          >
            Live Transmissions
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-zinc-500 text-lg font-mono uppercase tracking-widest text-xs"
          >
            {publicKey ? "Witness the future." : "Connect wallet to view streams"}
          </motion.p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
            <div className="inline-flex border-2 border-zinc-900 bg-white">
                <button
                    onClick={() => setActiveTab("active")}
                    className={`px-6 py-2 text-sm font-bold uppercase tracking-widest transition-colors ${
                        activeTab === "active" 
                        ? "bg-zinc-900 text-white" 
                        : "bg-white text-zinc-500 hover:bg-zinc-100"
                    }`}
                >
                    Active
                </button>
                <button
                    onClick={() => setActiveTab("ended")}
                    className={`px-6 py-2 text-sm font-bold uppercase tracking-widest transition-colors ${
                        activeTab === "ended" 
                        ? "bg-zinc-900 text-white" 
                        : "bg-white text-zinc-500 hover:bg-zinc-100"
                    }`}
                >
                    Ended
                </button>
            </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredStreams.length === 0 && publicKey && (
           <div className="text-center py-12 text-zinc-500 font-mono">
             No {activeTab} streams found. {activeTab === "active" && <Link href="/create" className="text-blue-600 hover:underline">Create one?</Link>}
           </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStreams.map((stream, index) => (
            <motion.div
              key={stream.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {stream.isActive ? (
                <Link href={`/streams/${stream.id}`}>
                    <div className="group relative bg-white border-2 border-zinc-900 rounded-none overflow-hidden hover:shadow-[4px_4px_0px_0px_rgba(37,99,235,1)] transition-all duration-200 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                      {/* Thumbnail */}
                      <div className="aspect-video relative overflow-hidden border-b-2 border-zinc-900">
                        <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 transition-colors z-10" />
                        <img 
                          src={stream.thumbnail} 
                          alt={stream.title}
                          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500 grayscale group-hover:grayscale-0"
                        />
                        <div className="absolute top-3 left-3 z-20">
                          <div className={`px-2 py-1 rounded-none text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-sm text-white border ${stream.isActive ? 'bg-red-600 border-red-800' : 'bg-zinc-600 border-zinc-800'}`}>
                            {stream.isActive && <span className="w-1.5 h-1.5 bg-white animate-pulse" />}
                            {stream.isActive ? "Live" : "Ended"}
                          </div>
                        </div>
                        {/* Play Overlay */}
                        <div className="absolute inset-0 z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <div className="p-3 bg-white border-2 border-zinc-900 text-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <Play className="w-6 h-6 fill-current" />
                            </div>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-4">
                        <h3 className="text-lg font-bold text-zinc-900 mb-1 line-clamp-1 font-mono uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                          {stream.title}
                        </h3>
                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
                          HOST: {stream.streamer}
                        </p>
                        <p className="text-xs text-zinc-400 font-mono mt-1">
                          ID: #{stream.id}
                        </p>
                      </div>
                    </div>
                </Link>
              ) : (
                <div className="group relative bg-zinc-100 border-2 border-zinc-300 rounded-none overflow-hidden opacity-75 cursor-not-allowed">
                   {/* Thumbnail */}
                   <div className="aspect-video relative overflow-hidden border-b-2 border-zinc-300">
                     <img 
                       src={stream.thumbnail} 
                       alt={stream.title}
                       className="w-full h-full object-cover grayscale opacity-50"
                     />
                     <div className="absolute top-3 left-3 z-20">
                       <div className="px-2 py-1 rounded-none text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-sm text-zinc-500 bg-zinc-200 border border-zinc-300">
                         Ended
                       </div>
                     </div>
                   </div>

                   {/* Info */}
                   <div className="p-4">
                     <h3 className="text-lg font-bold text-zinc-500 mb-1 line-clamp-1 font-mono uppercase tracking-tight">
                       {stream.title}
                     </h3>
                     <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">
                       HOST: {stream.streamer}
                     </p>
                     <p className="text-xs text-zinc-400 font-mono mt-1">
                       ID: #{stream.id}
                     </p>
                   </div>
                 </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
