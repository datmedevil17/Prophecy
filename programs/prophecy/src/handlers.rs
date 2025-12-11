use anchor_lang::prelude::*;
use crate::context::*;
use crate::state::*;
use crate::errors::ErrorCode;
use crate::events::*;
use crate::helpers::calculate_new_price;

pub fn initialize_stream_handler(
    ctx: Context<InitializeStream>,
    stream_id: u64,
    team_a_name: String,
    team_b_name: String,
    initial_price: u64,
    stream_duration: i64,
) -> Result<()> {
    require!(team_a_name.len() <= 32, ErrorCode::NameTooLong);
    require!(team_b_name.len() <= 32, ErrorCode::NameTooLong);
    require!(initial_price > 0, ErrorCode::InvalidPrice);
    require!(stream_duration > 0, ErrorCode::InvalidDuration);

    let stream = &mut ctx.accounts.stream;
    let clock = Clock::get()?;

    stream.authority = ctx.accounts.authority.key();
    stream.stream_id = stream_id;
    stream.team_a_name = team_a_name;
    stream.team_b_name = team_b_name;
    stream.team_a_shares = 0;
    stream.team_b_shares = 0;
    stream.team_a_price = initial_price;
    stream.team_b_price = initial_price;
    stream.total_pool = 0;
    stream.start_time = clock.unix_timestamp;
    stream.end_time = clock.unix_timestamp + stream_duration;
    stream.is_active = true;
    stream.winning_team = 0; // 0 = not decided, 1 = team A, 2 = team B
    stream.bump = ctx.bumps.stream;

    emit!(StreamInitialized {
        stream_id,
        authority: ctx.accounts.authority.key(),
        team_a_name: stream.team_a_name.clone(),
        team_b_name: stream.team_b_name.clone(),
        initial_price,
        end_time: stream.end_time,
    });

    Ok(())
}

pub fn purchase_shares_handler(
    ctx: Context<PurchaseShares>,
    stream_id: u64,
    team_id: u8,
    amount: u64,
) -> Result<()> {
    let stream = &mut ctx.accounts.stream;
    let user_position = &mut ctx.accounts.user_position;
    let clock = Clock::get()?;

    // Validate stream is active
    require!(stream.is_active, ErrorCode::StreamNotActive);
    require!(clock.unix_timestamp < stream.end_time, ErrorCode::StreamEnded);
    require!(team_id == 1 || team_id == 2, ErrorCode::InvalidTeam);
    require!(amount > 0, ErrorCode::InvalidAmount);

    // Calculate current price and cost
    let current_price = if team_id == 1 {
        stream.team_a_price
    } else {
        stream.team_b_price
    };

    let total_cost = current_price
        .checked_mul(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    // Transfer SOL from user to stream vault
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.user.to_account_info(),
            to: ctx.accounts.stream_vault.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, total_cost)?;

    // Update stream state
    stream.total_pool = stream.total_pool
        .checked_add(total_cost)
        .ok_or(ErrorCode::MathOverflow)?;

    if team_id == 1 {
        stream.team_a_shares = stream.team_a_shares
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;
        
        // Increase team A price based on demand (bonding curve)
        stream.team_a_price = calculate_new_price(
            stream.team_a_price,
            stream.team_a_shares,
            true,
        )?;
        
        // Decrease team B price slightly
        stream.team_b_price = calculate_new_price(
            stream.team_b_price,
            stream.team_b_shares,
            false,
        )?;
    } else {
        stream.team_b_shares = stream.team_b_shares
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;
        
        // Increase team B price
        stream.team_b_price = calculate_new_price(
            stream.team_b_price,
            stream.team_b_shares,
            true,
        )?;
        
        // Decrease team A price slightly
        stream.team_a_price = calculate_new_price(
            stream.team_a_price,
            stream.team_a_shares,
            false,
        )?;
    }

    // Update user position
    if user_position.user == Pubkey::default() {
        user_position.user = ctx.accounts.user.key();
        user_position.stream_id = stream_id;
        user_position.team_a_shares = 0;
        user_position.team_b_shares = 0;
        user_position.total_invested = 0;
        user_position.has_claimed = false;
        user_position.bump = ctx.bumps.user_position;
    }

    if team_id == 1 {
        user_position.team_a_shares = user_position.team_a_shares
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;
    } else {
        user_position.team_b_shares = user_position.team_b_shares
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;
    }

    user_position.total_invested = user_position.total_invested
        .checked_add(total_cost)
        .ok_or(ErrorCode::MathOverflow)?;

    emit!(SharesPurchased {
        stream_id,
        user: ctx.accounts.user.key(),
        team_id,
        amount,
        price: current_price,
        total_cost,
    });

    Ok(())
}

