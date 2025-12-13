"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Connection, PublicKey, ParsedTransactionWithMeta } from "@solana/web3.js";
import { BorshCoder, EventParser, Idl } from "@coral-xyz/anchor";
import idl from "../../program/prediction_market.json";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import { getClusterURL } from "../../utils/helper";

// Define the event type based on what we expect from the parser
type ParsedEvent = {
  name: string;
  data: any;
  signature: string;
  slot: number;
  timestamp: number;
};

type LogItem = {
  type: "log" | "event";
  content: string | ParsedEvent;
  id: string;
  timestamp: Date;
};

const PROGRAM_ID = new PublicKey(idl.address);

export default function DataPage() {
  const [rpcUrl, setRpcUrl] = useState("https://devnet.helius-rpc.com/?api-key=9ca29b35-645b-47ec-8787-af25bc43be2c");
  const [isListening, setIsListening] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const subscriptionIdRef = useRef<number | null>(null);
  const connectionRef = useRef<Connection | null>(null);

  // Initialize Anchor tools for parsing
  const coder = new BorshCoder(idl as Idl);
  const eventParser = new EventParser(PROGRAM_ID, coder);

  const toggleListening = useCallback(async () => {
    if (isListening) {
      // Stop listening
      if (connectionRef.current && subscriptionIdRef.current !== null) {
        await connectionRef.current.removeOnLogsListener(subscriptionIdRef.current);
        subscriptionIdRef.current = null;
      }
      setIsListening(false);
    } else {
      // Start listening
      try {
        const connection = new Connection(rpcUrl, "confirmed");
        connectionRef.current = connection;

        console.log("Starting listener on", PROGRAM_ID.toString());
        
        const subscriptionId = connection.onLogs(
          PROGRAM_ID,
          (logsResponse, ctx) => {
            const timestamp = new Date();
            const signature = logsResponse.signature;
            const slot = ctx.slot;

            // Add raw logs first
            const rawLogItems: LogItem[] = logsResponse.logs.map((log, index) => ({
              type: "log",
              content: log,
              id: `${signature}-log-${index}`,
              timestamp,
            }));

            // Attempt to parse events
            const parsedEvents: LogItem[] = [];
            try {
              const events = eventParser.parseLogs(logsResponse.logs);
              // parseLogs returns a generator, iterate it
              for (const event of events) {
                parsedEvents.push({
                  type: "event",
                  content: {
                    name: event.name,
                    data: event.data,
                    signature,
                    slot,
                    timestamp: timestamp.getTime(),
                  },
                  id: `${signature}-event-${parsedEvents.length}`,
                  timestamp,
                });
              }
            } catch (e) {
              console.error("Error parsing logs:", e);
            }

            // Update state with new items at the top
            setLogs((prev) => [...parsedEvents, ...rawLogItems, ...prev]);
          },
          "confirmed"
        );

        subscriptionIdRef.current = subscriptionId;
        setIsListening(true);
      } catch (error) {
        console.error("Failed to connect:", error);
        alert("Failed to start listener. Check console for details.");
      }
    }
  }, [isListening, rpcUrl, eventParser]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionRef.current && subscriptionIdRef.current !== null) {
        connectionRef.current.removeOnLogsListener(subscriptionIdRef.current);
      }
    };
  }, []);

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-6xl">
      <Card className="shadow-lg border-neutral-800 bg-neutral-950 text-neutral-100">
        <CardHeader>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
            Data Stream
          </CardTitle>
          <CardDescription className="text-neutral-400">
            Listen to live events and logs from the Prediction Market program.
            <br />
            For best results, use a Helius RPC URL for reliable event delivery.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="grid w-full gap-2">
              <Label htmlFor="rpc-url" className="text-neutral-300">
                RPC URL (Helius / Devnet)
              </Label>
              <Input
                id="rpc-url"
                value={rpcUrl}
                onChange={(e) => setRpcUrl(e.target.value)}
                placeholder="https://mainnet.helius-rpc.com/?api-key=..."
                className="bg-neutral-900 border-neutral-700 text-neutral-200"
                disabled={isListening}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={toggleListening}
                variant={isListening ? "destructive" : "default"}
                className={isListening ? "bg-red-600 hover:bg-red-700" : "bg-teal-600 hover:bg-teal-700"}
              >
                {isListening ? "Stop Listening" : "Start Listening"}
              </Button>
              <Button
                onClick={clearLogs}
                variant="outline"
                className="border-neutral-700 hover:bg-neutral-800 text-neutral-300"
              >
                Clear
              </Button>
            </div>
          </div>

          <Separator className="bg-neutral-800" />

          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-neutral-200">
              Live Feed {isListening && <span className="animate-pulse text-green-500">●</span>}
            </h3>
            
            <div className="rounded-md border border-neutral-800 bg-black/50 p-4 h-[600px] overflow-auto font-mono text-sm">
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                  <p>No data received yet.</p>
                  <p className="text-xs mt-2">Start listening and interact with the program to see events.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded border-l-2 ${
                        item.type === "event"
                          ? "border-purple-500 bg-purple-500/10"
                          : "border-neutral-600 bg-neutral-900/50"
                      }`}
                    >
                      <div className="flex justify-between text-xs text-neutral-500 mb-1">
                        <span className="uppercase tracking-wider font-bold">
                          {item.type === "event" ? "⚓ ANCHOR EVENT" : "📜 RAW LOG"}
                        </span>
                        <span>{item.timestamp.toLocaleTimeString()}</span>
                      </div>
                      
                      {item.type === "event" ? (
                        <div>
                          <p className="text-purple-300 font-bold text-base mb-1">
                            {(item.content as ParsedEvent).name}
                          </p>
                          <pre className="text-neutral-300 overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify((item.content as ParsedEvent).data, null, 2)}
                          </pre>
                          <p className="text-xs text-neutral-600 mt-2">
                            Sig: {(item.content as ParsedEvent).signature.slice(0, 16)}...
                          </p>
                        </div>
                      ) : (
                        <p className="text-neutral-400 break-all">
                          {item.content as string}
                        </p>
                      )}
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
