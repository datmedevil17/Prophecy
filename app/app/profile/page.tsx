"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { Users, Play, Loader2, Trophy, Wallet, TrendingUp } from "lucide-react"
import { useEffect, useState, useMemo } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { getProvider, getUsersStreams, getUserPositions, getStream } from "@/services/service"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { BN } from "@coral-xyz/anchor"
import { LAMPORTS_PER_SOL } from "@solana/web3.js"

// Helper to extract YouTube ID
const getYoutubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// Helper to format SOL
const formatSol = (lamports: BN | number) => {
  const value = typeof lamports === 'number' ? lamports : lamports.toNumber();
  return (value / LAMPORTS_PER_SOL).toFixed(4);
}

export default function ProfilePage() {
  const { publicKey, sendTransaction, signTransaction } = useWallet()
  const [createdStreams, setCreatedStreams] = useState<any[]>([])
  const [portfolio, setPortfolio] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const program = useMemo(
    () => getProvider(publicKey, signTransaction, sendTransaction),
    [publicKey, signTransaction, sendTransaction]
  )

  useEffect(() => {
    const fetchData = async () => {
      if (!program || !publicKey) return;
      
      setIsLoading(true);
      try {
        // Fetch Created Streams
        const myStreamsData = await getUsersStreams(program, { publicKey } as any);
        const formattedStreams = myStreamsData.map((item: any) => {
          const account = item.account;
          const videoId = getYoutubeId(account.streamLink);
          return {
            id: account.streamId.toString(),
            title: `${account.teamAName} vs ${account.teamBName}`,
            status: account.isActive ? "Active" : "Ended",
            thumbnail: videoId 
              ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` 
              : "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop",
            youtubeId: videoId,
            winningTeam: account.winningTeam,
          }
        });
        formattedStreams.sort((a: any, b: any) => Number(b.id) - Number(a.id));
        setCreatedStreams(formattedStreams);

        // Fetch Portfolio (Positions)
        const positionsData = await getUserPositions(program, { publicKey } as any);
        
        // Fetch stream details for each position to get names and prices
        const portfolioItems = await Promise.all(positionsData.map(async (item: any) => {
          const position = item.account;
          try {
            const stream = await getStream(program, position.streamId);
            
            // Format Atomic Shares to Whole Shares (1e9)
            const formatShares = (shares: any) => {
              const LAMPORTS = new BN(1000000000);
              const bnShares = new BN(shares);
              const integer = bnShares.div(LAMPORTS).toString();
              const fractional = bnShares.mod(LAMPORTS).toString().padStart(9, '0').slice(0, 2);
              return `${integer}.${fractional}`;
            }
            
            // Calculate Prices locally (Reserve / Total Model)
            const totalReserve = stream.teamAReserve.add(stream.teamBReserve);
            const LAMPORTS = new BN(1000000000);
            
            const teamAPrice = totalReserve.isZero() 
                 ? new BN(0) 
                 : stream.teamAReserve.mul(LAMPORTS).div(totalReserve);
            
            const teamBPrice = totalReserve.isZero() 
                 ? new BN(0) 
                 : stream.teamBReserve.mul(LAMPORTS).div(totalReserve);

            // Calculate Estimated Value using CPMM Sell Formula
            // Formula: sol_out = (shares_in * reserve_opposite) / (reserve_team + shares_in)
            // This accounts for slippage/liquidity.
            
            // Value for Team A Shares
            let valueA = new BN(0);
            if (position.teamAShares.gt(new BN(0))) {
                const numerator = position.teamAShares.mul(stream.teamBReserve);
                const denominator = stream.teamAReserve.add(position.teamAShares);
                valueA = numerator.div(denominator);
            }

            // Value for Team B Shares
            let valueB = new BN(0);
            if (position.teamBShares.gt(new BN(0))) {
                 const numerator = position.teamBShares.mul(stream.teamAReserve);
                 const denominator = stream.teamBReserve.add(position.teamBShares);
                 valueB = numerator.div(denominator);
            }

            const currentValueLamports = valueA.add(valueB);

            return {
              streamId: position.streamId.toString(),
              title: `${stream.teamAName} vs ${stream.teamBName}`,
              teamAName: stream.teamAName,
              teamBName: stream.teamBName,
              teamAShares: formatShares(position.teamAShares),
              teamBShares: formatShares(position.teamBShares),
              totalInvested: formatSol(position.totalInvested),
              currentValue: formatSol(currentValueLamports),
              hasClaimed: position.hasClaimed,
              isActive: stream.isActive,
            };
          } catch (e) {
            console.error(`Error fetching stream ${position.streamId.toString()}`, e);
            return null;
          }
        }));

        setPortfolio(portfolioItems.filter(item => item !== null));

      } catch (error) {
        console.error("Error fetching profile data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
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
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
          </div>
        )}

        {!isLoading && (
          <div className="flex flex-col gap-12">
            
            {/* Portfolio Section */}
            <section>
              <div className="flex items-center gap-2 mb-6">
                <Wallet className="w-6 h-6 text-zinc-900" />
                <h2 className="text-2xl font-bold font-orbitron text-zinc-900">My Portfolio</h2>
              </div>
              
              {portfolio.length === 0 ? (
                <div className="text-center py-12 bg-white border-2 border-zinc-200 p-8 rounded-none">
                  <TrendingUp className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-zinc-900 mb-2">No Active Investments</h3>
                  <p className="text-zinc-500 mb-6 max-w-sm mx-auto">You haven't bought any shares yet. Check out active streams to start trading!</p>
                  <Link href="/streams">
                    <Button className="bg-zinc-900 text-white rounded-none hover:bg-zinc-800">
                        Explore Streams
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {portfolio.map((item, index) => (
                    <motion.div
                      key={item.streamId}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Link href={`/streams/${item.streamId}`}>
                        <div className="bg-white border-2 border-zinc-900 p-6 hover:shadow-[4px_4px_0px_0px_rgba(37,99,235,1)] transition-all duration-200 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none h-full flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-4">
                              <h3 className="text-lg font-bold text-zinc-900 line-clamp-1 font-mono uppercase tracking-tight">
                                {item.title}
                              </h3>
                              <span className={`px-2 py-0.5 text-xs font-bold uppercase border ${item.isActive ? 'bg-green-100 text-green-800 border-green-800' : 'bg-zinc-100 text-zinc-600 border-zinc-400'}`}>
                                {item.isActive ? 'Active' : 'Ended'}
                              </span>
                            </div>

                            <div className="space-y-3 mb-6">
                              <div className="flex justify-between text-sm">
                                <span className="text-zinc-500">{item.teamAName}:</span>
                                <span className="font-mono font-bold">{item.teamAShares} Shares</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-zinc-500">{item.teamBName}:</span>
                                <span className="font-mono font-bold">{item.teamBShares} Shares</span>
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-zinc-100 pt-4 mt-auto">
                            <div className="flex justify-between items-end mb-2">
                              <span className="text-xs text-zinc-500 uppercase">Invested</span>
                              <span className="font-mono font-bold">{item.totalInvested} SOL</span>
                            </div>
                            <div className="flex justify-between items-end">
                              <span className="text-xs text-zinc-500 uppercase">Est. Value</span>
                              <span className="font-mono font-bold text-blue-600">{item.currentValue} SOL</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>

            <Separator className="bg-zinc-200" />

            {/* Created Streams Section */}
            <section>
              <div className="flex items-center gap-2 mb-6">
                <Users className="w-6 h-6 text-zinc-900" />
                <h2 className="text-2xl font-bold font-orbitron text-zinc-900">Created Streams</h2>
              </div>

              {createdStreams.length === 0 ? (
                <div className="text-center py-12 bg-white border-2 border-zinc-200 p-8 rounded-none">
                   <Trophy className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                   <h3 className="text-lg font-bold text-zinc-900 mb-2">No Streams Created</h3>
                   <p className="text-zinc-500 mb-6 max-w-sm mx-auto">You haven't created any prediction markets yet.</p>
                   <Link href="/create">
                      <Button className="bg-zinc-900 text-white rounded-none hover:bg-zinc-800">
                          Create New Stream
                      </Button>
                   </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {createdStreams.map((stream, index) => (
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
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
