export interface StockData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function generateMockCandles(
  startPrice: number,
  count: number,
  trend: "up" | "down" | "random" = "random"
): StockData[] {
  const data: StockData[] = [];
  const now = Date.now();
  const intervalMs = 60 * 1000; // 1 minute candles

  let currentPrice = startPrice;

  // We generate data ending at 'now', so we loop backwards or forwards?
  // Let's generate chronological order ending at 'now'
  // Start time = now - (count * intervalMs)
  
  const startTime = now - count * intervalMs;

  for (let i = 0; i < count; i++) {
    const time = startTime + i * intervalMs;
    
    // Determine step direction based on trend
    let change = (Math.random() - 0.5) * (startPrice * 0.02); // +/- 1% base volatility

    if (trend === "up") {
      change += startPrice * 0.005; // Bias up
    } else if (trend === "down") {
      change -= startPrice * 0.005; // Bias down
    }

    const open = currentPrice;
    let close = currentPrice + change;
    
    // Ensure no negative prices
    if (close < 0.01) close = 0.01;

    // High/Low derivation
    const high = Math.max(open, close) + Math.random() * (startPrice * 0.01);
    const low = Math.min(open, close) - Math.random() * (startPrice * 0.01);

    // Push candle
    data.push({
      time,
      open,
      high,
      low: Math.max(0.01, low), // Ensure low is positive
      close
    });

    currentPrice = close;
  }

  return data;
}
