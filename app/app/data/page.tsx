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
import { Loader2, RefreshCw } from "lucide-react";

type EventLogItem = {
  _id: string;
  signature: string;
  slot: number;
  eventName: string;
  data: any;
  timestamp: string;
};

export default function DataPage() {
  const [logs, setLogs] = useState<EventLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/events?limit=100");
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
      } else {
        console.error("Failed to fetch events:", json.error);
      }
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Format timestamp
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-6xl">
      <Card className="shadow-lg border-neutral-800 bg-neutral-950 text-neutral-100">
        <CardHeader>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
            Market Data
          </CardTitle>
          <CardDescription className="text-neutral-400">
            Historical events recorded from the Prediction Market.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => fetchData(true)}
              variant="outline"
              disabled={refreshing}
              className="border-neutral-700 hover:bg-neutral-800 text-neutral-300"
            >
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Refresh
            </Button>
          </div>

          <Separator className="bg-neutral-800" />

          <div className="space-y-4">
            <div className="rounded-md border border-neutral-800 bg-black/50 p-4 h-[600px] overflow-auto font-mono text-sm">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                   <Loader2 className="w-8 h-8 animate-spin mb-2" />
                   <p>Loading market data...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                  <p>No data recorded yet.</p>
                  <p className="text-xs mt-2">Interact with the market to generate events.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((item) => (
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
