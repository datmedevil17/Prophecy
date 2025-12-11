use anchor_lang::prelude::*;

#[event]
pub struct StreamInitialized {
    pub stream_id: u64,
    pub authority: Pubkey,
    pub team_a_name: String,
    pub team_b_name: String,
    pub initial_price: u64,
    pub end_time: i64,
}

#[event]
pub struct SharesPurchased {
    pub stream_id: u64,
    pub user: Pubkey,
    pub team_id: u8,
    pub amount: u64,
    pub price: u64,
    pub total_cost: u64,
}

#[event]
pub struct StreamEnded {
    pub stream_id: u64,
    pub winning_team: u8,
    pub total_pool: u64,
    pub team_a_shares: u64,
    pub team_b_shares: u64,
}

#[event]
pub struct WinningsClaimed {
    pub stream_id: u64,
    pub user: Pubkey,
    pub winning_team: u8,
    pub shares: u64,
    pub payout: u64,
}
