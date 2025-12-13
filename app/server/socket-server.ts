
import express from "express";
import { Server } from "socket.io";
// @ts-ignore
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import ChatMessage from "../models/ChatMessage";

dotenv.config();

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ MONGO_URI is missing in .env");
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected for Socket Server"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join_stream", async (streamId) => {
    socket.join(streamId);
    console.log(`User ${socket.id} joined stream: ${streamId}`);

    // Fetch history
    try {
      const messages = await ChatMessage.find({ streamId })
        .sort({ timestamp: 1 }) // Oldest first
        .limit(50);
      
      socket.emit("chat_history", messages);
    } catch (err) {
      console.error("Error fetching chat history:", err);
    }
  });

  socket.on("send_message", async (data) => {
    // data: { streamId, message, walletAddress }
    console.log(`Message in ${data.streamId} from ${data.walletAddress}: ${data.message}`);

    try {
      // Save to DB
      const newMsg = await ChatMessage.create({
        streamId: data.streamId,
        walletAddress: data.walletAddress,
        message: data.message,
        timestamp: new Date()
      });

      // Broadcast with DB ID and timestamp
      io.to(data.streamId).emit("receive_message", {
        streamId: newMsg.streamId,
        walletAddress: newMsg.walletAddress,
        message: newMsg.message,
        timestamp: newMsg.timestamp,
        // _id: newMsg._id // Optional if frontend needs it
      });
      
    } catch (err) {
      console.error("Error saving message:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected", socket.id);
  });
});

const PORT = 3001;

server.listen(PORT, () => {
  console.log(`SOCKET SERVER RUNNING ON PORT ${PORT}`);
});
