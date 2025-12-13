use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Stream is not active")]
    StreamNotActive,
    #[msg("Stream has ended")]
    StreamEnded,
    #[msg("Stream has not ended yet")]
    StreamNotEnded,
    #[msg("Invalid team ID")]
    InvalidTeam,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Invalid duration")]
    InvalidDuration,
    #[msg("Name too long (max 32 characters)")]
    NameTooLong,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Stream is still active")]
    StreamStillActive,
    #[msg("No winner declared yet")]
    NoWinnerDeclared,
    #[msg("Already claimed winnings")]
    AlreadyClaimed,
    #[msg("No winning shares")]
    NoWinningShares,
    #[msg("No payout available")]
    NoPayout,
    #[msg("Insufficient shares to sell")]
    InsufficientShares,
}
