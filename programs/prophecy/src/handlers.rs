use crate::context::*;
use crate::errors::ErrorCode;
use crate::events::*;
use crate::helpers::*;
use anchor_lang::prelude::*;

pub fn initialize_stream_handler(
    ctx: Context<InitializeStream>,
    stream_id: u64,
    team_a_name: String,
    team_b_name: String,
    initial_liquidity: u64,
    stream_duration: i64,
    stream_link: String,
) -> Result<()> {
    require!(team_a_name.len() <= 32, ErrorCode::NameTooLong);
    require!(team_b_name.len() <= 32, ErrorCode::NameTooLong);
    require!(initial_liquidity > 0, ErrorCode::InvalidPrice);
    require!(initial_liquidity % 2 == 0, ErrorCode::InvalidPrice);
    require!(stream_duration > 0, ErrorCode::InvalidDuration);

    let stream = &mut ctx.accounts.stream;
    let clock = Clock::get()?;

    let half_liquidity = initial_liquidity
        .checked_div(2)
        .ok_or(ErrorCode::MathOverflow)?;

    stream.authority = ctx.accounts.authority.key();
    stream.stream_id = stream_id;
    stream.team_a_name = team_a_name;
    stream.team_b_name = team_b_name;

    stream.team_a_reserve = half_liquidity;
    stream.team_b_reserve = half_liquidity;

    stream.team_a_shares_sold = 0;
    stream.team_b_shares_sold = 0;
    stream.total_pool = 0;
    stream.start_time = clock.unix_timestamp;
    stream.end_time = clock.unix_timestamp + stream_duration;
    stream.is_active = true;
    stream.winning_team = 0;
    stream.bump = ctx.bumps.stream;
    stream.stream_link = stream_link;

    let initial_price = calculate_price(stream.team_a_reserve, stream.team_b_reserve)?;

    emit!(StreamInitialized {
        stream_id,
        authority: ctx.accounts.authority.key(),
        team_a_name: stream.team_a_name.clone(),
        team_b_name: stream.team_b_name.clone(),
        initial_liquidity,
        initial_price,
        end_time: stream.end_time,
        stream_link: stream.stream_link.clone(),
    });

    Ok(())
}

pub fn purchase_shares_handler(
    ctx: Context<PurchaseShares>,
    stream_id: u64,
    team_id: u8,
    sol_amount: u64,
) -> Result<()> {
    let stream = &mut ctx.accounts.stream;
    let user_position = &mut ctx.accounts.user_position;
    let clock = Clock::get()?;

    require!(stream.is_active, ErrorCode::StreamNotActive);
    require!(
        clock.unix_timestamp < stream.end_time,
        ErrorCode::StreamEnded
    );
    require!(team_id == 1 || team_id == 2, ErrorCode::InvalidTeam);
    require!(sol_amount > 0, ErrorCode::InvalidAmount);

    let (reserve_team, reserve_opposite) = if team_id == 1 {
        (stream.team_a_reserve, stream.team_b_reserve)
    } else {
        (stream.team_b_reserve, stream.team_a_reserve)
    };

    let price_before = calculate_price(reserve_team, reserve_opposite)?;

    let shares_out = calculate_shares_out(sol_amount, reserve_team, reserve_opposite)?;

    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.user.to_account_info(),
            to: ctx.accounts.stream_vault.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, sol_amount)?;

    if team_id == 1 {
        stream.team_a_reserve = stream
            .team_a_reserve
            .checked_sub(shares_out)
            .ok_or(ErrorCode::MathOverflow)?;
        stream.team_b_reserve = stream
            .team_b_reserve
            .checked_add(sol_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        stream.team_a_shares_sold = stream
            .team_a_shares_sold
            .checked_add(shares_out)
            .ok_or(ErrorCode::MathOverflow)?;
    } else {
        stream.team_b_reserve = stream
            .team_b_reserve
            .checked_sub(shares_out)
            .ok_or(ErrorCode::MathOverflow)?;
        stream.team_a_reserve = stream
            .team_a_reserve
            .checked_add(sol_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        stream.team_b_shares_sold = stream
            .team_b_shares_sold
            .checked_add(shares_out)
            .ok_or(ErrorCode::MathOverflow)?;
    }

    stream.total_pool = stream
        .total_pool
        .checked_add(sol_amount)
        .ok_or(ErrorCode::MathOverflow)?;

    let (reserve_team_after, reserve_opposite_after) = if team_id == 1 {
        (stream.team_a_reserve, stream.team_b_reserve)
    } else {
        (stream.team_b_reserve, stream.team_a_reserve)
    };
    let price_after = calculate_price(reserve_team_after, reserve_opposite_after)?;

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
        user_position.team_a_shares = user_position
            .team_a_shares
            .checked_add(shares_out)
            .ok_or(ErrorCode::MathOverflow)?;
    } else {
        user_position.team_b_shares = user_position
            .team_b_shares
            .checked_add(shares_out)
            .ok_or(ErrorCode::MathOverflow)?;
    }

    user_position.total_invested = user_position
        .total_invested
        .checked_add(sol_amount)
        .ok_or(ErrorCode::MathOverflow)?;

    emit!(SharesPurchased {
        stream_id,
        user: ctx.accounts.user.key(),
        team_id,
        sol_spent: sol_amount,
        shares_received: shares_out,
        price_before,
        price_after,
        reserve_team_before: reserve_team,
        reserve_team_after: reserve_team_after,
    });

    Ok(())
}

