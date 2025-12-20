"use client"

import { useState, useEffect } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Activity } from "lucide-react"

export interface StockData {
  time: number
  open: number
  high: number;
  low: number
  close: number
}

// Custom Candlestick Shape
const Candle = (props: any) => {
  const { x, y, width, height, payload } = props;
  const { open, close, high, low } = payload;
  const isUp = close > open;
  
  // Calculate pixel ratios
  // The 'height' prop passed to this shape corresponds to the height of the Bar (which covers the full range [low, high])
  // The 'y' prop corresponds to the top pixel of the Bar (the 'high' value)
  
  // Avoid division by zero
  const range = high - low;
  const pixelPerUnit = range === 0 ? 0 : height / range;

  // Calculate body dimensions
  const bodyTopValue = Math.max(open, close);
  const bodyBottomValue = Math.min(open, close);
  
  const bodyTopOffset = (high - bodyTopValue) * pixelPerUnit;
  const bodyHeight = Math.max(1, (bodyTopValue - bodyBottomValue) * pixelPerUnit); // Ensure at least 1px height

  const color = isUp ? "#10b981" : "#ef4444"; // emerald-500 : red-500
  const wickWidth = 2;
  const xCenter = x + width / 2;

  return (
    <g>
      {/* Wick */}
      <line 
        x1={xCenter} 
        y1={y} 
        x2={xCenter} 
        y2={y + height} 
        stroke={color} 
        strokeWidth={wickWidth} 
      />
      {/* Body */}
      <rect 
        x={x} 
        y={y + bodyTopOffset} 
        width={width} 
        height={bodyHeight} 
        fill={color} 
        stroke="none"
      />
    </g>
  );
};

interface StockMarketProps {
    initialPrice?: number
    currentPrice?: number
    teamName?: string
    data?: StockData[]
}

export function StockMarket({ initialPrice = 150, currentPrice = 150, teamName = "Market", data: providedData }: StockMarketProps) {
  const [data, setData] = useState<StockData[]>([])
  const [trend, setTrend] = useState<"up" | "down">("up")

  // Generate data path from initial to current
  useEffect(() => {
    if (providedData && providedData.length > 0) {
        setData(providedData);
        // Determine trend from last candle
        const lastCandle = providedData[providedData.length - 1];
        const firstCandle = providedData[0];
        setTrend(lastCandle.close >= firstCandle.open ? "up" : "down");
        return;
    }

    const steps = 50;
    const initialData: StockData[] = [];
    const now = Date.now();
    const intervalMs = 60 * 1000;
    
    // Simple linear interpolation with noise
    // We want step 0 = initialPrice, step 49 = currentPrice
    // But we are generating backwards in time... 
    // let's say index 0 is oldest (50 mins ago) -> initialPrice
    // index 49 is newest (now) -> currentPrice
    
    const priceDiff = currentPrice - initialPrice;
    const stepSize = priceDiff / steps;

    for (let i = 0; i < steps; i++) {
        // Linear path
        let basePrice = initialPrice + (stepSize * i);
        
        // Add random walk / noise, but constrain start/end
        // Noise should be zero at start and end for smooth connection? 
        // Or just let it wander but trend towards target.
        
        // Let's just do random walk and force the last point to be currentPrice
        // Actually, easiest way is: 
        // calculate "trend" step + noise
        
        const noise = (Math.random() - 0.5) * (initialPrice * 0.05); // 5% noise path
        const open = Math.max(0.01, basePrice + noise); // Ensure positive
        
        // Next close (approx next step base)
        const nextBase = initialPrice + (stepSize * (i + 1));
        const nextNoise = (Math.random() - 0.5) * (initialPrice * 0.05);
        let close = Math.max(0.01, nextBase + nextNoise);

        // Force last candle close to be exactly currentPrice
        if (i === steps - 1) {
            close = currentPrice;
        }

        const high = Math.max(open, close) + Math.random() * (initialPrice * 0.02);
        const low = Math.min(open, close) - Math.random() * (initialPrice * 0.02);
        
        initialData.push({
            time: now - ((steps - 1 - i) * intervalMs),
            open,
            high,
            low,
            close
        });
    }
    
    setData(initialData);
    setTrend(currentPrice >= initialPrice ? "up" : "down");

  }, [initialPrice, currentPrice, providedData]);

  const formatPrice = (price: number) => `$${price.toFixed(4)}`;

  return (
    <Card className="border-2 border-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] h-full bg-white flex flex-col rounded-none">
        <CardHeader className="pb-4 border-b-2 border-zinc-900">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-zinc-900 text-white rounded-none">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div>
                        <CardTitle className="text-xl font-bold text-zinc-900 font-orbitron tracking-wider">{teamName} Market</CardTitle>
                        <CardDescription className="font-mono text-xs uppercase">Real-time OHLC Feed</CardDescription>
                    </div>
                </div>
                
                <div className="text-right">
                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Price Action (SOL)</div>
                    <div className={`flex items-center justify-end gap-1.5 text-2xl font-mono font-bold ${trend === 'up' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatPrice(currentPrice)}
                        {trend === 'up' ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
                    </div>
                </div>
            </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 min-h-[300px] bg-zinc-50 relative">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
              <XAxis 
                dataKey="time" 
                hide 
                type="number" 
                domain={['dataMin', 'dataMax']} 
              />
              <YAxis 
                orientation="right" 
                tick={{fill: '#52525b', fontSize: 12, fontFamily: 'monospace'}} 
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
                tickFormatter={(val) => val.toFixed(4)}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                            <div className="bg-white border-2 border-zinc-900 p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-mono text-xs">
                                <div className="font-bold mb-2 text-zinc-900">Price Action</div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    <span className="text-zinc-500">Open:</span>
                                    <span className="text-right font-bold">{d.open.toFixed(4)}</span>
                                    <span className="text-zinc-500">High:</span>
                                    <span className="text-right font-bold">{d.high.toFixed(4)}</span>
                                    <span className="text-zinc-500">Low:</span>
                                    <span className="text-right font-bold">{d.low.toFixed(4)}</span>
                                    <span className="text-zinc-500">Close:</span>
                                    <span className={`text-right font-bold ${d.close > d.open ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {d.close.toFixed(4)}
                                    </span>
                                </div>
                            </div>
                        );
                    }
                    return null;
                }}
              />
              <Bar 
                dataKey={(data) => [data.low, data.high]} // Pass the full range [low, high] to determine bar height and position
                shape={<Candle />} 
                isAnimationActive={false} // Disable animation for smoother updates
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
    </Card>
  )
}
