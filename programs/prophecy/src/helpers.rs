use crate::errors::ErrorCode;
use anchor_lang::prelude::*;

/// Calculate current price using CPMM formula
/// Price = reserve_opposite / reserve_team
pub fn calculate_price(reserve_team: u64, reserve_opposite: u64) -> Result<u64> {
    require!(reserve_team > 0, ErrorCode::InvalidPrice);

    // Price in lamports per share
    // Multiply by precision factor to avoid rounding to 0
    // Use u128 to prevent overflow
    let numerator = (reserve_opposite as u128)
        .checked_mul(1_000_000_000) // 1 SOL precision
        .ok_or(ErrorCode::MathOverflow)?;

    let price = numerator
        .checked_div(reserve_team as u128)
        .ok_or(ErrorCode::MathOverflow)? as u64;

    Ok(price)
}

/// Calculate shares out using constant product formula
/// Formula: shares_out = (amount_in × reserve_team) / (reserve_opposite + amount_in)
///
/// This is derived from: k = reserve_team × reserve_opposite (constant)
/// When user spends amount_in SOL:
///   - reserve_opposite increases by amount_in
///   - reserve_team decreases by shares_out
///   - k remains constant
pub fn calculate_shares_out(
    amount_in_lamports: u64,
    reserve_team: u64,
    reserve_opposite: u64,
) -> Result<u64> {
    require!(amount_in_lamports > 0, ErrorCode::InvalidAmount);
    require!(
        reserve_team > 0 && reserve_opposite > 0,
        ErrorCode::InvalidPrice
    );

    // Use u128 to prevent overflow
    let numerator = (amount_in_lamports as u128)
        .checked_mul(reserve_team as u128)
        .ok_or(ErrorCode::MathOverflow)?;

    let denominator = (reserve_opposite as u128)
        .checked_add(amount_in_lamports as u128)
        .ok_or(ErrorCode::MathOverflow)?;

    let shares_out = numerator
        .checked_div(denominator)
        .ok_or(ErrorCode::MathOverflow)? as u64;

    require!(shares_out > 0, ErrorCode::InvalidAmount);
    require!(shares_out < reserve_team, ErrorCode::InvalidAmount);

    Ok(shares_out)
}

/// Calculate SOL out using constant product formula
/// Formula: sol_out = (shares_in × reserve_opposite) / (reserve_team + shares_in)
///
/// This is the inverse of the buy formula.
/// Note: shares_in adds to reserve_team, sol_out removes from reserve_opposite.
pub fn calculate_sol_out(shares_in: u64, reserve_team: u64, reserve_opposite: u64) -> Result<u64> {
    require!(shares_in > 0, ErrorCode::InvalidAmount);
    require!(
        reserve_team > 0 && reserve_opposite > 0,
        ErrorCode::InvalidPrice
    );

    // Use u128 to prevent overflow
    let numerator = (shares_in as u128)
        .checked_mul(reserve_opposite as u128)
        .ok_or(ErrorCode::MathOverflow)?;

    let denominator = (reserve_team as u128)
        .checked_add(shares_in as u128)
        .ok_or(ErrorCode::MathOverflow)?;

    let sol_out = numerator
        .checked_div(denominator)
        .ok_or(ErrorCode::MathOverflow)? as u64;

    require!(sol_out > 0, ErrorCode::InvalidAmount);
    require!(sol_out < reserve_opposite, ErrorCode::InvalidAmount); // Cannot drain all liquidity

    Ok(sol_out)
}

/// Calculate the invariant k = reserve_a × reserve_b
/// Used for validation
pub fn calculate_invariant(reserve_a: u64, reserve_b: u64) -> Result<u128> {
    (reserve_a as u128)
        .checked_mul(reserve_b as u128)
        .ok_or(ErrorCode::MathOverflow.into())
}
