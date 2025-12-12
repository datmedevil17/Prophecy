use anchor_lang::prelude::*;

declare_id!("7Z3EDnUXfjLqN2SkkuEYyX6uNhmGQ9HWvJUXRwr9HKcd");

pub mod errors;
pub mod events;
pub mod state;
pub mod context;
pub mod helpers;
pub mod handlers;

pub use context::*;
pub use state::*;
pub use events::*;

#[program]
pub mod prediction_market {
    use super::*;

    pub fn initialize_stream(
        ctx: Context<InitializeStream>,
        stream_id: u64,
        team_a_name: String,
        team_b_name: String,
        initial_price: u64,
        stream_duration: i64,
        stream_link: String,
    ) -> Result<()> {
        handlers::initialize_stream_handler(ctx, stream_id, team_a_name, team_b_name, initial_price, stream_duration, stream_link)
    }

    pub fn purchase_shares(
        ctx: Context<PurchaseShares>,
        stream_id: u64,
        team_id: u8, // 1 = team A, 2 = team B
        amount: u64,
    ) -> Result<()> {
        handlers::purchase_shares_handler(ctx, stream_id, team_id, amount)
    }

    pub fn end_stream(
        ctx: Context<EndStream>,
        stream_id: u64,
        winning_team: u8, // 1 = team A, 2 = team B
    ) -> Result<()> {
        handlers::end_stream_handler(ctx, stream_id, winning_team)
    }

    pub fn claim_winnings(
        ctx: Context<ClaimWinnings>,
        stream_id: u64,
    ) -> Result<()> {
        handlers::claim_winnings_handler(ctx, stream_id)
    }

    pub fn emergency_withdraw(
        ctx: Context<EmergencyWithdraw>,
        _stream_id: u64,
    ) -> Result<()> {
        handlers::emergency_withdraw_handler(ctx, _stream_id)
    }
}