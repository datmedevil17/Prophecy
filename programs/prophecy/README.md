# Prophecy: Prediction Market (Solana / Anchor)

This README explains the on-chain contract located at `programs/prophecy` (Anchor + Rust). It summarizes the publicly exposed instructions, account layouts, events, errors, helper behavior (price curve), and typical usage flows.

## High-level overview

Prophecy implements a simple two-team prediction market stream. A stream represents a time-limited market where users can purchase "shares" for either Team A or Team B using SOL. Prices adjust using a small bonding-curve style helper when shares are purchased. When the stream ends and an authority declares a winning team, winners can claim their pro-rata share of the total pool.

Core instructions:
- `initialize_stream` — create a new stream (PDA) and set names/prices/duration
- `purchase_shares` — buy shares for a team, transferring SOL into a stream vault PDA
- `end_stream` — authority marks the stream as ended and sets the winning team
- `claim_winnings` — users collect their payout if they hold winning shares
- `emergency_withdraw` — authority drains the vault once stream is inactive (administrative emergency)

## Important files
- `src/lib.rs` — Anchor program entrypoint and exported instructions
- `src/handlers.rs` — instruction handlers (business logic)
- `src/context.rs` — Anchor `Accounts` structs used by each instruction (required accounts and PDAs)
- `src/state.rs` — account state structs: `Stream` and `UserPosition`
- `src/events.rs` — Anchor events emitted by the program
- `src/errors.rs` — custom error codes
- `src/helpers.rs` — helper functions (price calculation)

## Account layouts (on-chain state)

### Stream (PDA)
Seed: `[b"stream", stream_id.to_le_bytes().as_ref()]`
- authority: Pubkey — the signer that created/controls the stream
- stream_id: u64 — numeric id used in seeds and instructions
- team_a_name: String (max 32)
- team_b_name: String (max 32)
- team_a_shares: u64 — total shares purchased for team A
- team_b_shares: u64 — total shares purchased for team B
- team_a_price: u64 — current price (lamports per share) for A
- team_b_price: u64 — current price for B
- total_pool: u64 — total lamports in the vault (sum of purchases)
- start_time: i64 — unix timestamp when stream was initialized
- end_time: i64 — unix timestamp when stream ends
- is_active: bool — whether purchases are allowed
- winning_team: u8 — 0 = undecided, 1 = A, 2 = B
- bump: u8 — PDA bump

### UserPosition (PDA)
Seed: `[b"user_position", stream_id.to_le_bytes().as_ref(), user.key().as_ref()]`
- user: Pubkey — owner of this position
- stream_id: u64 — which stream this position belongs to
- team_a_shares: u64 — shares user holds for team A
- team_b_shares: u64 — shares user holds for team B
- total_invested: u64 — cumulative lamports invested by the user into this stream
- has_claimed: bool — whether user claimed winnings
- bump: u8 — PDA bump

### Stream vault (PDA)
Seed: `[b"stream_vault", stream_id.to_le_bytes().as_ref()]`
- Not an Anchor account type — stored as `AccountInfo` and treated as the lamports vault.
- All user payments are transferred into this vault PDA; payouts are taken from it.

## Instructions (API)

### initialize_stream(ctx, stream_id, team_a_name, team_b_name, initial_price, stream_duration)
- Accounts: `stream` (init PDA), `stream_vault` (PDA), `authority` (signer), `system_program`
- Validations: team names ≤ 32 chars, initial_price > 0, duration > 0
- Effects: creates the `Stream` account, sets start & end timestamps (based on Clock), sets both team prices to `initial_price`, marks stream active, emits `StreamInitialized` event
- Events: `StreamInitialized { stream_id, authority, team_a_name, team_b_name, initial_price, end_time }`

### purchase_shares(ctx, stream_id, team_id, amount)
- Accounts: `stream` (mut), `user_position` (init_if_needed), `stream_vault` (mut), `user` (signer), `system_program`
- Validations: stream is active, current time < end_time, team_id ∈ {1,2}, amount > 0
- Flow:
  1. Determine current price (team_a_price or team_b_price).
  2. Compute `total_cost = current_price * amount` and transfer lamports from `user` to `stream_vault`.
  3. Increase `stream.total_pool` by `total_cost` and increment the team's share count.
  4. Update prices using `calculate_new_price` — buyer's team price `_increases_`, the opposing team's price `_decreases_` slightly.
  5. Create or update the `UserPosition` PDA: increment user's team share count and `total_invested`.
  6. Emit `SharesPurchased { stream_id, user, team_id, amount, price, total_cost }`.

Notes:
- Payment is done via `system_program::transfer` to the vault PDA (lamports).
- All arithmetic uses checked math; `ErrorCode::MathOverflow` will be returned if overflow occurs.

### end_stream(ctx, stream_id, winning_team)
- Accounts: `stream` (mut), `authority` (signer)
- Validations: stream is active, caller is `stream.authority`, current time >= `end_time`, `winning_team` ∈ {1,2}
- Effects: mark `is_active = false`, set `winning_team`, emit `StreamEnded { stream_id, winning_team, total_pool, team_a_shares, team_b_shares }`.

### claim_winnings(ctx, stream_id)
- Accounts: `stream` (read), `user_position` (mut), `stream_vault` (mut), `user` (signer), `system_program`
- Validations: `stream.is_active == false`, `stream.winning_team != 0`, `!user_position.has_claimed`, `user_position.user == user`, and user has winning shares
- Payout calculation:
  payout = (stream.total_pool * user_winning_shares) / total_winning_shares
  where `user_winning_shares` is user's shares for the declared winning team.