pub fn end_stream_handler(
    ctx: Context<EndStream>,
    _stream_id: u64,
    winning_team: u8,
) -> Result<()> {
    let stream = &mut ctx.accounts.stream;
    let clock = Clock::get()?;

    require!(stream.is_active, ErrorCode::StreamNotActive);
    require!(
        ctx.accounts.authority.key() == stream.authority,
        ErrorCode::Unauthorized
    );
    require!(clock.unix_timestamp >= stream.end_time, ErrorCode::StreamNotEnded);
    require!(winning_team == 1 || winning_team == 2, ErrorCode::InvalidTeam);

    stream.is_active = false;
    stream.winning_team = winning_team;

    emit!(StreamEnded {
        stream_id: stream.stream_id,
        winning_team,
        total_pool: stream.total_pool,
        team_a_shares: stream.team_a_shares,
        team_b_shares: stream.team_b_shares,
    });

    Ok(())
}

pub fn claim_winnings_handler(
    ctx: Context<ClaimWinnings>,
    stream_id: u64,
) -> Result<()> {
    let stream = &ctx.accounts.stream;
    let user_position = &mut ctx.accounts.user_position;

    require!(!stream.is_active, ErrorCode::StreamStillActive);
    require!(stream.winning_team != 0, ErrorCode::NoWinnerDeclared);
    require!(!user_position.has_claimed, ErrorCode::AlreadyClaimed);
    require!(
        user_position.user == ctx.accounts.user.key(),
        ErrorCode::Unauthorized
    );

    // Calculate user's winnings
    let user_winning_shares = if stream.winning_team == 1 {
        user_position.team_a_shares
    } else {
        user_position.team_b_shares
    };

    require!(user_winning_shares > 0, ErrorCode::NoWinningShares);

    let total_winning_shares = if stream.winning_team == 1 {
        stream.team_a_shares
    } else {
        stream.team_b_shares
    };

    // Calculate payout: (user_shares / total_winning_shares) * total_pool
    let payout = (stream.total_pool as u128)
        .checked_mul(user_winning_shares as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(total_winning_shares as u128)
        .ok_or(ErrorCode::MathOverflow)? as u64;

    require!(payout > 0, ErrorCode::NoPayout);

    // Transfer winnings from vault to user
    **ctx.accounts.stream_vault.to_account_info().try_borrow_mut_lamports()? -= payout;
    **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += payout;

    user_position.has_claimed = true;

    emit!(WinningsClaimed {
        stream_id,
        user: ctx.accounts.user.key(),
        winning_team: stream.winning_team,
        shares: user_winning_shares,
        payout,
    });

    Ok(())
}

pub fn emergency_withdraw_handler(
    ctx: Context<EmergencyWithdraw>,
    _stream_id: u64,
) -> Result<()> {
    let stream = &mut ctx.accounts.stream;

    require!(
        ctx.accounts.authority.key() == stream.authority,
        ErrorCode::Unauthorized
    );

    // Stream must be inactive for emergency withdrawal
    require!(!stream.is_active, ErrorCode::StreamStillActive);

    let vault_balance = ctx.accounts.stream_vault.to_account_info().lamports();
    
    **ctx.accounts.stream_vault.to_account_info().try_borrow_mut_lamports()? = 0;
    **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? += vault_balance;

    Ok(())
}
