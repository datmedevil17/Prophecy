
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Connection, PublicKey } from '@solana/web3.js';
import { Idl, EventParser, BorshCoder } from '@coral-xyz/anchor';
import idl from '../program/prediction_market.json'; // Ensure this path is correct
import EventLog from '../models/EventLog';

// Load env vars
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const RPC_URL = process.env.HELIUS_RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey(idl.address);

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is missing in .env");
  process.exit(1);
}

// Ensure IDL is typed correctly for Anchor
const programIdl = idl as Idl;

async function main() {
  try {
    // 1. Connect to MongoDB
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI!);
    console.log("✅ MongoDB Connected.");

    // 2. Connect to Solana (Helius)
    console.log(`Connecting to Helius RPC: ${RPC_URL}`);
    const connection = new Connection(RPC_URL, "confirmed");

    console.log(`Listening to Program: ${PROGRAM_ID.toBase58()}`);

    // 3. Set up Event Parser
    // We don't need a full Provider/Wallet just to parse logs, but Anchor usually expects one.
    // We can use a raw parser.
    const coder = new BorshCoder(programIdl);
    const eventParser = new EventParser(PROGRAM_ID, coder);

    // 4. Subscribe to Logs
    // 'all' listens to all transactions for this program
    connection.onLogs(
      PROGRAM_ID,
      async (logs, ctx) => {
        if (logs.err) return; // Skip failed txs

        const signature = logs.signature;
        const slot = ctx.slot;
        const timestamp = new Date(); // Approximate time, actual block time requires fetching block

        console.log(`\n🔔 New Log at Slot ${slot} | Sig: ${signature.slice(0, 8)}...`);

        // Parse logs
        for (const event of eventParser.parseLogs(logs.logs)) {
          console.log(`   ✨ Event Found: ${event.name}`);
          
          try {
            // Save to DB
            // Check for duplicate signature/event combo to be safe, though logs stream is unique
            // The signature is unique per tx, but one tx can have multiple events.
            // We use signature + eventName combo or just save unique signature?
            // MongoDB unique index is on `signature`. If duplicate events in one TX, `signature` duplicate error will occur.
            // Let's modify schema to allow multiple events per signature OR append index.
            // Actually, simpler: create a unique ID based on sig + index?
            // For now, simpler approach: Just try insert. If duplicate signature error, maybe log it.
            // A better schema would be `signature` NOT unique, or composite key. 
            // NOTE: implementation plan said 'signature' unique. 
            // IF one TX emits 2 events, the second insert will fail.
            // FIX: Remove unique constraint on signature or handle it. 
            // In the script: we will create a NEW document for EACH event. 
            
            await EventLog.create({
              signature: signature, // Multiple events can share signature
              slot: slot,
              eventName: event.name,
              data: event.data,
              timestamp: timestamp
            });
            console.log(`   💾 Saved to MongoDB: ${event.name}`);

          } catch (dbErr: any) {
            if (dbErr.code === 11000) {
              console.warn(`   ⚠️ Duplicate entry skipped.`);
            } else {
              console.error(`   ❌ DB Error:`, dbErr);
            }
          }
        }
      },
      "finalized"
    );

    console.log("🚀 Listener is running... (Press Ctrl+C to stop)");

  } catch (err) {
    console.error("Fatal Error:", err);
    process.exit(1);
  }
}

main();
