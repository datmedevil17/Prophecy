import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { Idl, EventParser, BorshCoder } from "@coral-xyz/anchor";
import dbConnect from "@/lib/db";
import EventLog from "@/models/EventLog";
import idl from "@/program/prediction_market.json";

// Ensure IDL is typed correctly for Anchor
const programIdl = idl as Idl;
const PROGRAM_ID = new PublicKey(idl.address);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Helius webhook payload is an array of transactions
    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid payload, expected array of transactions" },
        { status: 400 }
      );
    }

    await dbConnect();

    const coder = new BorshCoder(programIdl);
    const eventParser = new EventParser(PROGRAM_ID, coder);

    let savedCount = 0;

    for (const tx of body) {
      if (tx.meta && tx.meta.err) continue; // Skip failed transactions

      const signature = tx.signature;
      const slot = tx.slot;
      // Use blockTime if available, otherwise current time
      const timestamp = tx.blockTime
        ? new Date(tx.blockTime * 1000)
        : new Date();

      // Helius provides "logs" in meta
      const logs = tx.meta?.logMessages || [];

      // Parse logs using Anchor
      // parseLogs takes a string array, which helius provides
      for (const event of eventParser.parseLogs(logs)) {
        console.log(`✨ Event Found: ${event.name} in ${signature}`);

        try {
          await EventLog.create({
            signature: signature,
            slot: slot,
            eventName: event.name,
            data: event.data,
            timestamp: timestamp,
          });
          savedCount++;
        } catch (dbErr: any) {
             if (dbErr.code === 11000) {
               console.warn(`   ⚠️ Duplicate entry skipped.`);
             } else {
               console.error(`   ❌ DB Error:`, dbErr);
             }
        }
      }
    }

    return NextResponse.json({ success: true, saved: savedCount }, { status: 200 });
  } catch (error) {
    console.error("Error processing Helius webhook:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
