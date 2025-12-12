"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { Users, Play, Loader2, Trophy } from "lucide-react"
import { useEffect, useState, useMemo } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { getProvider, getUsersStreams } from "@/services/service"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"

// Helper to extract YouTube ID
const getYoutubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export default function ProfilePage() {
  const { publicKey, sendTransaction, signTransaction } = useWallet()
  const [streams, setStreams] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const program = useMemo(
    () => getProvider(publicKey, signTransaction, sendTransaction),
    [publicKey, signTransaction, sendTransaction]
  )

  useEffect(() => {
    const fetchUserStreams = async () => {
      if (!program || !publicKey) return;
      
      setIsLoading(true);
      try {
        const data = await getUsersStreams(program, { publicKey } as any);
        const formattedStreams = data.map((item: any) => {
          const account = item.account;
          const videoId = getYoutubeId(account.streamLink);
          return {
            id: account.streamId.toString(),
            title: `${account.teamAName} vs ${account.teamBName}`,
            status: account.isActive ? "Active" : "Ended", // Assuming isActive exists on account based on IDL
            thumbnail: videoId 
              ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` 
              : "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop",
            youtubeId: videoId,
            winningTeam: account.winningTeam,
          }
        });
        
        // Sort by ID descending
        formattedStreams.sort((a: any, b: any) => Number(b.id) - Number(a.id));
        
        setStreams(formattedStreams);
      } catch (error) {
        console.error("Error fetching user streams:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserStreams();
  }, [program, publicKey]);

  if (!publicKey) {
    return (
      <div className="min-h-screen bg-zinc-50 pt-24 pb-12 px-4 flex items-center justify-center">
         <div className="text-center">
            <h1 className="text-2xl font-bold mb-4 font-orbitron">Profile</h1>
            <p className="text-zinc-500 mb-4">Please connect your wallet to view your profile.</p>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 pt-24 px-4 sm:px-6 lg:px-8 pb-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
            <h1 className="text-3xl font-bold font-orbitron text-zinc-900 border-b-2 border-zinc-200 pb-2">
                My Dashboard
            </h1>
            <p className="text-zinc-500 mt-2 font-mono text-sm">
                Managing {streams.length} stream{streams.length !== 1 ? 's' : ''}
            </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && streams.length === 0 && (
           <div className="text-center py-12 bg-white border-2 border-zinc-200 p-8 rounded-none">
             <Trophy className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
             <h3 className="text-lg font-bold text-zinc-900 mb-2">No Streams Created</h3>
             <p className="text-zinc-500 mb-6 max-w-sm mx-auto">You haven't created any prediction markets yet. Start your first stream to engage with the community.</p>
             <Link href="/create">
                <Button className="bg-zinc-900 text-white rounded-none hover:bg-zinc-800">
                    Create New Stream
                </Button>
             </Link>
           </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {streams.map((stream, index) => (
            <motion.div
              key={stream.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
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
                      <div className={`px-2 py-1 rounded-none text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-sm text-white border ${stream.status === 'Active' ? 'bg-green-600 border-green-800' : 'bg-zinc-600 border-zinc-800'}`}>
                        {stream.status === 'Active' && <span className="w-1.5 h-1.5 bg-white animate-pulse" />}
                        {stream.status}
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
                    <p className="text-xs text-zinc-400 font-mono mt-1">
                      ID: #{stream.id}
                    </p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
