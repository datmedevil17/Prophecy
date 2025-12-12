"use client"

import { useParams } from "next/navigation"
import { motion } from "motion/react"
import { StreamChat } from "@/components/stream-chat"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StockMarket } from "@/components/stock-market"
import { Users, ThumbsUp, Share2, MoreHorizontal, Loader2 } from "lucide-react"
import { useEffect, useState, useMemo } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { getProvider, getStream } from "@/services/service"
import { BN } from "@coral-xyz/anchor"

// Helper to extract YouTube ID
const getYoutubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export default function StreamWatchPage() {
  const params = useParams()
  const streamIdStr = params.streamId as string
  const { publicKey, sendTransaction, signTransaction } = useWallet()
  const [stream, setStream] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("stream")
  const [selectedTeam, setSelectedTeam] = useState<'A' | 'B'>('A')

  const program = useMemo(
    () => getProvider(publicKey, signTransaction, sendTransaction),
    [publicKey, signTransaction, sendTransaction]
  )

  useEffect(() => {
    const fetchStreamData = async () => {
      if (!program || !streamIdStr) return;

      setIsLoading(true);
      try {
        const streamIdBN = new BN(streamIdStr);
        const account = await getStream(program, streamIdBN);
        
        const videoId = getYoutubeId(account.streamLink);
        
        // Conversions
        // Assuming LAMPORTS_PER_SOL is 1e9
        // Initial price is not stored in account, defaulting to 0.1 SOL
        const initialPrice = 0.1;
        const teamAPrice = account.teamAPrice.toNumber() / 1000000000;
        const teamBPrice = account.teamBPrice.toNumber() / 1000000000;

        setStream({
            title: `${account.teamAName} vs ${account.teamBName}`,
            streamer: account.authority.toBase58(),
            youtubeId: videoId,
            viewers: 0,
            
            // Market Data
            teamAName: account.teamAName,
            teamBName: account.teamBName,
            initialPrice: initialPrice,
            teamAPrice: teamAPrice,
            teamBPrice: teamBPrice,
        });
      } catch (error) {
        console.error("Error fetching stream:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (program) {
        fetchStreamData();
    }
  }, [program, streamIdStr]);


  if (isLoading) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center text-zinc-900">
             <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      )
  }

  if (!stream) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-zinc-900">
        <div className="text-center">
             <h1 className="text-4xl font-bold mb-4">Stream Not Found</h1>
             <p className="text-zinc-500">The transmission seems to be offline or does not exist.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 pt-24 h-screen overflow-hidden">
      <div className="flex h-full">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full bg-zinc-50/50">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col p-4">
                <TabsList className="grid w-[400px] grid-cols-2 mb-4">
                    <TabsTrigger value="stream">Live Stream</TabsTrigger>
                    <TabsTrigger value="stocks">Prediction Market</TabsTrigger>
                </TabsList>
                
                <div className="flex-1 relative rounded-2xl overflow-hidden border border-zinc-200 bg-white shadow-sm">
                     {/* Video Player - Always mounted, toggle visibility */}
                     <div className={`absolute inset-0 m-0 w-full h-full bg-black ${activeTab === 'stream' ? 'z-10' : 'z-0'}`}>
                         {stream.youtubeId ? (
                             <iframe
                                width="100%"
                                height="100%"
                                src={`https://www.youtube.com/embed/${stream.youtubeId}?autoplay=1&rel=0&modestbranding=1&loop=1&playlist=${stream.youtubeId}`}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                referrerPolicy="strict-origin-when-cross-origin"
                                allowFullScreen
                                className="w-full h-full"
                             />
                         ) : (
                             <div className="w-full h-full flex items-center justify-center text-white">
                                 <p>Video not available</p>
                             </div>
                         )}
                     </div>
                    
                    {/* Stock Market - Only visible when active */}
                    <div className={`absolute inset-0 m-0 w-full h-full p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden bg-white ${activeTab === 'stocks' ? 'z-20' : 'z-[-1]'} flex flex-col`}>
                        <div className="flex justify-end mb-4 gap-2">
                             <button 
                                onClick={() => setSelectedTeam('A')}
                                className={`px-4 py-2 text-sm font-bold uppercase tracking-wider border-2 transition-all ${selectedTeam === 'A' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-900 border-zinc-200 hover:border-zinc-900'}`}
                             >
                                {stream.teamAName}
                             </button>
                             <button 
                                onClick={() => setSelectedTeam('B')}
                                className={`px-4 py-2 text-sm font-bold uppercase tracking-wider border-2 transition-all ${selectedTeam === 'B' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-900 border-zinc-200 hover:border-zinc-900'}`}
                             >
                                {stream.teamBName}
                             </button>
                        </div>
                        <div className="flex-1 min-h-0">
                            <StockMarket 
                                initialPrice={stream.initialPrice} 
                                currentPrice={selectedTeam === 'A' ? stream.teamAPrice : stream.teamBPrice}
                                teamName={selectedTeam === 'A' ? stream.teamAName : stream.teamBName}
                            />
                        </div>
                    </div>
                </div>
            </Tabs>
        </div>

        {/* Chat Sidebar */}
        <div className="w-[350px] hidden lg:flex flex-col border-l border-zinc-200 h-full bg-white relative z-10">
            <StreamChat streamId={streamIdStr} program={program} />
        </div>
      </div>
    </div>
  )
}
