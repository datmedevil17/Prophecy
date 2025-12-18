"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Send, Smile, User, MoreVertical, Heart, ArrowUpRight, ArrowDownRight, TrendingUp, Wallet, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { BN, Program } from "@coral-xyz/anchor"
import { useWallet } from "@solana/wallet-adapter-react"
import { getStreamPrices, purchaseShares, sellShares, claimWinnings, getProvider, getUserPosition } from "@/services/service"
import { PredictionMarket } from "@/program/prediction_market"
import { LAMPORTS_PER_SOL } from "@solana/web3.js"
import io, { Socket } from "socket.io-client";

interface ChatMessage {
  id: string
  user: string // Wallet address
  content: string
  color: string
  isSystem?: boolean
  walletAddress?: string
}

const EMOJIS = ["🔥", "❤️", "😂", "😮", "🚀", "👾", "💎", "🌙"]

interface StreamChatProps {
  streamId: string
  program: Program<PredictionMarket> | null
  onTradeSuccess?: () => void
}

let socket: Socket;

export function StreamChat({ streamId, program, onTradeSuccess }: StreamChatProps) {
  const { publicKey, signTransaction, sendTransaction } = useWallet()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  
  // Trade State
  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy")
  const [amount, setAmount] = useState("")
  
  const [prices, setPrices] = useState<any>(null)
  const [isTrading, setIsTrading] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [userPosition, setUserPosition] = useState<any>(null)
  
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Initialize socket
    socket = io("http://localhost:3001");
    
    socket.emit("join_stream", streamId);

    // Initial history load
    socket.on("chat_history", (history: any[]) => {
        const formattedHistory = history.map(msg => ({
            id: msg._id,
            user: msg.walletAddress === publicKey?.toString() ? "You" : `${msg.walletAddress.slice(0, 4)}...${msg.walletAddress.slice(-4)}`,
            content: msg.message,
            color: "text-zinc-800",
            walletAddress: msg.walletAddress
        }));
        setMessages(formattedHistory);
    });

    socket.on("receive_message", (data: { streamId: string, message: string, walletAddress: string, timestamp: string, _id?: string }) => {
        const newMessage: ChatMessage = {
            id: data._id || (Date.now().toString() + Math.random().toString()),
            user: data.walletAddress === publicKey?.toString() ? "You" : `${data.walletAddress.slice(0, 4)}...${data.walletAddress.slice(-4)}`,
            content: data.message,
            color: "text-zinc-800",
            walletAddress: data.walletAddress
        };
        setMessages((prev) => [...prev, newMessage]);
    });

    return () => {
        socket.disconnect();
    };
  }, [streamId, publicKey]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Fetch Wallet Balance and Position
  const refreshData = async () => {
        if (!publicKey || !program) return;
        
        try {
            // Balance
            const bal = await program.provider.connection.getBalance(publicKey);
            setBalance(bal / LAMPORTS_PER_SOL);

            // User Position
            try {
                const wallet = { publicKey } as any; // Minimal wallet for read
                const position = await getUserPosition(program, new BN(streamId), wallet);
                setUserPosition(position);
            } catch (err) {
                // Position might not exist yet
                setUserPosition(null);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [publicKey, program, streamId]);

  useEffect(() => {
    const fetchPrices = async () => {
      if (program && streamId) {
        try {
          const pricesData = await getStreamPrices(program, new BN(streamId))
          setPrices(pricesData)
        } catch (e) {
          console.error("Error fetching prices:", e)
        }
      }
    }

    fetchPrices()
    const interval = setInterval(fetchPrices, 5000) // Refresh every 5s
    return () => clearInterval(interval)
  }, [program, streamId])

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!inputValue.trim()) return

    if (!publicKey) {
        alert("Please connect wallet to chat");
        return;
    }

    const messageData = {
        streamId: streamId,
        message: inputValue,
        walletAddress: publicKey.toString()
    };

    socket.emit("send_message", messageData);
    setInputValue("")
  }

  const addEmoji = (emoji: string) => {
    setInputValue((prev) => prev + emoji)
  }

  // Helper to format atomic shares to human readable
  const formatShares = (shares: BN) => {
      const LAMPORTS = new BN(1000000000);
      const integer = shares.div(LAMPORTS).toString();
      const fractional = shares.mod(LAMPORTS).toString().padStart(9, '0').slice(0, 2);
      return `${integer}.${fractional}`;
  }

  const handleTrade = async (teamId: number) => {
    if (!program || !publicKey || !amount) {
        alert("Please connect wallet and enter an amount.");
        return;
    }
    
    setIsTrading(true)
    try {
        const wallet = { publicKey, signTransaction, sendTransaction } as any
        
        console.log("Initiating trade...");
        
        if (tradeMode === "buy") {
             // BUY LOGIC
            const solAmount = parseFloat(amount);
            if (isNaN(solAmount) || solAmount <= 0) {
                throw new Error("Invalid investment amount.");
            }
            
            const currentPrice = teamId === 1 ? prices?.teamAPrice : prices?.teamBPrice;
            if (!currentPrice) throw new Error("Price data unavailable.");
            
            // Calculate number of shares to buy
            // Price is per 1e9 atomic units (1 Whole Share). 
            // Formula: (Investment * 1e9) / Price
            // Calculate estimated shares for display
            // Price is per 1e9 atomic units (1 Whole Share). 
            const investmentLamports = new BN(solAmount * LAMPORTS_PER_SOL);
            const estimatedShares = investmentLamports.mul(new BN(1000000000)).div(currentPrice);

            if (estimatedShares.lte(new BN(0))) {
                throw new Error(`Investment too low.`);
            }
            
            console.log("Sending Purchase Transaction...", { streamId, teamId, solAmount: investmentLamports.toString() });
            // Contract expects SOL Amount as input, calculates Shares Output internally
            const tx = await purchaseShares(program, wallet, new BN(streamId), teamId, investmentLamports)
            console.log("Purchase Transaction Confirmed:", tx);
            
            alert(`Successfully bought shares! (Est: ${formatShares(estimatedShares)})`)

        } else {
            // SELL LOGIC
            const sharesToSellInput = parseFloat(amount);
            if (isNaN(sharesToSellInput) || sharesToSellInput <= 0) {
                 throw new Error("Invalid share amount.");
            }
            
            // Convert input (Whole Shares) to Atomic Units (x 1e9)
            const sharesToSellAtomic = new BN(sharesToSellInput * 1000000000);
            
            console.log("Sending Sell Transaction...", { streamId, teamId, sharesAtomic: sharesToSellAtomic.toString() });
            const tx = await sellShares(program, wallet, new BN(streamId), teamId, sharesToSellAtomic)
            console.log("Sell Transaction Confirmed:", tx);
            
            alert(`Successfully sold ${amount} shares!`)
        }
        
        // Refresh everything
        setPrices(await getStreamPrices(program, new BN(streamId)))
        refreshData();
        setAmount("")
        
        // Notify parent
        if (onTradeSuccess) {
            onTradeSuccess();
        }

    } catch (e: any) {
        console.error("Trade failed:", e)
        alert(`Failed: ${e.message || e.toString()}`)
    } finally {
        setIsTrading(false)
    }
  }

  const handleClaimWinnings = async () => {
      if (!program || !publicKey) return
    
    setIsTrading(true)
    try {
        const wallet = { publicKey, signTransaction, sendTransaction } as any
        console.log("Claiming winnings...");
        const tx = await claimWinnings(program, wallet, new BN(streamId))
        console.log("Claim Transaction Confirmed:", tx);
        
        alert("Winnings claimed successfully!")
        refreshData();
        
        // Refresh balance
        const bal = await program.provider.connection.getBalance(publicKey);
        setBalance(bal / LAMPORTS_PER_SOL);
    } catch (e: any) {
        console.error("Error claiming winnings:", e)
        alert(`Failed to claim winnings: ${e.message || e.toString()}`)
    } finally {
        setIsTrading(false)
    }
  }

  // Check if stream is ended
  const isEnded = prices && prices.isActive === false;

  return (
    <div className="flex flex-col h-full bg-zinc-50 border-l border-zinc-200 font-mono">
      <Tabs defaultValue="chat" className="flex flex-col h-full">
        <div className="p-2 border-b border-zinc-200 bg-white">
            <TabsList className="grid w-full grid-cols-2 rounded-lg bg-zinc-100 p-1">
                <TabsTrigger 
                    value="chat" 
                    className="rounded-md text-xs font-bold uppercase"
                >
                    Chat
                </TabsTrigger>
                <TabsTrigger 
                    value="trade" 
                    className="rounded-md text-xs font-bold uppercase"
                >
                    Trade
                </TabsTrigger>
            </TabsList>
        </div>

        {/* CHAT TAB */}
        <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 m-0 data-[state=active]:flex">
             {/* Header */}
            <div className="p-2 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    <div className="w-1.5 h-1.5 bg-red-500 animate-pulse rounded-full" />
                    <span>Live</span>
                </div>
                <div className="text-[10px] text-zinc-400 font-mono">
                    {messages.length} messages
                </div>
            </div>

            {/* Messages */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-track-zinc-100 scrollbar-thumb-zinc-400"
            >
                {messages.map((msg) => (
                <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                    "text-sm p-2 rounded-lg transition-colors",
                    msg.isSystem ? "text-zinc-500 italic text-xs text-center bg-zinc-100/50" : "text-zinc-800 bg-white border border-zinc-100 shadow-sm"
                    )}
                >
                    {!msg.isSystem && (
                    <span className={cn("font-bold mr-2 uppercase text-xs tracking-wide block mb-0.5", msg.color)}>
                        {msg.user}
                    </span>
                    )}
                    <span className={cn(!msg.isSystem && "text-zinc-700")}>
                        {msg.content}
                    </span>
                </motion.div>
                ))}
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-zinc-200">
                {/* Quick Actions */}
                <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
                {EMOJIS.map((emoji) => (
                    <button
                    key={emoji}
                    onClick={() => addEmoji(emoji)}
                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300 transition-all active:scale-95"
                    >
                    <span className="text-sm">{emoji}</span>
                    </button>
                ))}
                </div>

                <form onSubmit={handleSendMessage} className="relative flex gap-2">
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Say something..."
                        className="w-full bg-zinc-50 border border-zinc-200 focus:border-zinc-400 focus:ring-0 rounded-lg pl-3 pr-10 py-2.5 text-sm text-zinc-900 focus:outline-none placeholder:text-zinc-400 transition-colors"
                    />
                    <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                        <Smile className="w-4 h-4" />
                    </button>
                </div>
                
                <button
                    type="submit"
                    disabled={!inputValue.trim()}
                    className="px-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center active:scale-95"
                >
                    <Send className="w-4 h-4" />
                </button>
                </form>
            </div>
        </TabsContent>

        {/* TRADE TAB */}
        <TabsContent value="trade" className="flex-1 flex flex-col min-h-0 m-0 overflow-y-auto p-4 bg-zinc-50">
             <div className="flex flex-col gap-4">
                 
                 {isEnded ? (
                    /* ENDED STATE UI */
                    <div className="flex flex-col items-center justify-center h-full space-y-4 py-8">
                        <div className="bg-zinc-900 text-white w-full py-4 text-center rounded-lg shadow-sm">
                            <h3 className="text-xl font-bold font-orbitron uppercase">Market Ended</h3>
                            <p className="text-xs text-zinc-400 mt-1">Trading is closed.</p>
                        </div>
                        
                        {userPosition ? (
                            <div className="w-full bg-white p-4 border border-zinc-200 rounded-lg">
                                <div className="text-center mb-4 border-b border-zinc-100 pb-2">
                                     <p className="text-xs text-zinc-500 font-bold uppercase">Winning Team</p>
                                     <p className="text-lg font-bold text-zinc-900">{prices?.winningTeam === 1 ? prices.teamAName : prices.teamBName}</p>
                                </div>
                                
                                <button 
                                    onClick={handleClaimWinnings}
                                    disabled={isTrading}
                                    className="w-full bg-emerald-600 text-white border border-emerald-700 rounded-lg p-4 font-bold uppercase tracking-widest hover:bg-emerald-500 transition-all active:translate-y-0.5 active:shadow-none shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                                >
                                    <Wallet className="w-4 h-4" />
                                    Claim Winnings
                                </button>
                            </div>
                        ) : (
                             <div className="text-center p-4 bg-zinc-100 rounded-lg border border-zinc-200">
                                <p className="text-zinc-500 text-sm">You did not participate in this market.</p>
                             </div>
                        )}
                    </div>
                 ) : (
                    /* LIVE TRADING UI */
                    <>
                        {/* Mode Toggle */}
                        <div className="grid grid-cols-2 gap-1 bg-zinc-200 p-1 rounded-lg">
                            <button
                                onClick={() => { setTradeMode("buy"); setAmount(""); }}
                                className={cn("py-1.5 text-xs font-bold uppercase rounded-md transition-all", tradeMode === "buy" ? "bg-emerald-500 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700")}
                            >
                                Buy Shares
                            </button>
                            <button
                                onClick={() => { setTradeMode("sell"); setAmount(""); }}
                                className={cn("py-1.5 text-xs font-bold uppercase rounded-md transition-all", tradeMode === "sell" ? "bg-red-500 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700")}
                            >
                                Sell Shares
                            </button>
                        </div>
                        
                        {/* Balance Card */}
                        <div className="bg-white border border-zinc-200 rounded-lg p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold uppercase tracking-widest text-zinc-400 text-[10px]">Current Balance</span>
                                <Wallet className="w-3 h-3 text-zinc-400" />
                            </div>
                            <div className="text-xl font-bold font-mono text-zinc-900">
                                {balance !== null ? `${balance.toFixed(4)} SOL` : "..."}
                            </div>
                        </div>
                        
                        {/* User Position Summary (Shares owned) */}
                        {userPosition && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-blue-50 border border-blue-100 p-2 rounded-md">
                                    <div className="text-blue-400 font-bold uppercase mb-1">Team A Shares</div>
                                    <div className="font-mono text-blue-900 font-bold">{formatShares(userPosition.teamAShares)}</div>
                                </div>
                                <div className="bg-purple-50 border border-purple-100 p-2 rounded-md">
                                    <div className="text-purple-400 font-bold uppercase mb-1">Team B Shares</div>
                                    <div className="font-mono text-purple-900 font-bold">{formatShares(userPosition.teamBShares)}</div>
                                </div>
                            </div>
                        )}

                        {/* Amount Input */}
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 block">
                                {tradeMode === "buy" ? "Investment Amount (SOL)" : "Shares to Sell (Count)"}
                            </label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder={tradeMode === "buy" ? "0.1" : "10"}
                                    className="w-full bg-white border border-zinc-300 rounded-lg p-2.5 font-mono text-sm focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-200 transition-all"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 pointer-events-none">
                                    {tradeMode === "buy" ? "SOL" : "SHARES"}
                                </span>
                            </div>
                        </div>

                        {/* Team Trading Cards */}
                        {/* Team A */}
                        <div className="bg-white border hover:border-blue-400 border-zinc-200 rounded-xl p-4 transition-all shadow-sm group">
                            <div className="flex justify-between items-start mb-3">
                                <span className="font-bold text-zinc-900 uppercase text-sm">{prices ? prices.teamAName : "Team A"}</span>
                                {tradeMode === "buy" ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <ArrowDown className="w-4 h-4 text-red-500" />}
                            </div>
                            <div className="flex justify-between items-end">
                                <div className="flex flex-col gap-1">
                                    <div>
                                        <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Price</div>
                                        <div className="text-lg font-bold font-mono text-blue-600">
                                            {prices ? (prices.teamAPrice.toNumber() / LAMPORTS_PER_SOL).toFixed(4) : "0.00"} SOL
                                        </div>
                                    </div>
                                    
                                    {/* Estimation Logic */}
                                    {amount && prices && tradeMode === "buy" && (
                                        <div>
                                            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Est. Shares</div>
                                            <div className="text-sm font-bold font-mono text-zinc-900 bg-zinc-100 px-1 rounded inline-block">
                                                {Math.floor((parseFloat(amount) * LAMPORTS_PER_SOL) / prices.teamAPrice.toNumber()).toLocaleString()}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {amount && prices && tradeMode === "sell" && (
                                        <div>
                                            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Est. Recieve</div>
                                            <div className="text-sm font-bold font-mono text-emerald-600 bg-emerald-50 px-1 rounded inline-block">
                                                {(parseFloat(amount) * (prices.teamAPrice.toNumber() / LAMPORTS_PER_SOL)).toFixed(4)} SOL
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <button 
                                    onClick={() => handleTrade(1)}
                                    disabled={isTrading || !amount}
                                    className={cn(
                                        "text-white px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                                        tradeMode === "buy" ? "bg-zinc-900 hover:bg-blue-600" : "bg-red-500 hover:bg-red-600"
                                    )}
                                >
                                    {tradeMode === "buy" ? "Buy A" : "Sell A"}
                                </button>
                            </div>
                        </div>

                        {/* Team B */}
                        <div className="bg-white border hover:border-purple-400 border-zinc-200 rounded-xl p-4 transition-all shadow-sm group">
                            <div className="flex justify-between items-start mb-3">
                                <span className="font-bold text-zinc-900 uppercase text-sm">{prices ? prices.teamBName : "Team B"}</span>
                                {tradeMode === "buy" ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <ArrowDown className="w-4 h-4 text-red-500" />}
                            </div>
                            <div className="flex justify-between items-end">
                                <div className="flex flex-col gap-1">
                                    <div>
                                        <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Price</div>
                                        <div className="text-lg font-bold font-mono text-purple-600">
                                            {prices ? (prices.teamBPrice.toNumber() / LAMPORTS_PER_SOL).toFixed(4) : "0.00"} SOL
                                        </div>
                                    </div>
                                    
                                    {/* Estimation Logic */}
                                    {amount && prices && tradeMode === "buy" && (
                                        <div>
                                            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Est. Shares</div>
                                            <div className="text-sm font-bold font-mono text-zinc-900 bg-zinc-100 px-1 rounded inline-block">
                                                {Math.floor((parseFloat(amount) * LAMPORTS_PER_SOL) / prices.teamBPrice.toNumber()).toLocaleString()}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {amount && prices && tradeMode === "sell" && (
                                        <div>
                                            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Est. Recieve</div>
                                            <div className="text-sm font-bold font-mono text-emerald-600 bg-emerald-50 px-1 rounded inline-block">
                                                {((parseInt(amount) * prices.teamBPrice.toNumber()) / LAMPORTS_PER_SOL).toFixed(4)} SOL
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <button 
                                    onClick={() => handleTrade(2)}
                                    disabled={isTrading || !amount}
                                    className={cn(
                                        "text-white px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                                        tradeMode === "buy" ? "bg-zinc-900 hover:bg-purple-600" : "bg-red-500 hover:bg-red-600"
                                    )}
                                >
                                    {tradeMode === "buy" ? "Buy B" : "Sell B"}
                                </button>
                            </div>
                        </div>

                         <div className="mt-2">
                            <button 
                                onClick={handleClaimWinnings}
                                disabled={isTrading}
                                className="w-full bg-emerald-600 text-white border border-emerald-700 rounded-lg p-3 font-bold uppercase tracking-widest hover:bg-emerald-500 transition-all active:translate-y-0.5 active:shadow-none shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                            >
                                Claim Winnings
                            </button>
                        </div>
                    </>
                 )}
             </div>
        </TabsContent>
        {/* END TRADE TAB */}
      </Tabs>
    </div>
  )
}
