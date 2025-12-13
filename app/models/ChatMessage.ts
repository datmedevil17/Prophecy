
import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema({
  streamId: { type: String, required: true, index: true },
  walletAddress: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

// Prevent model recompilation error in dev
export default mongoose.models.ChatMessage || mongoose.model("ChatMessage", ChatMessageSchema);
