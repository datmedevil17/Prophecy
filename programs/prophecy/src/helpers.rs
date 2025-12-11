use anchor_lang::prelude::*;
use crate::errors::ErrorCode;

pub fn calculate_new_price(
    current_price: u64,
    _total_shares: u64,
    is_increase: bool,
) -> Result<u64> {
    let price_change_factor = 1000; // 0.1% change per share (basis points)
    
    if is_increase {
        // Price increases with more shares
        let increase = current_price
            .checked_mul(price_change_factor)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(1_000_000)
            .ok_or(ErrorCode::MathOverflow)?;
        
        current_price
            .checked_add(increase.max(1))
            .ok_or(ErrorCode::MathOverflow.into())
    } else {
        // Price decreases slightly (smaller decrease)
        let decrease = current_price
            .checked_mul(price_change_factor / 2)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(1_000_000)
            .ok_or(ErrorCode::MathOverflow)?;
        
        Ok(current_price.saturating_sub(decrease))
    }
}