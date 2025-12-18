
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import EventLog from "@/models/EventLog";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "100");
    
    // Fetch logs, sorted by most recent first
    const logs = await EventLog.find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ success: true, data: logs }, { status: 200 });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