- Effects: transfer `payout` lamports directly from `stream_vault` to `user` by manipulating lamports, set `user_position.has_claimed = true`, and emit `WinningsClaimed { stream_id, user, winning_team, shares, payout }`.

Important: the contract transfers lamports by directly manipulating account lamports (PDA vault -> user). This is allowed for PDAs but ensure runtime constraints and rent-exemption are considered when integrating with clients.

### emergency_withdraw(ctx, stream_id)
- Accounts: `stream` (mut), `stream_vault` (mut), `authority` (signer), `system_program`
- Validations: caller must be `stream.authority`, and stream must be inactive
- Effects: drains the vault PDA lamports to the authority (sets vault lamports to 0)
- Use-case: administrative recovery after settlement or emergency. Use carefully — it allows authority to take full vault balance.

## Events
- `StreamInitialized` — emitted on initialize
- `SharesPurchased` — emitted on each purchase
- `StreamEnded` — emitted when stream is ended
- `WinningsClaimed` — emitted when a user claims payout

These events can be consumed off-chain for indexing and UI updates.

## Errors (short list)
Errors are defined in `src/errors.rs`. Main entries:
- `StreamNotActive` / `StreamStillActive`
- `StreamEnded` / `StreamNotEnded`
- `InvalidTeam`, `InvalidAmount`, `InvalidPrice`, `InvalidDuration`, `NameTooLong`
- `Unauthorized` — for authority-only actions
- `MathOverflow` — on checked-arithmetic failures
- `NoWinnerDeclared`, `AlreadyClaimed`, `NoWinningShares`, `NoPayout`

Handle these on the client by mapping Anchor error codes to user-friendly messages.

## Price calculation (helpers)

The program uses `calculate_new_price(current_price, _total_shares, is_increase)` to nudge prices when shares are bought. Implementation details:
- Uses a `price_change_factor = 1000` (interpreted as a basis-points-like factor in the helper).
- On `is_increase == true`: compute `increase = current_price * price_change_factor / 1_000_000` and add `max(1, increase)` to the price.
- On `is_increase == false`: compute a smaller decrease `decrease = current_price * (price_change_factor/2) / 1_000_000` and subtract via `saturating_sub`.

Interpretation: prices move slowly (small fractional changes). The helper ignores `_total_shares` parameter in the current implementation, but the function signature allows future extension to use total shares in the curve.

## Security & edge-case notes
- The vault is an unchecked `AccountInfo` PDA; the program depends on PDA seeds and bump to identify it. Ensure clients derive the same PDA when preparing transfers.
- Payout math casts to `u128` for multiplication then back to `u64` after division — but `total_pool` and shares must be non-zero as validated.
- `claim_winnings` directly adjusts lamports on accounts (not via CPI). It uses `try_borrow_mut_lamports()` and subtraction/addition; this is standard but requires care for rent-exempt balances and signed PDAs.
- `emergency_withdraw` allows authority to drain the vault when stream is inactive. That gives strong power to `authority`; ensure multi-sig or governance is used for production if needed.
- The helper uses `saturating_sub` for decreases — price won't underflow below zero.

## Integration / client tips
- To compute PDAs off-chain, use the same seeds as `context.rs`:
  - Stream PDA: `seed = ["stream", stream_id.to_le_bytes()]`
  - Stream vault PDA: `seed = ["stream_vault", stream_id.to_le_bytes()]`
  - UserPosition PDA: `seed = ["user_position", stream_id.to_le_bytes(), user_pubkey]`
- When purchasing shares, calculate the expected `total_cost = current_price * amount` on the client to display estimated spend. Read `stream.team_a_price` / `team_b_price` before building the transaction to avoid surprises.
- Listen to the program events (`StreamInitialized`, `SharesPurchased`, etc.) to update UI in near-real time.
- When calling `claim_winnings`, validate `stream.is_active == false` and `stream.winning_team != 0` before submitting to avoid wasted transactions.

## Example flows
1. Admin calls `initialize_stream` with `stream_id = 42`, `initial_price = 1_000_000` (1M lamports ~ 0.001 SOL depending on cluster), `stream_duration = 3600` (1 hour). Stream is created and active.
2. User A reads stream: sees `team_a_price = team_b_price = 1_000_000`. User A calls `purchase_shares(stream_id=42, team_id=1, amount=10)` and transfers `10 * 1_000_000` lamports to vault. Team A price increases slightly.
3. After `end_time` passes, authority calls `end_stream(stream_id=42, winning_team=1)`. `is_active` becomes false.
4. User A calls `claim_winnings(stream_id=42)` and receives a pro rata portion of `total_pool` based on their winning shares.

## Next steps / suggestions
- Consider using a rent-exempt token account (SPL Token) for the pool to enable tokenized payouts and avoid raw-lamports arithmetic complexity.
- Improve the bonding curve to depend on `total_shares` (the helper currently ignores the `_total_shares` argument).
- Add access control improvements (multi-sig for `authority`) or on-chain dispute resolution for more trustless operation.

---

If you want, I can:
- Add examples with Anchor client code (TypeScript) showing how to derive PDAs and call each instruction.
- Generate a small integration test (TypeScript / mocha) that runs through initialize → purchase → end → claim flows on a local validator.

Tell me which follow-up you'd like and I will implement it next.
