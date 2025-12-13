"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Send, Smile, User, MoreVertical, Heart, ArrowUpRight, ArrowDownRight, TrendingUp, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { BN, Program } from "@coral-xyz/anchor"
import { useWallet } from "@solana/wallet-adapter-react"
import { getStreamPrices, purchaseShares, claimWinnings, getProvider } from "@/services/service"
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
  const [amount, setAmount] = useState("")
  const [prices, setPrices] = useState<any>(null)
  const [isTrading, setIsTrading] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
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

  // Fetch Wallet Balance
  useEffect(() => {
    const fetchBalance = async () => {
        if (publicKey && program) {
            try {
                const bal = await program.provider.connection.getBalance(publicKey);
                setBalance(bal / LAMPORTS_PER_SOL);
            } catch (error) {
                console.error("Error fetching balance:", error);
            }
        }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [publicKey, program]);

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

  const handleBuyShares = async (teamId: number) => {
    if (!program || !publicKey || !amount) {
        alert("Please connect wallet and enter an amount.");
        return;
    }
    
    setIsTrading(true)
    try {
        const wallet = { publicKey, signTransaction, sendTransaction } as any
        // Ensure amount is valid
        const solAmount = parseFloat(amount);
        if (isNaN(solAmount) || solAmount <= 0) {
            throw new Error("Invalid amount.");
        }
        
        // Get current price for the selected team
        const currentPrice = teamId === 1 ? prices?.teamAPrice : prices?.teamBPrice;
        if (!currentPrice) {
             throw new Error("Price data not available yet.");
        }
        
        // Calculate number of shares to buy: Investment / Price per share
        const investmentLamports = new BN(solAmount * LAMPORTS_PER_SOL);
        const numShares = investmentLamports.div(currentPrice);

        if (numShares.lte(new BN(0))) {
            throw new Error(`Investment too low. Minimum price is ${(currentPrice.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
        }
        
        console.log(`Buying shares: Stream=${streamId}, Team=${teamId}, Investment=${investmentLamports.toString()}, Price=${currentPrice.toString()}, Shares=${numShares.toString()}`);

        await purchaseShares(program, wallet, new BN(streamId), teamId, numShares)
        
        // Refresh prices
        const pricesData = await getStreamPrices(program, new BN(streamId))
        setPrices(pricesData)
        setAmount("")
        alert(`Successfully bought ${numShares.toString()} shares!`)
        
        // Refresh balance
        const bal = await program.provider.connection.getBalance(publicKey);
        setBalance(bal / LAMPORTS_PER_SOL);

        // Notify parent
        if (onTradeSuccess) {
            onTradeSuccess();
        }

    } catch (e: any) {
        console.error("Error purchasing shares:", e)
        alert(`Failed to purchase shares: ${e.message || e.toString()}`)
    } finally {
        setIsTrading(false)
    }
  }

  const handleClaimWinnings = async () => {
      if (!program || !publicKey) return
    
    setIsTrading(true)
    try {
        const wallet = { publicKey, signTransaction, sendTransaction } as any
        await claimWinnings(program, wallet, new BN(streamId))
        alert("Winnings claimed successfully!")
        
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

  return (
    <div className="flex flex-col h-full bg-zinc-50 border-2 border-zinc-900 font-mono">
      <Tabs defaultValue="chat" className="flex flex-col h-full">
        <div className="p-2 border-b-2 border-zinc-900 bg-white">
            <TabsList className="grid w-full grid-cols-2 rounded-none bg-zinc-100 p-0 h-auto border border-zinc-200">
                <TabsTrigger 
                    value="chat" 
                    className="rounded-none data-[state=active]:bg-zinc-900 data-[state=active]:text-white font-bold uppercase tracking-widest text-xs py-2"
                >
                    Live Chat
                </TabsTrigger>
                <TabsTrigger 
                    value="trade" 
                    className="rounded-none data-[state=active]:bg-zinc-900 data-[state=active]:text-white font-bold uppercase tracking-widest text-xs py-2"
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
                    <span>On Air</span>
                </div>
                <div className="text-[10px] text-zinc-400 font-mono">
                    {messages.length} MSGS
                </div>
            </div>

            {/* Messages */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-0.5 scrollbar-thin scrollbar-track-zinc-100 scrollbar-thumb-zinc-400"
            >
                {messages.map((msg) => (
                <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                    "text-sm p-1.5 px-3 hover:bg-zinc-100 transition-colors",
                    msg.isSystem ? "text-zinc-500 italic text-xs py-2 border-y border-zinc-100 my-2 text-center" : "text-zinc-800"
                    )}
                >
                    {!msg.isSystem && (
                    <span className={cn("font-bold mr-2 uppercase text-xs tracking-wide", msg.color)}>
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
            <div className="p-3 bg-white border-t-2 border-zinc-900">
                {/* Quick Actions */}
                <div className="flex gap-1 mb-3 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                {EMOJIS.map((emoji) => (
                    <button
                    key={emoji}
                    onClick={() => addEmoji(emoji)}
                    className="w-8 h-8 flex items-center justify-center border border-zinc-200 hover:border-zinc-900 hover:bg-zinc-50 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
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
                        placeholder="TYPE MESSAGE..."
                        className="w-full bg-zinc-50 border-2 border-zinc-300 focus:border-zinc-900 rounded-none pl-3 pr-10 py-2.5 text-sm text-zinc-900 focus:outline-none placeholder:text-zinc-400 font-medium transition-colors"
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
                    className="px-4 bg-zinc-900 hover:bg-zinc-800 text-white border-2 border-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center active:scale-95"
                >
                    <Send className="w-4 h-4" />
                </button>
                </form>
            </div>
        </TabsContent>

        {/* TRADE TAB */}
        <TabsContent value="trade" className="flex-1 flex flex-col min-h-0 m-0 overflow-y-auto p-4 bg-zinc-50">
             <div className="flex flex-col gap-4">
                <div className="bg-white border-2 border-zinc-900 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="flex items-center justify-between mb-4">
                         <span className="font-bold uppercase tracking-widest text-zinc-500 text-xs">Your Balance</span>
                         <Wallet className="w-4 h-4 text-zinc-900" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-zinc-900">
                        {balance !== null ? `${balance.toFixed(4)} SOL` : <span className="animate-pulse">...</span>}
                    </div>
                </div>

                {/* Amount Input */}
                <div className="p-2 bg-zinc-100 border border-zinc-200">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Invest Amount (SOL)</label>
                    <input 
                        type="number" 
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.1"
                        className="w-full bg-white border border-zinc-300 p-2 font-mono text-sm focus:outline-none focus:border-zinc-900"
                    />
                </div>

                {/* Team A */}
                <div className="bg-white border-2 border-zinc-200 p-4 hover:border-blue-500 transition-colors group">
                    <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-zinc-900 uppercase">{prices ? prices.teamAName : "Team A"}</span>
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                    </div>
                     <div className="flex justify-between items-end">
                        <div className="flex flex-col gap-1">
                            <div>
                                <div className="text-xs text-zinc-400 uppercase tracking-wider">Current Price</div>
                                <div className="text-xl font-bold font-mono text-blue-600">
                                    {prices ? (prices.teamAPrice.toNumber() / LAMPORTS_PER_SOL).toFixed(4) : "0.00"} SOL
                                </div>
                            </div>
                            {amount && prices && (
                                <div>
                                     <div className="text-xs text-zinc-400 uppercase tracking-wider">Est. Shares</div>
                                     <div className="text-sm font-bold font-mono text-zinc-900">
                                        {Math.floor((parseFloat(amount) * LAMPORTS_PER_SOL) / prices.teamAPrice.toNumber()).toLocaleString()}
                                     </div>
                                </div>
                            )}
                        </div>
                        <button 
                            onClick={() => handleBuyShares(1)}
                            disabled={isTrading || !amount}
                            className="bg-zinc-900 text-white px-4 py-1.5 text-xs font-bold uppercase tracking-widest hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Buy Shares
                        </button>
                    </div>
                </div>

                {/* Team B */}
                <div className="bg-white border-2 border-zinc-200 p-4 hover:border-purple-500 transition-colors group">
                    <div className="flex justify-between items-start mb-2">
                         <span className="font-bold text-zinc-900 uppercase">{prices ? prices.teamBName : "Team B"}</span>
                         <TrendingUp className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="flex justify-between items-end">
                         <div className="flex flex-col gap-1">
                            <div>
                                <div className="text-xs text-zinc-400 uppercase tracking-wider">Current Price</div>
                                <div className="text-xl font-bold font-mono text-purple-600">
                                    {prices ? (prices.teamBPrice.toNumber() / LAMPORTS_PER_SOL).toFixed(4) : "0.00"} SOL
                                </div>
                            </div>
                            {amount && prices && (
                                <div>
                                     <div className="text-xs text-zinc-400 uppercase tracking-wider">Est. Shares</div>
                                     <div className="text-sm font-bold font-mono text-zinc-900">
                                        {Math.floor((parseFloat(amount) * LAMPORTS_PER_SOL) / prices.teamBPrice.toNumber()).toLocaleString()}
                                     </div>
                                </div>
                            )}
                        </div>
                        <button 
                            onClick={() => handleBuyShares(2)}
                            disabled={isTrading || !amount}
                            className="bg-zinc-900 text-white px-4 py-1.5 text-xs font-bold uppercase tracking-widest hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Buy Shares
                        </button>
                    </div>
                </div>

                 <div className="mt-4">
                    <button 
                        onClick={handleClaimWinnings}
                        disabled={isTrading}
                        className="w-full bg-emerald-600 text-white border-2 border-emerald-800 p-3 font-bold uppercase tracking-widest hover:bg-emerald-500 transition-all active:translate-y-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(6,78,59,1)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        Claim Winnings
                    </button>
                </div>
             </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
