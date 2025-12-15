/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/prediction_market.json`.
 */
export type PredictionMarket = {
  "address": "6CnHW1qeMyK5ApNw7dWiSZkGvtVv93nEhwyDY8dkBzB1",
  "metadata": {
    "name": "predictionMarket",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "claimWinnings",
      "docs": [
        "Claim winnings after stream has ended"
      ],
      "discriminator": [
        161,
        215,
        24,
        59,
        14,
        236,
        242,
        221
      ],
      "accounts": [
        {
          "name": "stream",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  114,
                  101,
                  97,
                  109
                ]
              },
              {
                "kind": "arg",
                "path": "streamId"
              }
            ]
          }
        },
        {
          "name": "userPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "streamId"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "streamVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  114,
                  101,
                  97,
                  109,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "streamId"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "streamId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "emergencyWithdraw",
      "docs": [
        "Emergency withdraw (authority only)"
      ],
      "discriminator": [
        239,
        45,
        203,
        64,
        150,
        73,
        218,
        92
      ],
      "accounts": [
        {
          "name": "stream",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  114,
                  101,
                  97,
                  109
                ]
              },
              {
                "kind": "arg",
                "path": "streamId"
              }
            ]
          }
        },
        {
          "name": "streamVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  114,
                  101,
                  97,
                  109,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "streamId"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "streamId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "endStream",
      "docs": [
        "End the stream and declare a winner"
      ],
      "discriminator": [
        50,
        224,
        219,
        223,
        210,
        199,
        162,
        115
      ],
      "accounts": [
        {
          "name": "stream",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  114,
                  101,
                  97,
                  109
                ]
              },
              {
                "kind": "arg",
                "path": "streamId"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "streamId",
          "type": "u64"
        },
        {
          "name": "winningTeam",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initializeStream",
      "discriminator": [
        118,
        75,
        0,
        207,
        137,
        93,
        113,
        74
      ],
      "accounts": [
        {
          "name": "stream",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  114,
                  101,
                  97,
                  109
                ]
              },
              {
                "kind": "arg",
                "path": "streamId"
              }
            ]
          }
        },
        {
          "name": "streamVault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  114,
                  101,
                  97,
                  109,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "streamId"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "streamId",
          "type": "u64"
        },
        {
          "name": "teamAName",
          "type": "string"
        },
        {
          "name": "teamBName",
          "type": "string"
        },
        {
          "name": "initialLiquidity",
          "type": "u64"
        },
        {
          "name": "streamDuration",
          "type": "i64"
        },
        {
          "name": "streamLink",
          "type": "string"
        }
      ]
    },
    {
      "name": "purchaseShares",
      "discriminator": [
        171,
        132,
        3,
        224,
        99,
        69,
        214,
        250
      ],
      "accounts": [
        {
          "name": "stream",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  114,
                  101,
                  97,
                  109
                ]
              },
              {
                "kind": "arg",
                "path": "streamId"
              }
            ]
          }
        },
        {
          "name": "userPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "streamId"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "streamVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  114,
                  101,
                  97,
                  109,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "streamId"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "streamId",
          "type": "u64"
        },
        {
          "name": "teamId",
          "type": "u8"
        },
        {
          "name": "solAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "sellShares",
      "discriminator": [
        184,
        164,
        169,
        16,
        231,
        158,
        199,
        196
      ],
      "accounts": [
        {
          "name": "stream",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  114,
                  101,
                  97,
                  109
                ]
              },
              {
                "kind": "arg",
                "path": "streamId"
              }
            ]
          }
        },
        {
          "name": "userPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "streamId"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "streamVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  114,
                  101,
                  97,
                  109,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "streamId"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "streamId",
          "type": "u64"
        },
        {
          "name": "teamId",
          "type": "u8"
        },
        {
          "name": "sharesAmount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "stream",
      "discriminator": [
        166,
        224,
        59,
        4,
        202,
        10,
        186,
        83
      ]
    },
    {
      "name": "userPosition",
      "discriminator": [
        251,
        248,
        209,
        245,
        83,
        234,
        17,
        27
      ]
    }
  ],
  "events": [
    {
      "name": "sharesPurchased",
      "discriminator": [
        24,
        220,
        223,
        28,
        213,
        182,
        47,
        22
      ]
    },
    {
      "name": "sharesSold",
      "discriminator": [
        35,
        231,
        5,
        53,
        228,
        158,
        113,
        251
      ]
    },
    {
      "name": "streamEnded",
      "discriminator": [
        212,
        151,
        139,
        17,
        232,
        190,
        110,
        107
      ]
    },
    {
      "name": "streamInitialized",
      "discriminator": [
        165,
        148,
        216,
        67,
        105,
        214,
        199,
        173
      ]
    },
    {
      "name": "winningsClaimed",
      "discriminator": [
        187,
        184,
        29,
        196,
        54,
        117,
        70,
        150
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "streamNotActive",
      "msg": "Stream is not active"
    },
    {
      "code": 6001,
      "name": "streamEnded",
      "msg": "Stream has ended"
    },
    {
      "code": 6002,
      "name": "streamNotEnded",
      "msg": "Stream has not ended yet"
    },
    {
      "code": 6003,
      "name": "invalidTeam",
      "msg": "Invalid team ID"
    },
    {
      "code": 6004,
      "name": "invalidAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 6005,
      "name": "invalidPrice",
      "msg": "Invalid price"
    },
    {
      "code": 6006,
      "name": "invalidDuration",
      "msg": "Invalid duration"
    },
    {
      "code": 6007,
      "name": "nameTooLong",
      "msg": "Name too long (max 32 characters)"
    },
    {
      "code": 6008,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6009,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6010,
      "name": "streamStillActive",
      "msg": "Stream is still active"
    },
    {
      "code": 6011,
      "name": "noWinnerDeclared",
      "msg": "No winner declared yet"
    },
    {
      "code": 6012,
      "name": "alreadyClaimed",
      "msg": "Already claimed winnings"
    },
    {
      "code": 6013,
      "name": "noWinningShares",
      "msg": "No winning shares"
    },
    {
      "code": 6014,
      "name": "noPayout",
      "msg": "No payout available"
    },
    {
      "code": 6015,
      "name": "insufficientShares",
      "msg": "Insufficient shares to sell"
    }
  ],
  "types": [
    {
      "name": "sharesPurchased",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "streamId",
            "type": "u64"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "teamId",
            "type": "u8"
          },
          {
            "name": "solSpent",
            "type": "u64"
          },
          {
            "name": "sharesReceived",
            "type": "u64"
          },
          {
            "name": "priceBefore",
            "type": "u64"
          },
          {
            "name": "priceAfter",
            "type": "u64"
          },
          {
            "name": "reserveTeamBefore",
            "type": "u64"
          },
          {
            "name": "reserveTeamAfter",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "sharesSold",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "streamId",
            "type": "u64"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "teamId",
            "type": "u8"
          },
          {
            "name": "sharesSold",
            "type": "u64"
          },
          {
            "name": "solReceived",
            "type": "u64"
          },
          {
            "name": "priceBefore",
            "type": "u64"
          },
          {
            "name": "priceAfter",
            "type": "u64"
          },
          {
            "name": "reserveTeamBefore",
            "type": "u64"
          },
          {
            "name": "reserveTeamAfter",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "stream",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "streamId",
            "type": "u64"
          },
          {
            "name": "teamAName",
            "type": "string"
          },
          {
            "name": "teamBName",
            "type": "string"
          },
          {
            "name": "teamAReserve",
            "type": "u64"
          },
          {
            "name": "teamBReserve",
            "type": "u64"
          },
          {
            "name": "teamASharesSold",
            "type": "u64"
          },
          {
            "name": "teamBSharesSold",
            "type": "u64"
          },
          {
            "name": "totalPool",
            "type": "u64"
          },
          {
            "name": "startTime",
            "type": "i64"
          },
          {
            "name": "endTime",
            "type": "i64"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "winningTeam",
            "type": "u8"
          },
          {
            "name": "streamLink",
            "type": "string"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "streamEnded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "streamId",
            "type": "u64"
          },
          {
            "name": "winningTeam",
            "type": "u8"
          },
          {
            "name": "totalPool",
            "type": "u64"
          },
          {
            "name": "teamAShares",
            "type": "u64"
          },
          {
            "name": "teamBShares",
            "type": "u64"
          },
          {
            "name": "finalTeamAPrice",
            "type": "u64"
          },
          {
            "name": "finalTeamBPrice",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "streamInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "streamId",
            "type": "u64"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "teamAName",
            "type": "string"
          },
          {
            "name": "teamBName",
            "type": "string"
          },
          {
            "name": "initialLiquidity",
            "type": "u64"
          },
          {
            "name": "initialPrice",
            "type": "u64"
          },
          {
            "name": "endTime",
            "type": "i64"
          },
          {
            "name": "streamLink",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "userPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "streamId",
            "type": "u64"
          },
          {
            "name": "teamAShares",
            "type": "u64"
          },
          {
            "name": "teamBShares",
            "type": "u64"
          },
          {
            "name": "totalInvested",
            "type": "u64"
          },
          {
            "name": "hasClaimed",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "winningsClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "streamId",
            "type": "u64"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "winningTeam",
            "type": "u8"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "payout",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
