export type EventLogItem = {
  _id: string;
  signature: string;
  slot: number;
  eventName: string;
  data: any;
  timestamp: string;
};

export function generateMockEvents(count: number): EventLogItem[] {
  const events: EventLogItem[] = [];
  const now = Date.now();
  // Using more realistic event names if they map to specific program instructions
  const eventNames = ["InitializeStream", "PurchaseShares", "SellShares", "ClaimWinnings", "EndStream"];
  
  for (let i = 0; i < count; i++) {
    const eventName = eventNames[Math.floor(Math.random() * eventNames.length)];
    const timeOffset = Math.floor(Math.random() * 1000 * 60 * 60 * 24); // Up to 24 hours ago
    
    // Generate realistic looking object IDs and signatures
    const objectId = Math.floor(Math.random() * 16777215).toString(16).padStart(24, '0');
    
    let eventData = {};
    const streamId = Math.floor(Math.random() * 1000).toString();
    const user = "User" + Math.floor(Math.random() * 10000);
    const amount = (Math.random() * 10 + 0.1).toFixed(2); // Amount in SOL-like terms
    
    switch (eventName) {
        case "InitializeStream":
            eventData = {
                streamId,
                teamAName: "Team Alpha",
                teamBName: "Team Beta",
                startTime: new Date(now - timeOffset + 3600000).toISOString(),
                endTime: new Date(now - timeOffset + 7200000).toISOString(),
                authority: user
            };
            break;
        case "PurchaseShares":
            eventData = {
                streamId,
                teamId: Math.random() > 0.5 ? 1 : 2,
                amount: Math.floor(parseFloat(amount) * 1_000_000_000), // Lamports
                user: user,
                direction: "Long"
            };
            break;
        case "SellShares":
             eventData = {
                streamId,
                teamId: Math.random() > 0.5 ? 1 : 2,
                amount: Math.floor(parseFloat(amount) * 1_000_000_000), // Lamports
                user: user,
                profit: (Math.random() * 0.5).toFixed(4)
            };
            break;
        case "ClaimWinnings":
             eventData = {
                streamId,
                amount: Math.floor(parseFloat(amount) * 2 * 1_000_000_000),
                user: user
             };
             break;
        case "EndStream":
             eventData = {
                streamId,
                winningTeam: Math.random() > 0.5 ? 1 : 2,
                authority: user
             };
             break;
    }

    events.push({
      _id: objectId, // 24 hex chars like mongo id
      signature: generateSignature(),
      slot: 280000000 + Math.floor(Math.random() * 500000),
      eventName,
      data: eventData,
      timestamp: new Date(now - timeOffset).toISOString(),
    });
  }
  
  // Sort by timestamp desc
  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function generateSignature(): string {
    const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let sig = "";
    for(let i=0; i<88; i++) {
        sig += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return sig;
}
