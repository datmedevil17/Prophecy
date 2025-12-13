import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionSignature,
} from "@solana/web3.js";
import { PredictionMarket } from "../program/prediction_market";
import idl from "../program/prediction_market.json";
import { getClusterURL } from "../utils/helper";

const CLUSTER: string = process.env.NEXT_PUBLIC_CLUSTER || "devnet";
const RPC_URL: string = getClusterURL(CLUSTER);

export const getProvider = (
  publicKey: PublicKey | null,
  signTransaction: unknown,
  sendTransaction: unknown
): Program<PredictionMarket> | null => {
  if (!publicKey || !signTransaction) {
    console.log("Wallet not connected or missing signTransaction");
    return null;
  }

  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new AnchorProvider(
    connection,
    { publicKey, signTransaction, sendTransaction } as unknown as Wallet,
    { commitment: "processed" }
  );

  return new Program<PredictionMarket>(idl as PredictionMarket, provider);
};

export const initializeStream = async (
  program: Program<PredictionMarket>,
  wallet: Wallet,
  streamId: BN,
  teamAName: string,
  teamBName: string,
  initialPrice: BN,
  streamDuration: BN,
  streamLink: string
): Promise<TransactionSignature> => {
  const [streamPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stream"), streamId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  const [streamVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stream_vault"), streamId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  const tx = await program.methods
    .initializeStream(
      streamId,
      teamAName,
      teamBName,
      initialPrice,
      streamDuration,
      streamLink
    )
    .accountsPartial({
      stream: streamPda,
      streamVault: streamVaultPda,
      authority: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  const connection = new Connection(
    program.provider.connection.rpcEndpoint,
    "confirmed"
  );

  const latestBlockHash = await connection.getLatestBlockhash();
  await connection.confirmTransaction(
    {
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: tx,
    },
    "finalized"
  );
  return tx;
};

export const purchaseShares = async (
  program: Program<PredictionMarket>,
  wallet: Wallet,
  streamId: BN,
  teamId: number,
  amount: BN
): Promise<TransactionSignature> => {
  const [streamPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stream"), streamId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  const [userPositionPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("user_position"),
      streamId.toArrayLike(Buffer, "le", 8),
      wallet.publicKey.toBuffer(),
    ],
    program.programId
  );

  const [streamVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stream_vault"), streamId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  const tx = await program.methods
    .purchaseShares(streamId, teamId, amount)
    .accountsPartial({
      stream: streamPda,
      userPosition: userPositionPda,
      streamVault: streamVaultPda,
      user: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  const connection = new Connection(
    program.provider.connection.rpcEndpoint,
    "confirmed"
  );

  const latestBlockHash = await connection.getLatestBlockhash();
  await connection.confirmTransaction(
    {
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: tx,
    },
    "finalized"
  );
  return tx;
};

export const claimWinnings = async (
  program: Program<PredictionMarket>,
  wallet: Wallet,
  streamId: BN
): Promise<TransactionSignature> => {
  const [streamPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stream"), streamId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  const [userPositionPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("user_position"),
      streamId.toArrayLike(Buffer, "le", 8),
      wallet.publicKey.toBuffer(),
    ],
    program.programId
  );

  const [streamVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stream_vault"), streamId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  const tx = await program.methods
    .claimWinnings(streamId)
    .accountsPartial({
      stream: streamPda,
      userPosition: userPositionPda,
      streamVault: streamVaultPda,
      user: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  const connection = new Connection(
    program.provider.connection.rpcEndpoint,
    "confirmed"
  );

  const latestBlockHash = await connection.getLatestBlockhash();
  await connection.confirmTransaction(
    {
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: tx,
    },
    "finalized"
  );
  return tx;
};

export const endStream = async (
  program: Program<PredictionMarket>,
  wallet: Wallet,
  streamId: BN,
  winningTeam: number
): Promise<TransactionSignature> => {
  const [streamPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stream"), streamId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  const tx = await program.methods
    .endStream(streamId, winningTeam)
    .accountsPartial({
      stream: streamPda,
      authority: wallet.publicKey,
    })
    .rpc();

  const connection = new Connection(
    program.provider.connection.rpcEndpoint,
    "confirmed"
  );

  const latestBlockHash = await connection.getLatestBlockhash();
  await connection.confirmTransaction(
    {
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: tx,
    },
    "finalized"
  );
  return tx;
};

export const emergencyWithdraw = async (
  program: Program<PredictionMarket>,
  wallet: Wallet,
  streamId: BN
): Promise<TransactionSignature> => {
  const [streamPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stream"), streamId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  const [streamVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stream_vault"), streamId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  const tx = await program.methods
    .emergencyWithdraw(streamId)
    .accountsPartial({
      stream: streamPda,
      streamVault: streamVaultPda,
      authority: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  const connection = new Connection(
    program.provider.connection.rpcEndpoint,
    "confirmed"
  );

  const latestBlockHash = await connection.getLatestBlockhash();
  await connection.confirmTransaction(
    {
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: tx,
    },
    "finalized"
  );
  return tx;
};

export const getStream = async (
  program: Program<PredictionMarket>,
  streamId: BN
) => {
  const [streamPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stream"), streamId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  return await program.account.stream.fetch(streamPda);
};

export const getAllStreams = async (program: Program<PredictionMarket>) => {
  return await program.account.stream.all();
};

export const getUserPosition = async (
  program: Program<PredictionMarket>,
  streamId: BN,
  wallet: Wallet
) => {
  const [userPositionPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("user_position"),
      streamId.toArrayLike(Buffer, "le", 8),
      wallet.publicKey.toBuffer(),
    ],
    program.programId
  );

  return await program.account.userPosition.fetch(userPositionPda);
};

export const getUsersStreams = async (
  program: Program<PredictionMarket>,
  wallet: Wallet
) => {
  return await program.account.stream.all([
    {
      memcmp: {
        offset: 8, // Discriminator is 8 bytes, authority is the first field
        bytes: wallet.publicKey.toBase58(),
      },
    },
  ]);
};

export const getUserPositions = async (
  program: Program<PredictionMarket>,
  wallet: Wallet
) => {
  return await program.account.userPosition.all([
    {
      memcmp: {
        offset: 8, // Discriminator is 8 bytes, user is the first field
        bytes: wallet.publicKey.toBase58(),
      },
    },
  ]);
};

export const getNextStreamId = async (program: Program<PredictionMarket>) => {
  const streams = await program.account.stream.all();
  let maxId = new BN(0);

  for (const stream of streams) {
    if (stream.account.streamId.gt(maxId)) {
      maxId = stream.account.streamId;
    }
  }

  return maxId.add(new BN(1));
};

export const getStreamPrices = async (
  program: Program<PredictionMarket>,
  streamId: BN
) => {
  const stream = await getStream(program, streamId);
  return {
    teamAName: stream.teamAName,
    teamBName: stream.teamBName,
    teamAPrice: stream.teamAPrice,
    teamBPrice: stream.teamBPrice,
    teamAShares: stream.teamAShares,
    teamBShares: stream.teamBShares,
    totalPool: stream.totalPool,
  };
};