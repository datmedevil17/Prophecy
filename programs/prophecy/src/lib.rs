use anchor_lang::prelude::*;

declare_id!("EUUuFWSAzWCUqo6cZyAwWim6jQs3mVKGbCA4XjJG3EJM");

#[program]
pub mod prophecy {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
