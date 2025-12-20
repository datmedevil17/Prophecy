"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Separator } from "../../components/ui/separator";
import { Loader2, RefreshCw, BarChart2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { StockMarket, StockData } from "../../components/stock-market";
import { generateMockCandles } from "../../utils/mock-candles";
import { generateMockEvents } from "../../utils/mock-events";
import { getAllStreams, getProvider } from "../../services/service";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMemo } from "react";

type EventLogItem = {
  _id: string;
  signature: string;
  slot: number;
  eventName: string;
  data: any;
  timestamp: string;
};

type ChatMessageItem = {
  _id: string;
  streamId: string;
  walletAddress: string;
  message: string;
  timestamp: string;
};

export default function DataPage() {
  const [eventLogs, setEventLogs] = useState<EventLogItem[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatMessageItem[]>([]);
  const [marketData, setMarketData] = useState<{streamId: string, title: string, data: StockData[]}[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMarket, setLoadingMarket] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { publicKey, signTransaction, sendTransaction } = useWallet();
  
  const program = useMemo(
    () => getProvider(publicKey, signTransaction, sendTransaction),
    [publicKey, signTransaction, sendTransaction]
  );

  const fetchEvents = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoadingEvents(true);

    try {
      const res = await fetch("/api/events?limit=100");
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        setEventLogs(json.data);
      } else {
        // Fallback to mock events
        console.warn("Using mock events due to API failure/empty data");
        setEventLogs(generateMockEvents(20));
      }
    } catch (error) {
      console.error("Error fetching events:", error);
      // Fallback to mock events on error
      setEventLogs(generateMockEvents(20));
    } finally {
      setLoadingEvents(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  const fetchChats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoadingChats(true);

    try {
      const res = await fetch("/api/chat?limit=100");
      const json = await res.json();
      if (json.success) {
        setChatLogs(json.data);
      } else {
        console.error("Failed to fetch chat messages:", json.error);
      }
    } catch (error) {
      console.error("Error fetching chat messages:", error);
    } finally {
      setLoadingChats(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  const fetchMarketData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoadingMarket(true);

    try {
        // Mock stream list if program is not available (e.g. wallet not connected)
        // Or try to fetch real streams if possible.
        // For /data page, let's prioritize showing *something* even without wallet.
        
        let streams: Array<{id: string, title: string}> = [];
        
        if (program) {
             try {
                const streamAccounts = await getAllStreams(program);
                streams = streamAccounts.map((s: any) => ({
                    id: s.account.streamId.toString(),
                    title: `${s.account.teamAName} vs ${s.account.teamBName}`,
                }));
             } catch (err) {
                 console.warn("Failed to fetch streams from chain, using mock list", err);
             }
        }
        
        // If no streams found (or no wallet), use mock streams
        if (streams.length === 0) {
            streams = [
                { id: "1", title: "T1 vs T2 (Mock)" },
                { id: "2", title: "Lakers vs Warriors (Mock)" },
                { id: "3", title: "Alpha vs Omega (Mock)" }
            ];
        }

        // For each stream, generate mock candles
        const newMarketData = streams.map(stream => {
            // Deterministic random start price based on ID
            const startPrice = 10 + (parseInt(stream.id) % 100); 
            // Random trend
            const trend = Math.random() > 0.5 ? "up" : "down";
            
            return {
                streamId: stream.id,
                title: stream.title,
                data: generateMockCandles(startPrice, 50, trend as any)
            };
        });
        
        setMarketData(newMarketData);

    } catch (error) {
        console.error("Error fetching market data:", error);
    } finally {
        setLoadingMarket(false);
        if (isRefresh) setRefreshing(false);
    }
  }, [program]);

  useEffect(() => {
    fetchEvents();
    fetchChats();
    fetchMarketData();
  }, [fetchEvents, fetchChats, fetchMarketData]);

  const handleRefresh = () => {
    fetchEvents(true);
    fetchChats(true);
    fetchMarketData(true);
  };

  // Format timestamp
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-6xl">
      <Card className="shadow-lg border-neutral-800 bg-neutral-950 text-neutral-100">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
                System Data
              </CardTitle>
              <CardDescription className="text-neutral-400 mt-1">
                Raw data explorer for system events and user interactions.
              </CardDescription>
            </div>
            <Button
              onClick={handleRefresh}
              variant="outline"
              disabled={refreshing}
              className="border-neutral-700 hover:bg-neutral-800 text-neutral-300"
            >
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="events" className="w-full">
            <TabsList className="bg-neutral-900 border-neutral-800 mb-4">
              <TabsTrigger value="events" className="data-[state=active]:bg-neutral-800 text-neutral-400 data-[state=active]:text-neutral-100">
                Event Logs
              </TabsTrigger>
              <TabsTrigger value="chat" className="data-[state=active]:bg-neutral-800 text-neutral-400 data-[state=active]:text-neutral-100">
                Chat History
              </TabsTrigger>
              <TabsTrigger value="market" className="data-[state=active]:bg-neutral-800 text-neutral-400 data-[state=active]:text-neutral-100">
                 Market Analysis
              </TabsTrigger>
            </TabsList>
            
            <Separator className="bg-neutral-800 mb-6" />

            <TabsContent value="events" className="mt-0">
               <div className="rounded-md border border-neutral-800 bg-black/50 p-4 h-[600px] overflow-auto font-mono text-sm">
                {loadingEvents ? (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                     <Loader2 className="w-8 h-8 animate-spin mb-2" />
                     <p>Loading market events...</p>
                  </div>
                ) : eventLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                    <p>No events recorded yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {eventLogs.map((item) => (
                      <div
                        key={item._id}
                        className="p-3 rounded border-l-2 border-purple-500 bg-neutral-900/50 hover:bg-neutral-900/80 transition-colors"
                      >
                        <div className="flex justify-between text-xs text-neutral-500 mb-1">
                          <span className="uppercase tracking-wider font-bold text-purple-400">
                            {item.eventName}
                          </span>
                          <span>{formatDate(item.timestamp)}</span>
                        </div>
                        
                        <div className="mt-2">
                          <pre className="text-neutral-300 overflow-x-auto whitespace-pre-wrap bg-black/30 p-2 rounded text-xs">
                            {JSON.stringify(item.data, null, 2)}
                          </pre>
                        </div>

                        <div className="mt-2 flex justify-between items-center text-xs text-neutral-600">
                          <span>Slot: {item.slot}</span>
                          <a 
                            href={`https://explorer.solana.com/tx/${item.signature}?cluster=devnet`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-purple-400 underline decoration-dotted"
                          >
                            {item.signature.slice(0, 16)}...
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="chat" className="mt-0">
              <div className="rounded-md border border-neutral-800 bg-black/50 p-4 h-[600px] overflow-auto font-mono text-sm">
                {loadingChats ? (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                     <Loader2 className="w-8 h-8 animate-spin mb-2" />
                     <p>Loading chat history...</p>
                  </div>
                ) : chatLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                    <p>No chat messages found.</p>
                  </div>
                ) : (
                  <div className="w-full">
                    <table className="w-full text-left table-auto">
                      <thead className="bg-neutral-900 text-neutral-400 text-xs uppercase sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 rounded-tl-md">Time</th>
                          <th className="px-4 py-3">User</th>
                          <th className="px-4 py-3">Message</th>
                          <th className="px-4 py-3 rounded-tr-md">Stream ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/50">
                        {chatLogs.map((item) => (
                           <tr key={item._id} className="hover:bg-neutral-900/30 transition-colors">
                            <td className="px-4 py-3 text-neutral-500 whitespace-nowrap text-xs">
                              {formatDate(item.timestamp)}
                            </td>
                            <td className="px-4 py-3 text-blue-400 font-medium text-xs whitespace-nowrap" title={item.walletAddress}>
                              {item.walletAddress.slice(0, 4)}...{item.walletAddress.slice(-4)}
                            </td>
                            <td className="px-4 py-3 text-neutral-300 break-words max-w-sm">
                              {item.message}
                            </td>
                            <td className="px-4 py-3 text-neutral-600 text-xs font-mono">
                              {item.streamId}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="market" className="mt-0">
                 <div className="space-y-6">
                    {loadingMarket ? (
                        <div className="flex flex-col items-center justify-center h-[400px] text-neutral-500 border border-neutral-800 rounded-md bg-black/50">
                             <Loader2 className="w-8 h-8 animate-spin mb-2" />
                             <p>Loading market data...</p>
                        </div>
                    ) : marketData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[400px] text-neutral-500 border border-neutral-800 rounded-md bg-black/50">
                            <BarChart2 className="w-12 h-12 mb-4 opacity-20" />
                            <p>No active markets found.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {marketData.map((market) => (
                                <div key={market.streamId} className="h-[400px] border border-neutral-800 rounded-md overflow-hidden bg-black/20">
                                    <StockMarket 
                                        initialPrice={market.data[0].open} 
                                        currentPrice={market.data[market.data.length-1].close} 
                                        teamName={market.title}
                                        data={market.data}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                 </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

