# PROPHECY 🔮

> **Live Sports. Real Stakes.**
> Don't just watch the game. Own the outcome.

<img width="1920" height="972" alt="Screenshot From 2025-12-12 16-10-54" src="https://github.com/user-attachments/assets/35d0938c-dd25-4c19-ba0f-fb8113046fcf" />

## About The Project

**Prophecy** is a decentralized, real-time prediction market built on **Solana** that transforms passive sports viewing into an active trading experience. It combines live video streaming with a high-speed order book, allowing users to buy and sell "shares" of a team dynamically as the match unfolds.

Instead of placing a one-time bet, users trade the outcome of a game like a stock. If a team scores, their share price goes up; if they fumble, it crashes. Users can enter and exit positions instantly, locking in profits before the game even ends.

## Key Features

### 📺 Live Stream & Trade
Seamlessly integrated interface featuring low-latency live video streams (via YouTube/Twitch embeds) side-by-side with real-time price charts. Watch the action and the market simultaneously.

<img width="1920" height="1009" alt="Screenshot From 2025-12-18 22-43-40" src="https://github.com/user-attachments/assets/a8b989d5-2dc6-4661-9e57-2a5fdf37a09e" />


<img width="1920" height="972" alt="Screenshot From 2025-12-12 16-14-20" src="https://github.com/user-attachments/assets/ee69a9b8-9501-49d7-b216-8cee78303890" />


### 📈 Dynamic Bonding Curves
Powered by **Anchor** smart contracts on Solana, ensuring instant trade execution and automated market making. Price discovery happens in real-time based on buy/sell pressure.

### 💬 Real-Time Chat
Engage with other traders in dedicated, wallet-authenticated chat rooms for every stream.
*   **Socket.io Powered:** Instant message delivery to all connected clients.
*   **Wallet Identity:** Chat handle linked to your Solana wallet address for accountability and reputation.

<img width="1920" height="972" alt="Screenshot From 2025-12-12 23-06-57" src="https://github.com/user-attachments/assets/5accf163-9482-44bc-9330-1b3e3f668f65" />

<img width="1920" height="972" alt="Screenshot From 2025-12-12 16-09-55" src="https://github.com/user-attachments/assets/380ef7c9-056e-4415-b998-cc1d8e452689" />

<img width="1920" height="1009" alt="Screenshot From 2025-12-18 22-44-00" src="https://github.com/user-attachments/assets/b5c648e0-7a43-4d42-8a25-9c1c5a41d400" />


### 🧠 AI Assistant (Gemini)
Built-in AI chatbot powered by Google Gemini to help you make smarter trades.
*   Ask for match stats, player history, or contract details.
*   Get real-time analysis of market trends.
  <img width="1920" height="972" alt="Screenshot From 2025-12-12 16-11-01" src="https://github.com/user-attachments/assets/10eed85c-a6ea-4ef7-ab4a-250cc35423a5" />


### ⚡ Powered by Helius
Utilizes Helius RPCs and event listeners to index on-chain events (Trade Executed, Stream Created, Winnings Claimed) into a MongoDB database for historical analysis and fast frontend retrieval.

![alt text](image.png)

### 👀 Solana Blinks Support
Turn any stream into a shareable, interactive **Blink**. Users can bet directly from Twitter (X) or other platforms via your shared link, thanks to standard Solana Actions integration.

<img width="1920" height="1009" alt="Screenshot From 2025-12-18 19-51-11" src="https://github.com/user-attachments/assets/37fc69b0-edc4-48cf-91c2-0c255274a28f" />


## Tech Stack

*   **Blockchain:** Solana (Anchor Framework)
*   **Frontend:** Next.js (React), TailwindCSS, Shadcn UI
*   **Backend:** Node.js (Express), Socket.io
*   **Database:** MongoDB
*   **Infrastructure:** Helius (RPC & Webhooks)
*   **AI:** Google Gemini API

## Getting Started

### Prerequisites
*   Node.js (v18+)
*   Rust & Anchor CLI (for smart contract development)
*   MongoDB Instance
*   Solana Wallet (Phantom/Backpack)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/prophecy.git
    cd prophecy
    ```

2.  **Install dependencies**
    ```bash
    cd app
    npm install
    ```

3.  **Environment Variables**
    Create a `.env` file in the `app` directory:
    ```env
    MONGO_URI=your_mongodb_connection_string
    HELIUS_RPC_URL=your_helius_rpc_url
    NEXT_PUBLIC_RPC_URL=your_solana_rpc_url # Optional: Defaults to devnet
    ```

### Running the Application

1.  **Start the Next.js Frontend**
    ```bash
    npm run dev
    ```

2.  **Start the Socket Server (for Chat)**
    ```bash
    npm run server
    ```

3.  **Start the Event Listener (for Indexing)**
    ```bash
    npm run listen
    ```

## Architecture

```mermaid
graph TD
    subgraph "Frontend Layer"
        Client[Next.js Client]
        Components[UI Components]
        API[API Routes / Solana Actions]
    end

    subgraph "Backend Services"
        Socket[Socket.io Server]
        Listener[Helius Event Listener]
        DB[(MongoDB)]
    end

    subgraph "Blockchain Infrastructure"
        Solana[Solana Blockchain]
        Program[Prediction Market Program]
        Helius[Helius RPC & Webhooks]
    end

    subgraph "External Integration"
        Blinks[Twitter/Blinks]
    end

    %% Client Interactions
    Client -->|User Interactions| Components
    Components -->|Read/Write| Solana
    Components -->|Fetch History| API
    Components -->|Real-time Chat| Socket

    %% Backend flows
    Socket -->|Store Messages| DB
    API -->|Query Data| DB
    API -->|Construct Transactions| Solana

    %% Blockchain flows
    Solana -->|Host| Program
    Program -->|Emit Events| Helius
    Helius -->|Notify| Listener
    Listener -->|Index Events| DB

    %% External
    Blinks -->|POST Requests| API
```

The application follows a modular architecture:
1.  **Smart Contracts:** Handle logic for creating streams, minting shares, and treasury management.
2.  **Helius Listener:** Listens for `SharesPurchased` events and syncs state to MongoDB.
3.  **Socket Server:** Handles ephemeral chat data and user presence.
4.  **Next.js Client:** Aggregates on-chain data, DB history, and live stream into a unified UI.

## License

Distributed under the MIT License. See `LICENSE` for more information.
