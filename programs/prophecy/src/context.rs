use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(stream_id: u64)]
pub struct InitializeStream<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Stream::INIT_SPACE,
        seeds = [b"stream", stream_id.to_le_bytes().as_ref()],
        bump
    )]
    pub stream: Account<'info, Stream>,

    #[account(
        seeds = [b"stream_vault", stream_id.to_le_bytes().as_ref()],
        bump
    )]
    /// CHECK: This is a PDA used as a vault
    pub stream_vault: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(stream_id: u64)]
pub struct PurchaseShares<'info> {
    #[account(
        mut,
        seeds = [b"stream", stream_id.to_le_bytes().as_ref()],
        bump = stream.bump
    )]
    pub stream: Account<'info, Stream>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserPosition::INIT_SPACE,
        seeds = [b"user_position", stream_id.to_le_bytes().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(
        mut,
        seeds = [b"stream_vault", stream_id.to_le_bytes().as_ref()],
        bump
    )]
    /// CHECK: This is a PDA used as a vault
    pub stream_vault: AccountInfo<'info>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(stream_id: u64)]
pub struct SellShares<'info> {
    #[account(
        mut,
        seeds = [b"stream", stream_id.to_le_bytes().as_ref()],
        bump = stream.bump
    )]
    pub stream: Account<'info, Stream>,

    #[account(
        mut,
        seeds = [b"user_position", stream_id.to_le_bytes().as_ref(), user.key().as_ref()],
        bump = user_position.bump
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(
        mut,
        seeds = [b"stream_vault", stream_id.to_le_bytes().as_ref()],
        bump
    )]
    /// CHECK: This is a PDA used as a vault
    pub stream_vault: AccountInfo<'info>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(stream_id: u64)]
pub struct EndStream<'info> {
    #[account(
        mut,
        seeds = [b"stream", stream_id.to_le_bytes().as_ref()],
        bump = stream.bump
    )]
    pub stream: Account<'info, Stream>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(stream_id: u64)]
pub struct ClaimWinnings<'info> {
    #[account(
        seeds = [b"stream", stream_id.to_le_bytes().as_ref()],
        bump = stream.bump
    )]
    pub stream: Account<'info, Stream>,

    #[account(
        mut,
        seeds = [b"user_position", stream_id.to_le_bytes().as_ref(), user.key().as_ref()],
        bump = user_position.bump
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(
        mut,
        seeds = [b"stream_vault", stream_id.to_le_bytes().as_ref()],
        bump
    )]
    /// CHECK: This is a PDA used as a vault
    pub stream_vault: AccountInfo<'info>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(stream_id: u64)]
pub struct EmergencyWithdraw<'info> {
    #[account(
        mut,
        seeds = [b"stream", stream_id.to_le_bytes().as_ref()],
        bump = stream.bump
    )]
    pub stream: Account<'info, Stream>,

    #[account(
        mut,
        seeds = [b"stream_vault", stream_id.to_le_bytes().as_ref()],
        bump
    )]
    /// CHECK: This is a PDA used as a vault
    pub stream_vault: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}
