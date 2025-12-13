use anchor_lang::prelude::*;

#[event]
pub struct StreamInitialized {
    pub stream_id: u64,
    pub authority: Pubkey,
    pub team_a_name: String,
    pub team_b_name: String,
    pub initial_liquidity: u64, // NEW: Total virtual liquidity
    pub initial_price: u64,     // Price at initialization
    pub end_time: i64,
    pub stream_link: String,
}

#[event]
pub struct SharesPurchased {
    pub stream_id: u64,
    pub user: Pubkey,
    pub team_id: u8,
    pub sol_spent: u64,           // NEW: SOL amount spent
    pub shares_received: u64,     // NEW: Shares received
    pub price_before: u64,        // NEW: Price before trade
    pub price_after: u64,         // NEW: Price after trade
    pub reserve_team_before: u64, // NEW: For analytics
    pub reserve_team_after: u64,  // NEW: For analytics
}

#[event]
pub struct SharesSold {
    pub stream_id: u64,
    pub user: Pubkey,
    pub team_id: u8,
    pub shares_sold: u64,
    pub sol_received: u64,
    pub price_before: u64,
    pub price_after: u64,
    pub reserve_team_before: u64,
    pub reserve_team_after: u64,
}

#[event]
pub struct StreamEnded {
    pub stream_id: u64,
    pub winning_team: u8,
    pub total_pool: u64,
    pub team_a_shares: u64,
    pub team_b_shares: u64,
    pub final_team_a_price: u64, // NEW: Final price for analytics
    pub final_team_b_price: u64, // NEW: Final price for analytics
}

#[event]
pub struct WinningsClaimed {
    pub stream_id: u64,
    pub user: Pubkey,
    pub winning_team: u8,
    pub shares: u64,
    pub payout: u64,
}
