
import {
  ActionPostResponse,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
  createActionHeaders,
  ACTIONS_CORS_HEADERS, // Added ACTIONS_CORS_HEADERS
} from "@solana/actions";
import {
  clusterApiUrl,
  Connection,
  PublicKey,
  Transaction,
  Keypair, 
  LAMPORTS_PER_SOL,
  SystemProgram,
  VersionedTransaction
} from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { PredictionMarket } from "../../../../../program/prediction_market";
import idl from "../../../../../program/prediction_market.json";


// Minimal Wallet implementation for server-side AnchorProvider
class Wallet {
  constructor(readonly payer: Keypair) {}

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof Transaction) {
      tx.partialSign(this.payer);
    } else {
      tx.sign([this.payer]);
    }
    return tx;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return txs.map((t) => {
      if (t instanceof Transaction) {
        t.partialSign(this.payer);
      } else {
        t.sign([this.payer]);
      }
      return t;
    });
  }

  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }
}


// Standard headers for CORS
const headers = createActionHeaders({ headers: ACTIONS_CORS_HEADERS });

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ streamId: string }> }
) => {
  let streamId = "unknown";
  try {
    const resolvedParams = await params;
    streamId = resolvedParams.streamId;
    
    // Setup connection and program
    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("devnet"));
    // Dummy wallet for read-only / instruction building
    const provider = new AnchorProvider(connection, new Wallet(Keypair.generate()), { commitment: "confirmed" });
    const program = new Program<PredictionMarket>(idl as PredictionMarket, provider);

    // Fetch Stream Data
    const streamPda = PublicKey.findProgramAddressSync(
      [Buffer.from("stream"), new BN(streamId).toArrayLike(Buffer, "le", 8)],
      program.programId
    )[0];

    // Try fetching account, fallback to mock if fails (for testing/invalid IDs)
    let streamAccount;
    try {
        streamAccount = await program.account.stream.fetch(streamPda);
    } catch (e) {
        console.warn(`Stream ${streamId} not found, using mock data for Blink preview.`);
        const baseUrl = new URL(req.url).origin;
        const mockPayload: ActionGetResponse = {
            title: "Bet on Stream (Preview)",
            icon: "https://majo.solana.com/assets/majo-logo.png", // Generic solana or app logo
            description: `Stream ID ${streamId} not found on chain. Using mock data for preview verification.`,
            label: "Bet",
            links: {
                actions: [
                    {
                        type: "transaction",
                        label: "Bet on Team A",
                        href: `${baseUrl}/api/actions/bet/${streamId}?team=1&amount={amount}`,
                        parameters: [{ name: "amount", label: "Amount (SOL)", required: true }]
                    }
                ]
            }
        };
        return Response.json(mockPayload, { headers });
    }

    // Construct Metadata
    const title = `Predict: ${streamAccount.teamAName} vs ${streamAccount.teamBName}`;
    const description = streamAccount.isActive 
      ? `Bet on the outcome! Reserves - ${streamAccount.teamAName}: ${(streamAccount.teamAReserve.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL, ${streamAccount.teamBName}: ${(streamAccount.teamBReserve.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL.`
      : `This market has ended. Winner: ${streamAccount.winningTeam === 1 ? streamAccount.teamAName : streamAccount.teamBName}. Claim your winnings now!`;
    
    // Icon
    const imgid = streamAccount.streamLink.split("/")[3];
    const icon = `https://img.youtube.com/vi/${imgid}/maxresdefault.jpg`;

    let links: any = { actions: [] };

    const baseUrl = new URL(req.url).origin;

    if (streamAccount.isActive) {
        links.actions = [
          {
            type: "transaction",
            label: `Bet on ${streamAccount.teamAName}`,
            href: `${baseUrl}/api/actions/bet/${streamId}?team=1&amount={amount}`,
             parameters: [
              {
                name: "amount",
                label: "Amount (SOL)",
                required: true,
              },
            ],
          },
          {
            type: "transaction",
            label: `Bet on ${streamAccount.teamBName}`,
             href: `${baseUrl}/api/actions/bet/${streamId}?team=2&amount={amount}`,
             parameters: [
              {
                name: "amount",
                label: "Amount (SOL)",
                required: true,
              },
            ],
          },
        ];
    } else {
        // Stream Ended - Show Claim Button
        links.actions = [
            {
                type: "transaction",
                label: "Claim Winnings",
                href: `${baseUrl}/api/actions/bet/${streamId}?action=claim`,
            }
        ];
    }

    const payload: ActionGetResponse = {
      title,
      icon,
      description,
      label: streamAccount.isActive ? "Bet" : "Claim",
      links,
    };

    return Response.json(payload, { headers });
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: "Internal error", details: msg }, { status: 500, headers });
  }
};