pub fn sell_shares_handler(
    ctx: Context<SellShares>,
    stream_id: u64,
    team_id: u8,
    shares_amount: u64,
) -> Result<()> {
    let stream = &mut ctx.accounts.stream;
    let user_position = &mut ctx.accounts.user_position;
    let clock = Clock::get()?;

    require!(stream.is_active, ErrorCode::StreamNotActive);
    require!(
        clock.unix_timestamp < stream.end_time,
        ErrorCode::StreamEnded
    );
    require!(team_id == 1 || team_id == 2, ErrorCode::InvalidTeam);
    require!(shares_amount > 0, ErrorCode::InvalidAmount);
    require!(
        ctx.accounts.user.key() == user_position.user,
        ErrorCode::Unauthorized
    );

    if team_id == 1 {
        require!(
            user_position.team_a_shares >= shares_amount,
            ErrorCode::InsufficientShares
        );
    } else {
        require!(
            user_position.team_b_shares >= shares_amount,
            ErrorCode::InsufficientShares
        );
    }

    let (reserve_team, reserve_opposite) = if team_id == 1 {
        (stream.team_a_reserve, stream.team_b_reserve)
    } else {
        (stream.team_b_reserve, stream.team_a_reserve)
    };

    let price_before = calculate_price(reserve_team, reserve_opposite)?;

    let sol_out = calculate_sol_out(shares_amount, reserve_team, reserve_opposite)?;

    if team_id == 1 {
        stream.team_a_reserve = stream
            .team_a_reserve
            .checked_add(shares_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        stream.team_b_reserve = stream
            .team_b_reserve
            .checked_sub(sol_out)
            .ok_or(ErrorCode::MathOverflow)?;
        stream.team_a_shares_sold = stream
            .team_a_shares_sold
            .checked_sub(shares_amount)
            .ok_or(ErrorCode::MathOverflow)?;
    } else {
        stream.team_b_reserve = stream
            .team_b_reserve
            .checked_add(shares_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        stream.team_a_reserve = stream
            .team_a_reserve
            .checked_sub(sol_out)
            .ok_or(ErrorCode::MathOverflow)?;
        stream.team_b_shares_sold = stream
            .team_b_shares_sold
            .checked_sub(shares_amount)
            .ok_or(ErrorCode::MathOverflow)?;
    }

    stream.total_pool = stream
        .total_pool
        .checked_sub(sol_out)
        .ok_or(ErrorCode::MathOverflow)?;

    // Transfer SOL from vault to user using PDA seeds for signing
    let stream_id_bytes = stream_id.to_le_bytes();
    let seeds = &[
        b"stream_vault".as_ref(),
        stream_id_bytes.as_ref(),
        &[ctx.bumps.stream_vault],
    ];
    let signer_seeds = &[&seeds[..]];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.stream_vault.to_account_info(),
            to: ctx.accounts.user.to_account_info(),
        },
        signer_seeds,
    );
    anchor_lang::system_program::transfer(transfer_ctx, sol_out)?;

    let (reserve_team_after, reserve_opposite_after) = if team_id == 1 {
        (stream.team_a_reserve, stream.team_b_reserve)
    } else {
        (stream.team_b_reserve, stream.team_a_reserve)
    };
    let price_after = calculate_price(reserve_team_after, reserve_opposite_after)?;

    if team_id == 1 {
        user_position.team_a_shares = user_position
            .team_a_shares
            .checked_sub(shares_amount)
            .ok_or(ErrorCode::MathOverflow)?;
    } else {
        user_position.team_b_shares = user_position
            .team_b_shares
            .checked_sub(shares_amount)
            .ok_or(ErrorCode::MathOverflow)?;
    }

    user_position.total_invested = user_position
        .total_invested
        .checked_sub(sol_out)
        .ok_or(ErrorCode::MathOverflow)?;

    emit!(SharesSold {
        stream_id,
        user: ctx.accounts.user.key(),
        team_id,
        shares_sold: shares_amount,
        sol_received: sol_out,
        price_before,
        price_after,
        reserve_team_before: reserve_team,
        reserve_team_after: reserve_team_after,
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
    require!(
        clock.unix_timestamp >= stream.end_time,
        ErrorCode::StreamNotEnded
    );
    require!(
        winning_team == 1 || winning_team == 2,
        ErrorCode::InvalidTeam
    );

    stream.is_active = false;
    stream.winning_team = winning_team;

    let final_team_a_price = calculate_price(stream.team_a_reserve, stream.team_b_reserve)?;
    let final_team_b_price = calculate_price(stream.team_b_reserve, stream.team_a_reserve)?;

    emit!(StreamEnded {
        stream_id: stream.stream_id,
        winning_team,
        total_pool: stream.total_pool,
        team_a_shares: stream.team_a_shares_sold,
        team_b_shares: stream.team_b_shares_sold,
        final_team_a_price,
        final_team_b_price,
    });

    Ok(())
}

pub fn claim_winnings_handler(ctx: Context<ClaimWinnings>, stream_id: u64) -> Result<()> {
    let stream = &ctx.accounts.stream;
    let user_position = &mut ctx.accounts.user_position;

    require!(!stream.is_active, ErrorCode::StreamStillActive);
    require!(stream.winning_team != 0, ErrorCode::NoWinnerDeclared);
    require!(!user_position.has_claimed, ErrorCode::AlreadyClaimed);
    require!(
        user_position.user == ctx.accounts.user.key(),
        ErrorCode::Unauthorized
    );

    let user_winning_shares = if stream.winning_team == 1 {
        user_position.team_a_shares
    } else {
        user_position.team_b_shares
    };

    require!(user_winning_shares > 0, ErrorCode::NoWinningShares);

    let total_winning_shares = if stream.winning_team == 1 {
        stream.team_a_shares_sold
    } else {
        stream.team_b_shares_sold
    };

    let payout = (stream.total_pool as u128)
        .checked_mul(user_winning_shares as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(total_winning_shares as u128)
        .ok_or(ErrorCode::MathOverflow)? as u64;

    require!(payout > 0, ErrorCode::NoPayout);

    // Transfer winnings from vault to user using PDA seeds for signing
    let stream_id_bytes = stream_id.to_le_bytes();
    let seeds = &[
        b"stream_vault".as_ref(),
        stream_id_bytes.as_ref(),
        &[ctx.bumps.stream_vault],
    ];
    let signer_seeds = &[&seeds[..]];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.stream_vault.to_account_info(),
            to: ctx.accounts.user.to_account_info(),
        },
        signer_seeds,
    );
    anchor_lang::system_program::transfer(transfer_ctx, payout)?;

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

pub fn emergency_withdraw_handler(ctx: Context<EmergencyWithdraw>, stream_id: u64) -> Result<()> {
    let stream = &mut ctx.accounts.stream;

    require!(
        ctx.accounts.authority.key() == stream.authority,
        ErrorCode::Unauthorized
    );
    require!(!stream.is_active, ErrorCode::StreamStillActive);

    let vault_balance = ctx.accounts.stream_vault.to_account_info().lamports();

    // Transfer all funds from vault to authority using PDA seeds for signing
    let stream_id_bytes = stream_id.to_le_bytes();
    let seeds = &[
        b"stream_vault".as_ref(),
        stream_id_bytes.as_ref(),
        &[ctx.bumps.stream_vault],
    ];
    let signer_seeds = &[&seeds[..]];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.stream_vault.to_account_info(),
            to: ctx.accounts.authority.to_account_info(),
        },
        signer_seeds,
    );
    anchor_lang::system_program::transfer(transfer_ctx, vault_balance)?;

    Ok(())
}