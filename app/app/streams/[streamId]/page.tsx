"use client"

import { useParams } from "next/navigation"
import { motion } from "motion/react"
import { StreamChat } from "@/components/stream-chat"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StockMarket } from "@/components/stock-market"
import { Users, ThumbsUp, Share2, MoreHorizontal, Loader2, Camera } from "lucide-react"
import { useEffect, useState, useMemo, useCallback } from "react"
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

  const fetchStreamData = useCallback(async () => {
    if (!program || !streamIdStr) return;

    try {
      const streamIdBN = new BN(streamIdStr);
      const account = await getStream(program, streamIdBN);
      
      const videoId = getYoutubeId(account.streamLink);
      
      // Conversions
      const initialPrice = 0.1;
      const LAMPORTS = 1000000000;

      // Calculate Prices from Reserves (CPMM Ratio)
      // Price A = Reserve B / Reserve A
      const teamAPrice = account.teamAReserve.isZero()
        ? 0
        : account.teamBReserve.toNumber() / account.teamAReserve.toNumber();
      
      const teamBPrice = account.teamBReserve.isZero()
        ? 0
        : account.teamAReserve.toNumber() / account.teamBReserve.toNumber();

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
  }, [program, streamIdStr]);

  useEffect(() => {
    if (program) {
        fetchStreamData();
    }
  }, [program, streamIdStr, fetchStreamData]);


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
                <div className="flex justify-between items-center mb-4">
                    <TabsList className="grid w-[400px] grid-cols-2">
                        <TabsTrigger value="stream">Live Stream</TabsTrigger>
                        <TabsTrigger value="stocks">Prediction Market</TabsTrigger>
                    </TabsList>
                    
                    <button
                        onClick={() => {
                            const blinkUrl = `https://dial.to/?action=solana-action:${window.location.origin}/api/actions/bet/${streamIdStr}`;
                            navigator.clipboard.writeText(blinkUrl);
                            alert("Blink URL copied to clipboard!");
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-900 text-sm font-bold uppercase tracking-wider rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition-all shadow-sm active:scale-95"
                    >
                        <Share2 className="w-4 h-4" />
                        Share Blink
                    </button>
                </div>
                
                <div className="flex-1 relative rounded-2xl overflow-hidden border border-zinc-200 bg-white shadow-sm">
                     {/* Video Player - Always mounted, toggle visibility */}
                     <div id="video-container" className={`absolute inset-0 m-0 w-full h-full bg-black ${activeTab === 'stream' ? 'z-10' : 'z-0'} group`}>
                         {/* Capture Overlay Button */}

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
            <StreamChat 
              streamId={streamIdStr} 
              program={program} 
              onTradeSuccess={fetchStreamData}
            />
        </div>
      </div>
      
    </div>
  )
}
