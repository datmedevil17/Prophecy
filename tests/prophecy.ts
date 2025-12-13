import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PredictionMarket } from "../target/types/prediction_market";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert, expect } from "chai";

describe("Prophecy Prediction Market", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PredictionMarket as Program<PredictionMarket>;
  const authority = provider.wallet as anchor.Wallet;

  // Helper function to derive PDAs
  const getStreamPDA = (streamId: number) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("stream"), new anchor.BN(streamId).toArrayLike(Buffer, "le", 8)],
      program.programId
    );
  };

  const getStreamVaultPDA = (streamId: number) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("stream_vault"), new anchor.BN(streamId).toArrayLike(Buffer, "le", 8)],
      program.programId
    );
  };

  const getUserPositionPDA = (streamId: number, user: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_position"),
        new anchor.BN(streamId).toArrayLike(Buffer, "le", 8),
        user.toBuffer(),
      ],
      program.programId
    );
  };

  // Helper to airdrop SOL
  const airdrop = async (publicKey: PublicKey, amount: number) => {
    const signature = await provider.connection.requestAirdrop(
      publicKey,
      amount * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);
  };

  describe("Stream Initialization", () => {
    const streamId = 1;
    const teamAName = "Team Alpha";
    const teamBName = "Team Beta";
    const initialLiquidity = new anchor.BN(100 * LAMPORTS_PER_SOL); // 100 SOL
    const streamDuration = new anchor.BN(3600); // 1 hour
    const streamLink = "https://example.com/stream/1";

    it("Successfully initializes a stream", async () => {
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);

      const tx = await program.methods
        .initializeStream(
          new anchor.BN(streamId),
          teamAName,
          teamBName,
          initialLiquidity,
          streamDuration,
          streamLink
        )
        .accountsPartial({
          stream: streamPDA,
          streamVault: streamVaultPDA,
          authority: authority.publicKey,
        })
        .rpc();

      const testUser = Keypair.generate();
      await airdrop(testUser.publicKey, 5);

      const [userPositionPDA] = getUserPositionPDA(streamId, testUser.publicKey);
      
      await program.methods
        .purchaseShares(new anchor.BN(streamId), 1, new anchor.BN(1 * LAMPORTS_PER_SOL))
        .accountsPartial({
          stream: streamPDA,
          userPosition: userPositionPDA,
          streamVault: streamVaultPDA,
          user: testUser.publicKey,
        })
        .signers([testUser])
        .rpc();

      try {
        await program.methods
          .claimWinnings(new anchor.BN(streamId))
          .accountsPartial({
            stream: streamPDA,
            userPosition: userPositionPDA,
            streamVault: streamVaultPDA,
            user: testUser.publicKey,
          })
          .signers([testUser])
          .rpc();
        assert.fail("Should have failed - stream still active");
      } catch (err) {
        expect(err.toString()).to.include("StreamStillActive");
      }
    });
  });

  describe("Emergency Withdraw", () => {
    const streamId = 10;

    before(async () => {
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);

      await program.methods
        .initializeStream(
          new anchor.BN(streamId),
          "Team Emergency",
          "Team Test",
          new anchor.BN(100 * LAMPORTS_PER_SOL),
          new anchor.BN(1),
          "https://example.com/stream/10"
        )
        .accountsPartial({
          stream: streamPDA,
          streamVault: streamVaultPDA,
          authority: authority.publicKey,
        })
        .rpc();

      // Add some funds to vault
      const user = Keypair.generate();
      await airdrop(user.publicKey, 5);

      const [userPositionPDA] = getUserPositionPDA(streamId, user.publicKey);
      
      await program.methods
        .purchaseShares(new anchor.BN(streamId), 1, new anchor.BN(2 * LAMPORTS_PER_SOL))
        .accountsPartial({
          stream: streamPDA,
          userPosition: userPositionPDA,
          streamVault: streamVaultPDA,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();

      // End stream
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      await program.methods
        .endStream(new anchor.BN(streamId), 1)
        .accountsPartial({
          stream: streamPDA,
          authority: authority.publicKey,
        })
        .rpc();
    });

    it("Authority can emergency withdraw", async () => {
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);

      const vaultBalanceBefore = await provider.connection.getBalance(streamVaultPDA);
      const authorityBalanceBefore = await provider.connection.getBalance(authority.publicKey);

      await program.methods
        .emergencyWithdraw(new anchor.BN(streamId))
        .accountsPartial({
          stream: streamPDA,
          streamVault: streamVaultPDA,
          authority: authority.publicKey,
        })
        .rpc();

      const vaultBalanceAfter = await provider.connection.getBalance(streamVaultPDA);
      const authorityBalanceAfter = await provider.connection.getBalance(authority.publicKey);

      // Vault should be drained
      assert.equal(vaultBalanceAfter, 0);
      
      // Authority should receive funds (minus tx fees)
      assert.isTrue(authorityBalanceAfter > authorityBalanceBefore);
    });

    it("Fails with unauthorized caller", async () => {
      const streamId2 = 11;
      const [streamPDA] = getStreamPDA(streamId2);
      const [streamVaultPDA] = getStreamVaultPDA(streamId2);

      await program.methods
        .initializeStream(
          new anchor.BN(streamId2),
          "Team A",
          "Team B",
          new anchor.BN(100 * LAMPORTS_PER_SOL),
          new anchor.BN(1),
          "https://example.com/stream/11"
        )
        .accountsPartial({
          stream: streamPDA,
          streamVault: streamVaultPDA,
          authority: authority.publicKey,
        })
        .rpc();

      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      await program.methods
        .endStream(new anchor.BN(streamId2), 1)
        .accountsPartial({
          stream: streamPDA,
          authority: authority.publicKey,
        })
        .rpc();

      const unauthorizedUser = Keypair.generate();
      await airdrop(unauthorizedUser.publicKey, 1);

      try {
        await program.methods
          .emergencyWithdraw(new anchor.BN(streamId2))
          .accountsPartial({
            stream: streamPDA,
            streamVault: streamVaultPDA,
            authority: unauthorizedUser.publicKey,
          })
          .signers([unauthorizedUser])
          .rpc();
        assert.fail("Should have failed with unauthorized");
      } catch (err) {
        expect(err.toString()).to.include("Unauthorized");
      }
    });

    it("Fails on active stream", async () => {
      const streamId2 = 12;
      const [streamPDA] = getStreamPDA(streamId2);
      const [streamVaultPDA] = getStreamVaultPDA(streamId2);

      await program.methods
        .initializeStream(
          new anchor.BN(streamId2),
          "Team A",
          "Team B",
          new anchor.BN(100 * LAMPORTS_PER_SOL),
          new anchor.BN(3600),
          "https://example.com/stream/12"
        )
        .accountsPartial({
          stream: streamPDA,
          streamVault: streamVaultPDA,
          authority: authority.publicKey,
        })
        .rpc();

      try {
        await program.methods
          .emergencyWithdraw(new anchor.BN(streamId2))
          .accountsPartial({
            stream: streamPDA,
            streamVault: streamVaultPDA,
            authority: authority.publicKey,
          })
          .rpc();
        assert.fail("Should have failed - stream still active");
      } catch (err) {
        expect(err.toString()).to.include("StreamStillActive");
      }
    });
  });

  describe("CPMM Price Mechanics", () => {
    const streamId = 13;
    let user: Keypair;

    before(async () => {
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);

      await program.methods
        .initializeStream(
          new anchor.BN(streamId),
          "Team Price Test A",
          "Team Price Test B",
          new anchor.BN(100 * LAMPORTS_PER_SOL),
          new anchor.BN(3600),
          "https://example.com/stream/13"
        )
        .accountsPartial({
          stream: streamPDA,
          streamVault: streamVaultPDA,
          authority: authority.publicKey,
        })
        .rpc();

      user = Keypair.generate();
      await airdrop(user.publicKey, 20);
    });

    it("Price increases when buying and decreases opposite team", async () => {
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);
      const [userPositionPDA] = getUserPositionPDA(streamId, user.publicKey);

      const streamBefore = await program.account.stream.fetch(streamPDA);
      
      // Large purchase should move price significantly
      await program.methods
        .purchaseShares(new anchor.BN(streamId), 1, new anchor.BN(5 * LAMPORTS_PER_SOL))
        .accountsPartial({
          stream: streamPDA,
          userPosition: userPositionPDA,
          streamVault: streamVaultPDA,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();

      const streamAfter = await program.account.stream.fetch(streamPDA);

      // Team A reserve should decrease (shares sold)
      assert.isTrue(streamAfter.teamAReserve.lt(streamBefore.teamAReserve));
      
      // Team B reserve should increase (SOL added)
      assert.isTrue(streamAfter.teamBReserve.gt(streamBefore.teamBReserve));
      
      // Shares sold should increase
      assert.isTrue(streamAfter.teamASharesSold.gt(streamBefore.teamASharesSold));
    });

    it("Constant product maintained after trades", async () => {
      const [streamPDA] = getStreamPDA(streamId);
      const stream = await program.account.stream.fetch(streamPDA);

      // Calculate k = reserve_a * reserve_b
      const k = stream.teamAReserve.mul(stream.teamBReserve);
      
      // k should be a large positive number
      assert.isTrue(k.gt(new anchor.BN(0)));
    });

    it("Multiple purchases move price progressively", async () => {
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);
      const [userPositionPDA] = getUserPositionPDA(streamId, user.publicKey);

      const stream1 = await program.account.stream.fetch(streamPDA);
      
      await program.methods
        .purchaseShares(new anchor.BN(streamId), 2, new anchor.BN(1 * LAMPORTS_PER_SOL))
        .accountsPartial({
          stream: streamPDA,
          userPosition: userPositionPDA,
          streamVault: streamVaultPDA,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();

      const stream2 = await program.account.stream.fetch(streamPDA);

      await program.methods
        .purchaseShares(new anchor.BN(streamId), 2, new anchor.BN(1 * LAMPORTS_PER_SOL))
        .accountsPartial({
          stream: streamPDA,
          userPosition: userPositionPDA,
          streamVault: streamVaultPDA,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();

      const stream3 = await program.account.stream.fetch(streamPDA);

      // Each purchase should change reserves
      assert.notEqual(
        stream1.teamBReserve.toString(),
        stream2.teamBReserve.toString()
      );
      assert.notEqual(
        stream2.teamBReserve.toString(),
        stream3.teamBReserve.toString()
      );
    });
  });

  describe("Edge Cases and Integration", () => {
    it("User can purchase both teams in same stream", async () => {
      const streamId = 14;
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);

      await program.methods
        .initializeStream(
          new anchor.BN(streamId),
          "Team Both",
          "Team Sides",
          new anchor.BN(100 * LAMPORTS_PER_SOL),
          new anchor.BN(3600),
          "https://example.com/stream/14"
        )
        .accountsPartial({
          stream: streamPDA,
          streamVault: streamVaultPDA,
          authority: authority.publicKey,
        })
        .rpc();

      const user = Keypair.generate();
      await airdrop(user.publicKey, 10);

      const [userPositionPDA] = getUserPositionPDA(streamId, user.publicKey);

      // Buy Team A
      await program.methods
        .purchaseShares(new anchor.BN(streamId), 1, new anchor.BN(1 * LAMPORTS_PER_SOL))
        .accountsPartial({
          stream: streamPDA,
          userPosition: userPositionPDA,
          streamVault: streamVaultPDA,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();

      // Buy Team B
      await program.methods
        .purchaseShares(new anchor.BN(streamId), 2, new anchor.BN(1 * LAMPORTS_PER_SOL))
        .accountsPartial({
          stream: streamPDA,
          userPosition: userPositionPDA,
          streamVault: streamVaultPDA,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();

      const userPosition = await program.account.userPosition.fetch(userPositionPDA);

      assert.isTrue(userPosition.teamAShares.gt(new anchor.BN(0)));
      assert.isTrue(userPosition.teamBShares.gt(new anchor.BN(0)));
    });

    it("Cannot purchase on inactive stream", async () => {
      const streamId = 15;
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);

      await program.methods
        .initializeStream(
          new anchor.BN(streamId),
          "Team Inactive",
          "Team Test",
          new anchor.BN(100 * LAMPORTS_PER_SOL),
          new anchor.BN(1),
          "https://example.com/stream/15"
        )
        .accountsPartial({
          stream: streamPDA,
          streamVault: streamVaultPDA,
          authority: authority.publicKey,
        })
        .rpc();

      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      await program.methods
        .endStream(new anchor.BN(streamId), 1)
        .accountsPartial({
          stream: streamPDA,
          authority: authority.publicKey,
        })
        .rpc();

      const user = Keypair.generate();
      await airdrop(user.publicKey, 5);

      const [userPositionPDA] = getUserPositionPDA(streamId, user.publicKey);

      try {
        await program.methods
          .purchaseShares(new anchor.BN(streamId), 1, new anchor.BN(1 * LAMPORTS_PER_SOL))
          .accountsPartial({
            stream: streamPDA,
            userPosition: userPositionPDA,
            streamVault: streamVaultPDA,
            user: user.publicKey,
          })
          .signers([user])
          .rpc();
        assert.fail("Should have failed - stream not active");
      } catch (err) {
        expect(err.toString()).to.include("StreamNotActive");
      }
    });

    it("Total pool accumulates correctly", async () => {
      const streamId = 16;
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);

      await program.methods
        .initializeStream(
          new anchor.BN(streamId),
          "Team Pool",
          "Team Test",
          new anchor.BN(100 * LAMPORTS_PER_SOL),
          new anchor.BN(3600),
          "https://example.com/stream/16"
        )
        .accountsPartial({
          stream: streamPDA,
          streamVault: streamVaultPDA,
          authority: authority.publicKey,
        })
        .rpc();

      const user1 = Keypair.generate();
      const user2 = Keypair.generate();
      await airdrop(user1.publicKey, 10);
      await airdrop(user2.publicKey, 10);

      const amount1 = new anchor.BN(2 * LAMPORTS_PER_SOL);
      const amount2 = new anchor.BN(3 * LAMPORTS_PER_SOL);

      const [userPosition1PDA] = getUserPositionPDA(streamId, user1.publicKey);
      const [userPosition2PDA] = getUserPositionPDA(streamId, user2.publicKey);

      await program.methods
        .purchaseShares(new anchor.BN(streamId), 1, amount1)
        .accountsPartial({
          stream: streamPDA,
          userPosition: userPosition1PDA,
          streamVault: streamVaultPDA,
          user: user1.publicKey,
        })
        .signers([user1])
        .rpc();

      await program.methods
        .purchaseShares(new anchor.BN(streamId), 2, amount2)
        .accountsPartial({
          stream: streamPDA,
          userPosition: userPosition2PDA,
          streamVault: streamVaultPDA,
          user: user2.publicKey,
        })
        .signers([user2])
        .rpc();

      const stream = await program.account.stream.fetch(streamPDA);
      const expectedTotal = amount1.add(amount2);

      assert.equal(stream.totalPool.toString(), expectedTotal.toString());
    });
  });


  describe("Initialization Errors", () => {
    const teamAName = "Team Alpha";
    const teamBName = "Team Beta";
    const initialLiquidity = new anchor.BN(100 * LAMPORTS_PER_SOL);
    const streamDuration = new anchor.BN(3600);
    const streamLink = "https://example.com/stream/1";

    it("Fails with team name too long", async () => {
      const longName = "A".repeat(33);
      const [streamPDA] = getStreamPDA(999);
      const [streamVaultPDA] = getStreamVaultPDA(999);

      try {
        await program.methods
          .initializeStream(
            new anchor.BN(999),
            longName,
            teamBName,
            initialLiquidity,
            streamDuration,
            streamLink
          )
          .accountsPartial({
            stream: streamPDA,
            streamVault: streamVaultPDA,
            authority: authority.publicKey,
          })
          .rpc();
        assert.fail("Should have failed with name too long");
      } catch (err) {
        expect(err.toString()).to.include("NameTooLong");
      }
    });

    it("Fails with zero initial liquidity", async () => {
      const [streamPDA] = getStreamPDA(998);
      const [streamVaultPDA] = getStreamVaultPDA(998);

      try {
        await program.methods
          .initializeStream(
            new anchor.BN(998),
            teamAName,
            teamBName,
            new anchor.BN(0),
            streamDuration,
            streamLink
          )
          .accountsPartial({
            stream: streamPDA,
            streamVault: streamVaultPDA,
            authority: authority.publicKey,
          })
          .rpc();
        assert.fail("Should have failed with zero liquidity");
      } catch (err) {
        expect(err.toString()).to.include("InvalidPrice");
      }
    });

    it("Fails with odd initial liquidity", async () => {
      const [streamPDA] = getStreamPDA(997);
      const [streamVaultPDA] = getStreamVaultPDA(997);

      try {
        await program.methods
          .initializeStream(
            new anchor.BN(997),
            teamAName,
            teamBName,
            new anchor.BN(999), // Odd number
            streamDuration,
            streamLink
          )
          .accountsPartial({
            stream: streamPDA,
            streamVault: streamVaultPDA,
            authority: authority.publicKey,
          })
          .rpc();
        assert.fail("Should have failed with odd liquidity");
      } catch (err) {
        expect(err.toString()).to.include("InvalidPrice");
      }
    });

    it("Fails with zero duration", async () => {
      const [streamPDA] = getStreamPDA(996);
      const [streamVaultPDA] = getStreamVaultPDA(996);

      try {
        await program.methods
          .initializeStream(
            new anchor.BN(996),
            teamAName,
            teamBName,
            initialLiquidity,
            new anchor.BN(0),
            streamLink
          )
          .accountsPartial({
            stream: streamPDA,
            streamVault: streamVaultPDA,
            authority: authority.publicKey,
          })
          .rpc();
        assert.fail("Should have failed with zero duration");
      } catch (err) {
        expect(err.toString()).to.include("InvalidDuration");
      }
    });
  });

  describe("Purchase Shares", () => {
    const streamId = 2;
    let user: Keypair;

    before(async () => {
      // Initialize a stream for testing
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);

      await program.methods
        .initializeStream(
          new anchor.BN(streamId),
          "Team A",
          "Team B",
          new anchor.BN(100 * LAMPORTS_PER_SOL),
          new anchor.BN(3600),
          "https://example.com/stream/2"
        )
        .accountsPartial({
          stream: streamPDA,
          streamVault: streamVaultPDA,
          authority: authority.publicKey,
        })
        .rpc();

      // Create and fund a test user
      user = Keypair.generate();
      await airdrop(user.publicKey, 10);
    });

    it("Successfully purchases shares for Team A", async () => {
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);
      const [userPositionPDA] = getUserPositionPDA(streamId, user.publicKey);

      const solAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

      const streamBefore = await program.account.stream.fetch(streamPDA);
      const vaultBalanceBefore = await provider.connection.getBalance(streamVaultPDA);

      await program.methods
        .purchaseShares(new anchor.BN(streamId), 1, solAmount)
        .accountsPartial({
          stream: streamPDA,
          userPosition: userPositionPDA,
          streamVault: streamVaultPDA,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();

      const streamAfter = await program.account.stream.fetch(streamPDA);
      const userPosition = await program.account.userPosition.fetch(userPositionPDA);
      const vaultBalanceAfter = await provider.connection.getBalance(streamVaultPDA);

      // Verify vault received SOL
      assert.equal(vaultBalanceAfter - vaultBalanceBefore, solAmount.toNumber());

      // Verify stream state updated
      assert.isTrue(streamAfter.totalPool.gt(streamBefore.totalPool));
      assert.isTrue(streamAfter.teamASharesSold.gt(new anchor.BN(0)));

      // Verify user position created
      assert.equal(userPosition.user.toString(), user.publicKey.toString());
      assert.equal(userPosition.streamId.toNumber(), streamId);
      assert.isTrue(userPosition.teamAShares.gt(new anchor.BN(0)));
      assert.equal(userPosition.totalInvested.toString(), solAmount.toString());
      assert.isFalse(userPosition.hasClaimed);
    });

    it("Successfully purchases shares for Team B", async () => {
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);
      const [userPositionPDA] = getUserPositionPDA(streamId, user.publicKey);

      const solAmount = new anchor.BN(0.5 * LAMPORTS_PER_SOL);

      const userPositionBefore = await program.account.userPosition.fetch(userPositionPDA);

      await program.methods
        .purchaseShares(new anchor.BN(streamId), 2, solAmount)
        .accountsPartial({
          stream: streamPDA,
          userPosition: userPositionPDA,
          streamVault: streamVaultPDA,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();

      const userPositionAfter = await program.account.userPosition.fetch(userPositionPDA);

      // Verify user now has shares in both teams
      assert.isTrue(userPositionAfter.teamBShares.gt(new anchor.BN(0)));
      assert.isTrue(userPositionAfter.totalInvested.gt(userPositionBefore.totalInvested));
    });

    it("Fails with zero amount", async () => {
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);
      const [userPositionPDA] = getUserPositionPDA(streamId, user.publicKey);

      try {
        await program.methods
          .purchaseShares(new anchor.BN(streamId), 1, new anchor.BN(0))
          .accountsPartial({
            stream: streamPDA,
            userPosition: userPositionPDA,
            streamVault: streamVaultPDA,
            user: user.publicKey,
          })
          .signers([user])
          .rpc();
        assert.fail("Should have failed with zero amount");
      } catch (err) {
        expect(err.toString()).to.include("InvalidAmount");
      }
    });

    it("Fails with invalid team ID", async () => {
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);
      const [userPositionPDA] = getUserPositionPDA(streamId, user.publicKey);

      try {
        await program.methods
          .purchaseShares(new anchor.BN(streamId), 3, new anchor.BN(1000000))
          .accountsPartial({
            stream: streamPDA,
            userPosition: userPositionPDA,
            streamVault: streamVaultPDA,
            user: user.publicKey,
          })
          .signers([user])
          .rpc();
        assert.fail("Should have failed with invalid team");
      } catch (err) {
        expect(err.toString()).to.include("InvalidTeam");
      }
    });

    it("Multiple users can purchase shares", async () => {
      const user2 = Keypair.generate();
      await airdrop(user2.publicKey, 5);

      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);
      const [userPositionPDA] = getUserPositionPDA(streamId, user2.publicKey);

      const solAmount = new anchor.BN(2 * LAMPORTS_PER_SOL);

      await program.methods
        .purchaseShares(new anchor.BN(streamId), 2, solAmount)
        .accountsPartial({
          stream: streamPDA,
          userPosition: userPositionPDA,
          streamVault: streamVaultPDA,
          user: user2.publicKey,
        })
        .signers([user2])
        .rpc();

      const userPosition = await program.account.userPosition.fetch(userPositionPDA);
      
      assert.equal(userPosition.user.toString(), user2.publicKey.toString());
      assert.isTrue(userPosition.teamBShares.gt(new anchor.BN(0)));
    });
  });

  describe("Sell Shares", () => {
    const streamId = 3;
    let user: Keypair;

    before(async () => {
      // Initialize stream
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);

      await program.methods
        .initializeStream(
          new anchor.BN(streamId),
          "Team X",
          "Team Y",
          new anchor.BN(100 * LAMPORTS_PER_SOL),
          new anchor.BN(3600),
          "https://example.com/stream/3"
        )
        .accountsPartial({
          stream: streamPDA,
          streamVault: streamVaultPDA,
          authority: authority.publicKey,
        })
        .rpc();

      // Create user and purchase shares
      user = Keypair.generate();
      await airdrop(user.publicKey, 10);

      const [userPositionPDA] = getUserPositionPDA(streamId, user.publicKey);

      await program.methods
        .purchaseShares(new anchor.BN(streamId), 1, new anchor.BN(2 * LAMPORTS_PER_SOL))
        .accountsPartial({
          stream: streamPDA,
          userPosition: userPositionPDA,
          streamVault: streamVaultPDA,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();
    });

    it("Successfully sells shares", async () => {
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);
      const [userPositionPDA] = getUserPositionPDA(streamId, user.publicKey);

      const userPositionBefore = await program.account.userPosition.fetch(userPositionPDA);
      const userBalanceBefore = await provider.connection.getBalance(user.publicKey);
      
      // Sell half the shares
      const sharesToSell = userPositionBefore.teamAShares.div(new anchor.BN(2));

      await program.methods
        .sellShares(new anchor.BN(streamId), 1, sharesToSell)
        .accountsPartial({
          stream: streamPDA,
          userPosition: userPositionPDA,
          streamVault: streamVaultPDA,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();

      const userPositionAfter = await program.account.userPosition.fetch(userPositionPDA);
      const userBalanceAfter = await provider.connection.getBalance(user.publicKey);

      // Verify shares decreased
      assert.isTrue(userPositionAfter.teamAShares.lt(userPositionBefore.teamAShares));
      
      // Verify user received SOL (accounting for tx fees)
      assert.isTrue(userBalanceAfter > userBalanceBefore - 0.01 * LAMPORTS_PER_SOL);
    });

    it("Fails selling more shares than owned", async () => {
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);
      const [userPositionPDA] = getUserPositionPDA(streamId, user.publicKey);

      const userPosition = await program.account.userPosition.fetch(userPositionPDA);
      const tooManyShares = userPosition.teamAShares.add(new anchor.BN(1000000));

      try {
        await program.methods
          .sellShares(new anchor.BN(streamId), 1, tooManyShares)
          .accountsPartial({
            stream: streamPDA,
            userPosition: userPositionPDA,
            streamVault: streamVaultPDA,
            user: user.publicKey,
          })
          .signers([user])
          .rpc();
        assert.fail("Should have failed with insufficient shares");
      } catch (err) {
        expect(err.toString()).to.include("InsufficientShares");
      }
    });

    it("Fails selling shares of team user doesn't own", async () => {
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);
      const [userPositionPDA] = getUserPositionPDA(streamId, user.publicKey);

      try {
        await program.methods
          .sellShares(new anchor.BN(streamId), 2, new anchor.BN(1000))
          .accountsPartial({
            stream: streamPDA,
            userPosition: userPositionPDA,
            streamVault: streamVaultPDA,
            user: user.publicKey,
          })
          .signers([user])
          .rpc();
        assert.fail("Should have failed with insufficient shares");
      } catch (err) {
        expect(err.toString()).to.include("InsufficientShares");
      }
    });

    it("Fails selling zero shares", async () => {
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);
      const [userPositionPDA] = getUserPositionPDA(streamId, user.publicKey);

      try {
        await program.methods
          .sellShares(new anchor.BN(streamId), 1, new anchor.BN(0))
          .accountsPartial({
            stream: streamPDA,
            userPosition: userPositionPDA,
            streamVault: streamVaultPDA,
            user: user.publicKey,
          })
          .signers([user])
          .rpc();
        assert.fail("Should have failed with zero amount");
      } catch (err) {
        expect(err.toString()).to.include("InvalidAmount");
      }
    });
  });

  describe("End Stream", () => {
    const streamId = 4;

    before(async () => {
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);

      await program.methods
        .initializeStream(
          new anchor.BN(streamId),
          "Team One",
          "Team Two",
          new anchor.BN(100 * LAMPORTS_PER_SOL),
          new anchor.BN(1), // Very short duration
          "https://example.com/stream/4"
        )
        .accountsPartial({
          stream: streamPDA,
          streamVault: streamVaultPDA,
          authority: authority.publicKey,
        })
        .rpc();

      // Wait for stream to end
      await new Promise((resolve) => setTimeout(resolve, 2000));
    });

    it("Successfully ends stream with Team A winning", async () => {
      const [streamPDA] = getStreamPDA(streamId);

      await program.methods
        .endStream(new anchor.BN(streamId), 1)
        .accountsPartial({
          stream: streamPDA,
          authority: authority.publicKey,
        })
        .rpc();

      const stream = await program.account.stream.fetch(streamPDA);

      assert.isFalse(stream.isActive);
      assert.equal(stream.winningTeam, 1);
    });

    it("Fails ending stream before end time", async () => {
      const streamId2 = 5;
      const [streamPDA] = getStreamPDA(streamId2);
      const [streamVaultPDA] = getStreamVaultPDA(streamId2);

      await program.methods
        .initializeStream(
          new anchor.BN(streamId2),
          "Team A",
          "Team B",
          new anchor.BN(100 * LAMPORTS_PER_SOL),
          new anchor.BN(3600), // 1 hour
          "https://example.com/stream/5"
        )
        .accountsPartial({
          stream: streamPDA,
          streamVault: streamVaultPDA,
          authority: authority.publicKey,
        })
        .rpc();

      try {
        await program.methods
          .endStream(new anchor.BN(streamId2), 1)
          .accountsPartial({
            stream: streamPDA,
            authority: authority.publicKey,
          })
          .rpc();
        assert.fail("Should have failed - stream not ended yet");
      } catch (err) {
        expect(err.toString()).to.include("StreamNotEnded");
      }
    });

    it("Fails with unauthorized caller", async () => {
      const streamId2 = 6;
      const [streamPDA] = getStreamPDA(streamId2);
      const [streamVaultPDA] = getStreamVaultPDA(streamId2);

      await program.methods
        .initializeStream(
          new anchor.BN(streamId2),
          "Team A",
          "Team B",
          new anchor.BN(100 * LAMPORTS_PER_SOL),
          new anchor.BN(1),
          "https://example.com/stream/6"
        )
        .accountsPartial({
          stream: streamPDA,
          streamVault: streamVaultPDA,
          authority: authority.publicKey,
        })
        .rpc();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const unauthorizedUser = Keypair.generate();
      await airdrop(unauthorizedUser.publicKey, 1);

      try {
        await program.methods
          .endStream(new anchor.BN(streamId2), 1)
          .accountsPartial({
            stream: streamPDA,
            authority: unauthorizedUser.publicKey,
          })
          .signers([unauthorizedUser])
          .rpc();
        assert.fail("Should have failed with unauthorized");
      } catch (err) {
        expect(err.toString()).to.include("Unauthorized");
      }
    });

    it("Fails with invalid winning team", async () => {
      const streamId2 = 7;
      const [streamPDA] = getStreamPDA(streamId2);
      const [streamVaultPDA] = getStreamVaultPDA(streamId2);

      await program.methods
        .initializeStream(
          new anchor.BN(streamId2),
          "Team A",
          "Team B",
          new anchor.BN(100 * LAMPORTS_PER_SOL),
          new anchor.BN(1),
          "https://example.com/stream/7"
        )
        .accountsPartial({
          stream: streamPDA,
          streamVault: streamVaultPDA,
          authority: authority.publicKey,
        })
        .rpc();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        await program.methods
          .endStream(new anchor.BN(streamId2), 3) // Invalid team
          .accountsPartial({
            stream: streamPDA,
            authority: authority.publicKey,
          })
          .rpc();
        assert.fail("Should have failed with invalid team");
      } catch (err) {
        expect(err.toString()).to.include("InvalidTeam");
      }
    });
  });

  describe("Claim Winnings", () => {
    const streamId = 8;
    let winner: Keypair;
    let loser: Keypair;

    before(async () => {
      // Initialize stream
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);

      await program.methods
        .initializeStream(
          new anchor.BN(streamId),
          "Winners",
          "Losers",
          new anchor.BN(100 * LAMPORTS_PER_SOL),
          new anchor.BN(1),
          "https://example.com/stream/8"
        )
        .accountsPartial({
          stream: streamPDA,
          streamVault: streamVaultPDA,
          authority: authority.publicKey,
        })
        .rpc();

      // Create users
      winner = Keypair.generate();
      loser = Keypair.generate();
      await airdrop(winner.publicKey, 10);
      await airdrop(loser.publicKey, 10);

      // Winner buys Team A
      const [winnerPositionPDA] = getUserPositionPDA(streamId, winner.publicKey);
      await program.methods
        .purchaseShares(new anchor.BN(streamId), 1, new anchor.BN(2 * LAMPORTS_PER_SOL))
        .accountsPartial({
          stream: streamPDA,
          userPosition: winnerPositionPDA,
          streamVault: streamVaultPDA,
          user: winner.publicKey,
        })
        .signers([winner])
        .rpc();

      // Loser buys Team B
      const [loserPositionPDA] = getUserPositionPDA(streamId, loser.publicKey);
      await program.methods
        .purchaseShares(new anchor.BN(streamId), 2, new anchor.BN(1 * LAMPORTS_PER_SOL))
        .accountsPartial({
          stream: streamPDA,
          userPosition: loserPositionPDA,
          streamVault: streamVaultPDA,
          user: loser.publicKey,
        })
        .signers([loser])
        .rpc();

      // Wait and end stream with Team A winning
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      await program.methods
        .endStream(new anchor.BN(streamId), 1)
        .accountsPartial({
          stream: streamPDA,
          authority: authority.publicKey,
        })
        .rpc();
    });

    it("Winner successfully claims winnings", async () => {
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);
      const [winnerPositionPDA] = getUserPositionPDA(streamId, winner.publicKey);

      const winnerBalanceBefore = await provider.connection.getBalance(winner.publicKey);
      const stream = await program.account.stream.fetch(streamPDA);

      await program.methods
        .claimWinnings(new anchor.BN(streamId))
        .accountsPartial({
          stream: streamPDA,
          userPosition: winnerPositionPDA,
          streamVault: streamVaultPDA,
          user: winner.publicKey,
        })
        .signers([winner])
        .rpc();

      const winnerBalanceAfter = await provider.connection.getBalance(winner.publicKey);
      const winnerPosition = await program.account.userPosition.fetch(winnerPositionPDA);

      // Winner should receive payout
      assert.isTrue(winnerBalanceAfter > winnerBalanceBefore);
      assert.isTrue(winnerPosition.hasClaimed);
    });

    it("Fails claiming twice", async () => {
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);
      const [winnerPositionPDA] = getUserPositionPDA(streamId, winner.publicKey);

      try {
        await program.methods
          .claimWinnings(new anchor.BN(streamId))
          .accountsPartial({
            stream: streamPDA,
            userPosition: winnerPositionPDA,
            streamVault: streamVaultPDA,
            user: winner.publicKey,
          })
          .signers([winner])
          .rpc();
        assert.fail("Should have failed - already claimed");
      } catch (err) {
        expect(err.toString()).to.include("AlreadyClaimed");
      }
    });

    it("Loser cannot claim winnings", async () => {
      const [streamPDA] = getStreamPDA(streamId);
      const [streamVaultPDA] = getStreamVaultPDA(streamId);
      const [loserPositionPDA] = getUserPositionPDA(streamId, loser.publicKey);

      try {
        await program.methods
          .claimWinnings(new anchor.BN(streamId))
          .accountsPartial({
            stream: streamPDA,
            userPosition: loserPositionPDA,
            streamVault: streamVaultPDA,
            user: loser.publicKey,
          })
          .signers([loser])
          .rpc();
        assert.fail("Should have failed - no winning shares");
      } catch (err) {
        expect(err.toString()).to.include("NoWinningShares");
      }
    });

    it("Fails claiming before stream ends", async () => {
      const streamId2 = 9;
      const [streamPDA] = getStreamPDA(streamId2);
      const [streamVaultPDA] = getStreamVaultPDA(streamId2);

      await program.methods
        .initializeStream(
          new anchor.BN(streamId2),
          "Team A",
          "Team B",
          new anchor.BN(100 * LAMPORTS_PER_SOL),
          new anchor.BN(3600),
          "https://example.com/stream/9"
        )
        .accountsPartial({
          stream: streamPDA,
          streamVault: streamVaultPDA,
          authority: authority.publicKey,
        })
        .rpc();

      const user = Keypair.generate();
      await airdrop(user.publicKey, 10);
      const [userPositionPDA] = getUserPositionPDA(streamId2, user.publicKey);

      await program.methods
        .purchaseShares(new anchor.BN(streamId2), 1, new anchor.BN(1 * LAMPORTS_PER_SOL))
        .accountsPartial({
          stream: streamPDA,
          userPosition: userPositionPDA,
          streamVault: streamVaultPDA,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();

      try {
        await program.methods
          .claimWinnings(new anchor.BN(streamId2))
          .accountsPartial({
            stream: streamPDA,
            userPosition: userPositionPDA,
            streamVault: streamVaultPDA,
            user: user.publicKey,
          })
          .signers([user])
          .rpc();
        assert.fail("Should have failed - stream still active");
      } catch (err) {
        expect(err.toString()).to.include("StreamStillActive");
      }
    });
  });
});