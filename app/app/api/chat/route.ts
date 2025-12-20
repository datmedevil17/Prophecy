import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ChatMessage from "@/models/ChatMessage";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "100");
    
    // Fetch logs, sorted by most recent first
    const logs = await ChatMessage.find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ success: true, data: logs }, { status: 200 });
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