export const OPTIONS = async () => new Response(null, { status: 200, headers });

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ streamId: string }> }
) => {
  try {
    const { streamId } = await params;
    const url = new URL(req.url);
    const actionParam = url.searchParams.get("action");
    
    // Body and Wallet Setup
    const body: ActionPostRequest = await req.json();
    const userPubkey = new PublicKey(body.account);
    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("devnet"));
    const provider = new AnchorProvider(connection, new Wallet(Keypair.generate()), { commitment: "confirmed" });
    const program = new Program<PredictionMarket>(idl as PredictionMarket, provider);
    
    const bnStreamId = new BN(streamId);

    let ix;
    let message;

    if (actionParam === "claim") {
        // CLAIM WINNINGS
        const [streamPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("stream"), bnStreamId.toArrayLike(Buffer, "le", 8)],
            program.programId
        );
         const [userPositionPda] = PublicKey.findProgramAddressSync(
            [
              Buffer.from("user_position"),
              bnStreamId.toArrayLike(Buffer, "le", 8),
              userPubkey.toBuffer(),
            ],
            program.programId
          );
          const [streamVaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("stream_vault"), bnStreamId.toArrayLike(Buffer, "le", 8)],
            program.programId
          );
        
        ix = await program.methods
            .claimWinnings(bnStreamId)
            .accountsPartial({
                stream: streamPda,
                userPosition: userPositionPda,
                streamVault: streamVaultPda,
                user: userPubkey,
                systemProgram: SystemProgram.programId,
            })
            .instruction();
            
        message = "Winnings Claimed Successfully!";

    } else {
        // BETTING (Default)
        const teamParam = url.searchParams.get("team");
        const amountParam = url.searchParams.get("amount");
        
        if (!teamParam || !amountParam) {
            return Response.json({ error: "Missing team or amount" }, { status: 400, headers });
        }
        
        const teamId = parseInt(teamParam);
        const amountSol = parseFloat(amountParam);

        if (isNaN(teamId) || isNaN(amountSol) || amountSol <= 0) {
            return Response.json({ error: "Invalid parameters" }, { status: 400, headers });
        }

        const [streamPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("stream"), bnStreamId.toArrayLike(Buffer, "le", 8)],
            program.programId
        );
         const [userPositionPda] = PublicKey.findProgramAddressSync(
            [
              Buffer.from("user_position"),
              bnStreamId.toArrayLike(Buffer, "le", 8),
              userPubkey.toBuffer(),
            ],
            program.programId
          );
          const [streamVaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("stream_vault"), bnStreamId.toArrayLike(Buffer, "le", 8)],
            program.programId
          );

        // purchaseShares(streamId, teamId, solAmount)
        const amountLamports = new BN(amountSol * LAMPORTS_PER_SOL);
        
        ix = await program.methods
          .purchaseShares(bnStreamId, teamId, amountLamports)
          .accountsPartial({
            stream: streamPda,
            userPosition: userPositionPda,
            streamVault: streamVaultPda,
            user: userPubkey, // The signer
            systemProgram: SystemProgram.programId,
          })
          .instruction();
          
        message = `Bet ${amountSol} SOL on Team ${teamId === 1 ? 'A' : 'B'} placed!`;
    }

    // Create Transaction
    const transaction = new Transaction();
    transaction.add(ix);
    transaction.feePayer = userPubkey;
    
    // Get latest blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    // Create Action Response
    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        type: "transaction",
        transaction,
        message,
      },
    });

    return Response.json(payload, { headers });

  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: "Failed to create transaction", details: msg }, { status: 400, headers });
  }
};
