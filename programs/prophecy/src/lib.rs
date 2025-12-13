use anchor_lang::prelude::*;

declare_id!("BzfVd9NyHDv8mnGkZrUeNDTtTbnVp2kje7E4J87vX87m");

pub mod context;
pub mod errors;
pub mod events;
pub mod handlers;
pub mod helpers;
pub mod state;

pub use context::*;
pub use events::*;
pub use state::*;

#[program]
pub mod prediction_market {
    use super::*;

    pub fn initialize_stream(
        ctx: Context<InitializeStream>,
        stream_id: u64,
        team_a_name: String,
        team_b_name: String,
        initial_liquidity: u64,
        stream_duration: i64,
        stream_link: String,
    ) -> Result<()> {
        handlers::initialize_stream_handler(
            ctx,
            stream_id,
            team_a_name,
            team_b_name,
            initial_liquidity,
            stream_duration,
            stream_link,
        )
    }

    pub fn purchase_shares(
        ctx: Context<PurchaseShares>,
        stream_id: u64,
        team_id: u8,
        sol_amount: u64,
    ) -> Result<()> {
        handlers::purchase_shares_handler(ctx, stream_id, team_id, sol_amount)
    }

    pub fn sell_shares(
        ctx: Context<SellShares>,
        stream_id: u64,
        team_id: u8,
        shares_amount: u64,
    ) -> Result<()> {
        handlers::sell_shares_handler(ctx, stream_id, team_id, shares_amount)
    }

    /// End the stream and declare a winner
    pub fn end_stream(ctx: Context<EndStream>, stream_id: u64, winning_team: u8) -> Result<()> {
        handlers::end_stream_handler(ctx, stream_id, winning_team)
    }

    /// Claim winnings after stream has ended
    pub fn claim_winnings(ctx: Context<ClaimWinnings>, stream_id: u64) -> Result<()> {
        handlers::claim_winnings_handler(ctx, stream_id)
    }

    /// Emergency withdraw (authority only)
    pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>, stream_id: u64) -> Result<()> {
        handlers::emergency_withdraw_handler(ctx, stream_id)
    }
}
