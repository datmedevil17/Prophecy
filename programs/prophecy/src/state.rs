
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Stream {
    pub authority: Pubkey,
    pub stream_id: u64,
    #[max_len(32)]
    pub team_a_name: String,
    #[max_len(32)]
    pub team_b_name: String,
    
    pub team_a_reserve: u64,  // Virtual liquidity for Team A
    pub team_b_reserve: u64,  // Virtual liquidity for Team B
    
    pub team_a_shares_sold: u64,
    pub team_b_shares_sold: u64,
    
    pub total_pool: u64,        
    pub start_time: i64,
    pub end_time: i64,
    pub is_active: bool,
    pub winning_team: u8,
    #[max_len(256)]
    pub stream_link: String,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct UserPosition {
    pub user: Pubkey,
    pub stream_id: u64,
    pub team_a_shares: u64,
    pub team_b_shares: u64,
    pub total_invested: u64,
    pub has_claimed: bool,
    pub bump: u8,
}