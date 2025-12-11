import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Prophecy } from "../target/types/prophecy";
import { expect } from "chai";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

describe("prophecy", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Prophecy as Program<Prophecy>;
  const authority = provider.wallet as anchor.Wallet;
  
  // Test users
  let user1: anchor.web3.Keypair;
  let user2: anchor.web3.Keypair;
  
  // Stream configuration
  const streamId = new anchor.BN(Date.now());
  const teamAName = "Team Alpha";
  const teamBName = "Team Beta";
  const initialPrice = new anchor.BN(1_000_000); // 0.001 SOL
  const streamDuration = new anchor.BN(3600); // 1 hour

  // PDAs
  let streamPda: PublicKey;
  let streamBump: number;
  let streamVaultPda: PublicKey;
  let streamVaultBump: number;
  let user1PositionPda: PublicKey;
  let user2PositionPda: PublicKey;

  before(async () => {
    // Create test users
    user1 = anchor.web3.Keypair.generate();
    user2 = anchor.web3.Keypair.generate();

    // Airdrop SOL to test users
    const airdropSig1 = await provider.connection.requestAirdrop(
      user1.publicKey,
      5 * LAMPORTS_PER_SOL
    );
    const airdropSig2 = await provider.connection.requestAirdrop(
      user2.publicKey,
      5 * LAMPORTS_PER_SOL
    );

    await provider.connection.confirmTransaction(airdropSig1);
    await provider.connection.confirmTransaction(airdropSig2);

    // Derive PDAs
    [streamPda, streamBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("stream"), streamId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    [streamVaultPda, streamVaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("stream_vault"), streamId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    [user1PositionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_position"),
        streamId.toArrayLike(Buffer, "le", 8),
        user1.publicKey.toBuffer(),
      ],
      program.programId
    );

    [user2PositionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_position"),
        streamId.toArrayLike(Buffer, "le", 8),
        user2.publicKey.toBuffer(),
      ],
      program.programId
    );
  });

  describe("Initialize Stream", () => {
    it("Successfully initializes a new prediction stream", async () => {
      const tx = await program.methods
        .initializeStream(
          streamId,
          teamAName,
          teamBName,
          initialPrice,
          streamDuration
        )
        .accounts({
          stream: streamPda,
          streamVault: streamVaultPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Initialize stream transaction signature:", tx);

      // Fetch and verify stream account
      const streamAccount = await program.account.stream.fetch(streamPda);
      
      expect(streamAccount.authority.toString()).to.equal(authority.publicKey.toString());
      expect(streamAccount.streamId.toString()).to.equal(streamId.toString());
      expect(streamAccount.teamAName).to.equal(teamAName);
      expect(streamAccount.teamBName).to.equal(teamBName);
      expect(streamAccount.teamAShares.toString()).to.equal("0");
      expect(streamAccount.teamBShares.toString()).to.equal("0");
      expect(streamAccount.teamAPrice.toString()).to.equal(initialPrice.toString());
      expect(streamAccount.teamBPrice.toString()).to.equal(initialPrice.toString());
      expect(streamAccount.totalPool.toString()).to.equal("0");
      expect(streamAccount.isActive).to.be.true;
      expect(streamAccount.winningTeam).to.equal(0);
    });

    it("Fails to initialize with team name too long", async () => {
      const longName = "a".repeat(33); // Max is 32
      const newStreamId = new anchor.BN(Date.now() + 1);
      const [newStreamPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stream"), newStreamId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      const [newVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stream_vault"), newStreamId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      try {
        await program.methods
          .initializeStream(
            newStreamId,
            longName,
            teamBName,
            initialPrice,
            streamDuration
          )
          .accounts({
            stream: newStreamPda,
            streamVault: newVaultPda,
            authority: authority.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("NameTooLong");
      }
    });

    it("Fails to initialize with invalid price", async () => {
      const newStreamId = new anchor.BN(Date.now() + 2);
      const [newStreamPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stream"), newStreamId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      const [newVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stream_vault"), newStreamId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      try {
        await program.methods
          .initializeStream(
            newStreamId,
            teamAName,
            teamBName,
            new anchor.BN(0), // Invalid price
            streamDuration
          )
          .accounts({
            stream: newStreamPda,
            streamVault: newVaultPda,
            authority: authority.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("InvalidPrice");
      }
    });
  });

  describe("Purchase Shares", () => {
    it("User1 successfully purchases Team A shares", async () => {
      const amount = new anchor.BN(10);
      
      const tx = await program.methods
        .purchaseShares(streamId, 1, amount) // Team A = 1
        .accounts({
          stream: streamPda,
          userPosition: user1PositionPda,
          streamVault: streamVaultPda,
          user: user1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      console.log("User1 purchase transaction signature:", tx);

      // Verify stream state
      const streamAccount = await program.account.stream.fetch(streamPda);
      expect(streamAccount.teamAShares.toString()).to.equal(amount.toString());
      expect(streamAccount.totalPool.toNumber()).to.be.greaterThan(0);

      // Verify user position
      const userPosition = await program.account.userPosition.fetch(user1PositionPda);
      expect(userPosition.user.toString()).to.equal(user1.publicKey.toString());
      expect(userPosition.teamAShares.toString()).to.equal(amount.toString());
      expect(userPosition.teamBShares.toString()).to.equal("0");
      expect(userPosition.totalInvested.toNumber()).to.be.greaterThan(0);
      expect(userPosition.hasClaimed).to.be.false;
    });

    it("User2 successfully purchases Team B shares", async () => {
      const amount = new anchor.BN(15);
      
      const tx = await program.methods
        .purchaseShares(streamId, 2, amount) // Team B = 2
        .accounts({
          stream: streamPda,
          userPosition: user2PositionPda,
          streamVault: streamVaultPda,
          user: user2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user2])
        .rpc();

      console.log("User2 purchase transaction signature:", tx);

      // Verify stream state
      const streamAccount = await program.account.stream.fetch(streamPda);
      expect(streamAccount.teamBShares.toString()).to.equal(amount.toString());
      
      // Verify user position
      const userPosition = await program.account.userPosition.fetch(user2PositionPda);
      expect(userPosition.teamBShares.toString()).to.equal(amount.toString());
      expect(userPosition.teamAShares.toString()).to.equal("0");
    });

    it("User1 purchases more Team A shares (accumulation)", async () => {
      const additionalAmount = new anchor.BN(5);
      
      const userPositionBefore = await program.account.userPosition.fetch(user1PositionPda);
      const previousShares = userPositionBefore.teamAShares;

      await program.methods
        .purchaseShares(streamId, 1, additionalAmount)
        .accounts({
          stream: streamPda,
          userPosition: user1PositionPda,
          streamVault: streamVaultPda,
          user: user1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      const userPositionAfter = await program.account.userPosition.fetch(user1PositionPda);
      expect(userPositionAfter.teamAShares.toString()).to.equal(
        previousShares.add(additionalAmount).toString()
      );
    });

    it("Fails to purchase shares with invalid team ID", async () => {
      try {
        await program.methods
          .purchaseShares(streamId, 3, new anchor.BN(1)) // Invalid team ID
          .accounts({
            stream: streamPda,
            userPosition: user1PositionPda,
            streamVault: streamVaultPda,
            user: user1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([user1])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("InvalidTeam");
      }
    });

    it("Fails to purchase shares with zero amount", async () => {
      try {
        await program.methods
          .purchaseShares(streamId, 1, new anchor.BN(0))
          .accounts({
            stream: streamPda,
            userPosition: user1PositionPda,
            streamVault: streamVaultPda,
            user: user1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([user1])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("InvalidAmount");
      }
    });

    it("Verifies price changes based on demand", async () => {
      const streamBefore = await program.account.stream.fetch(streamPda);
      const teamAPriceBefore = streamBefore.teamAPrice;
      const teamBPriceBefore = streamBefore.teamBPrice;

      // Purchase more Team A shares
      await program.methods
        .purchaseShares(streamId, 1, new anchor.BN(20))
        .accounts({
          stream: streamPda,
          userPosition: user1PositionPda,
          streamVault: streamVaultPda,
          user: user1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      const streamAfter = await program.account.stream.fetch(streamPda);
      
      // Team A price should increase (bonding curve)
      expect(streamAfter.teamAPrice.toNumber()).to.be.greaterThan(teamAPriceBefore.toNumber());
      
      // Team B price should decrease slightly
      expect(streamAfter.teamBPrice.toNumber()).to.be.lessThan(teamBPriceBefore.toNumber());
    });
  });

  describe("End Stream", () => {
    it("Fails to end stream before end time", async () => {
      try {
        await program.methods
          .endStream(streamId, 1) // Team A wins
          .accounts({
            stream: streamPda,
            authority: authority.publicKey,
          })
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("StreamNotEnded");
      }
    });

    it("Fails when non-authority tries to end stream", async () => {
      // Wait for stream to end (in real test, you'd need to wait or manipulate time)
      // For now, we'll just test the authorization check
      try {
        await program.methods
          .endStream(streamId, 1)
          .accounts({
            stream: streamPda,
            authority: user1.publicKey,
          })
          .signers([user1])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Unauthorized");
      }
    });

    // Note: To properly test ending the stream, you'd need to either:
    // 1. Wait for the actual duration to pass
    // 2. Use a shorter duration in tests
    // 3. Use a clock manipulation technique if available in your testing framework
    
    it("Successfully ends stream after duration (simulated)", async () => {
      // For a complete test, you would need to wait or manipulate the clock
      // This is a placeholder showing the structure
      
      // In a real scenario, you'd do:
      // await sleep(streamDuration * 1000);
      // Or initialize with a very short duration for testing
      
      console.log("Note: This test requires waiting for stream duration or clock manipulation");
    });
  });

  describe("Claim Winnings", () => {
    it("Fails to claim winnings while stream is active", async () => {
      try {
        await program.methods
          .claimWinnings(streamId)
          .accounts({
            stream: streamPda,
            userPosition: user1PositionPda,
            streamVault: streamVaultPda,
            user: user1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([user1])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("StreamStillActive");
      }
    });

    // Additional claim tests would go here after stream is properly ended
  });

  describe("Emergency Withdraw", () => {
    it("Fails when stream is still active", async () => {
      try {
        await program.methods
          .emergencyWithdraw(streamId)
          .accounts({
            stream: streamPda,
            streamVault: streamVaultPda,
            authority: authority.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("StreamStillActive");
      }
    });

    it("Fails when non-authority tries emergency withdraw", async () => {
      try {
        await program.methods
          .emergencyWithdraw(streamId)
          .accounts({
            stream: streamPda,
            streamVault: streamVaultPda,
            authority: user1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([user1])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Unauthorized");
      }
    });
  });

  describe("Complete Flow Test", () => {
    it("Full prediction market flow with short duration", async () => {
      // Create a new stream with very short duration for testing
      const testStreamId = new anchor.BN(Date.now() + 1000);
      const shortDuration = new anchor.BN(2); // 2 seconds for testing
      
      const [testStreamPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stream"), testStreamId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      
      const [testVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stream_vault"), testStreamId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      
      const [testUser1PosPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_position"),
          testStreamId.toArrayLike(Buffer, "le", 8),
          user1.publicKey.toBuffer(),
        ],
        program.programId
      );

      // 1. Initialize stream
      await program.methods
        .initializeStream(
          testStreamId,
          "Quick Team A",
          "Quick Team B",
          initialPrice,
          shortDuration
        )
        .accounts({
          stream: testStreamPda,
          streamVault: testVaultPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // 2. User purchases shares
      await program.methods
        .purchaseShares(testStreamId, 1, new anchor.BN(10))
        .accounts({
          stream: testStreamPda,
          userPosition: testUser1PosPda,
          streamVault: testVaultPda,
          user: user1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      // 3. Wait for stream to end
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 4. End stream
      await program.methods
        .endStream(testStreamId, 1) // Team A wins
        .accounts({
          stream: testStreamPda,
          authority: authority.publicKey,
        })
        .rpc();

      // Verify stream ended
      const endedStream = await program.account.stream.fetch(testStreamPda);
      expect(endedStream.isActive).to.be.false;
      expect(endedStream.winningTeam).to.equal(1);

      // 5. User claims winnings
      const userBalanceBefore = await provider.connection.getBalance(user1.publicKey);
      
      await program.methods
        .claimWinnings(testStreamId)
        .accounts({
          stream: testStreamPda,
          userPosition: testUser1PosPda,
          streamVault: testVaultPda,
          user: user1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      const userBalanceAfter = await provider.connection.getBalance(user1.publicKey);
      
      // User should have received winnings
      expect(userBalanceAfter).to.be.greaterThan(userBalanceBefore);

      // Verify claimed status
      const claimedPosition = await program.account.userPosition.fetch(testUser1PosPda);
      expect(claimedPosition.hasClaimed).to.be.true;

      // 6. Try to claim again (should fail)
      try {
        await program.methods
          .claimWinnings(testStreamId)
          .accounts({
            stream: testStreamPda,
            userPosition: testUser1PosPda,
            streamVault: testVaultPda,
            user: user1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([user1])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("AlreadyClaimed");
      }

      console.log("✅ Complete flow test passed!");
    });
  });
});