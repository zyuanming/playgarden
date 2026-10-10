/**
 * Exact text-only puzzle data adapted from cxong/Beatrix.
 * Upstream: Copyright (c) 2014 Cong, MIT.
 * Commit: 059b74a3e9d9ec2bffee0a72ba8a53be107fe8b3.
 * The new TypeScript adaptation is GPL-3.0-only; the upstream notice remains MIT.
 * Source scripts are parsed as text; no upstream code or asset is executed/imported.
 * The six chapter/start/win/credits/end display scenes are deliberately excluded.
 */
export const BEATRIX_SOURCE_LEVELS = [
  {
    "id": "level1_1",
    "title": "1 · 1",
    "chapter": "1",
    "bpm": 120,
    "sourcePath": "scripts/levels/1.js",
    "symbols": {
      "b": {
        "instrument": "BD",
        "emitterDirections": [
          "right"
        ],
        "period": 8
      },
      "s": {
        "instrument": "SD"
      }
    },
    "targetRows": [
      "b   s   "
    ],
    "cells": [
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "              s                 ",
      "                                ",
      "          b                     ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                "
    ]
  },
  {
    "id": "level1_2",
    "title": "1 · 2",
    "chapter": "1",
    "bpm": 120,
    "sourcePath": "scripts/levels/1.js",
    "symbols": {
      "b": {
        "instrument": "BD",
        "emitterDirections": [
          "right"
        ],
        "period": 8
      },
      "s": {
        "instrument": "SD"
      },
      "h": {
        "instrument": "HH"
      }
    },
    "targetRows": [
      "b h s h "
    ],
    "cells": [
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "          h                     ",
      "                                ",
      "               h                ",
      "                                ",
      "            b                   ",
      "                                ",
      "                 s              ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                "
    ]
  },
  {
    "id": "level2_1",
    "title": "2 · 1",
    "chapter": "2",
    "bpm": 120,
    "sourcePath": "scripts/levels/2.js",
    "symbols": {
      "B": {
        "instrument": "BD",
        "emitterDirections": [
          "down"
        ],
        "period": 16
      },
      "b": {
        "instrument": "BD"
      },
      "s": {
        "instrument": "SD"
      },
      "h": {
        "instrument": "HO"
      }
    },
    "targetRows": [
      "B h s h b h s h "
    ],
    "cells": [
      "                                ",
      "                                ",
      "                                ",
      "               B                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "               h                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                  s             ",
      "                                ",
      "           h                    ",
      "                       b        ",
      "                                ",
      "             s                  ",
      "                h               ",
      "          h                     ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                "
    ]
  },
  {
    "id": "level2_2",
    "title": "2 · 2",
    "chapter": "2",
    "bpm": 140,
    "sourcePath": "scripts/levels/2.js",
    "symbols": {
      "b": {
        "instrument": "BD",
        "emitterDirections": [
          "right",
          "down"
        ],
        "period": 8
      },
      "s": {
        "instrument": "SD"
      },
      "h": {
        "instrument": "HH"
      },
      "o": {
        "instrument": "HO"
      }
    },
    "targetRows": [
      "b   s   ",
      "  h o h "
    ],
    "cells": [
      "                                ",
      "                                ",
      "          s                     ",
      "     b                          ",
      "             h                  ",
      "        o                       ",
      "          h                     ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                "
    ]
  },
  {
    "id": "level2_3",
    "title": "2 · 3",
    "chapter": "2",
    "bpm": 120,
    "sourcePath": "scripts/levels/2.js",
    "symbols": {
      "b": {
        "instrument": "BD",
        "emitterDirections": [
          "right"
        ],
        "period": 8
      },
      "s": {
        "instrument": "SD"
      },
      "h": {
        "instrument": "HH"
      }
    },
    "targetRows": [
      "b   s   ",
      "h   h   "
    ],
    "cells": [
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                     h          ",
      "                                ",
      "       b                        ",
      "             s                  ",
      "                      h         ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                "
    ]
  },
  {
    "id": "level2_4",
    "title": "2 · 4",
    "chapter": "2",
    "bpm": 114,
    "sourcePath": "scripts/levels/2.js",
    "symbols": {
      "b": {
        "instrument": "BD",
        "emitterDirections": [
          "up",
          "left"
        ],
        "period": 12
      },
      "s": {
        "instrument": "SD"
      },
      "h": {
        "instrument": "HH"
      },
      "o": {
        "instrument": "HO"
      }
    },
    "targetRows": [
      "b     s     ",
      "o h h o h h "
    ],
    "cells": [
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "            h                   ",
      "                  h             ",
      "       h                        ",
      "              bo                ",
      "            s                   ",
      "    h                           ",
      "       o                        ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                "
    ]
  },
  {
    "id": "level2_5",
    "title": "2 · 5",
    "chapter": "2",
    "bpm": 112,
    "sourcePath": "scripts/levels/2.js",
    "symbols": {
      "B": {
        "instrument": "BD",
        "emitterDirections": [
          "down"
        ],
        "period": 16
      },
      "b": {
        "instrument": "BD"
      },
      "s": {
        "instrument": "SD"
      },
      "t": {
        "instrument": "TAM"
      },
      "o": {
        "instrument": "BLO"
      }
    },
    "targetRows": [
      "b  bs b   b s b ",
      "    t       t oo"
    ],
    "cells": [
      "                            B   ",
      "                                ",
      "          s                     ",
      "     b         t                ",
      "             t      b           ",
      "        o                       ",
      "                                ",
      "            o    b              ",
      "         b   s                  ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                "
    ]
  },
  {
    "id": "level3_1",
    "title": "3 · 1",
    "chapter": "3",
    "bpm": 80,
    "sourcePath": "scripts/levels/3.js",
    "symbols": {
      "b": {
        "instrument": "BD",
        "emitterDirections": [
          "right"
        ],
        "period": 8
      },
      "s": {
        "instrument": "SD",
        "direction": "left"
      },
      "h": {
        "instrument": "HH",
        "direction": "down"
      }
    },
    "targetRows": [
      "b h s h "
    ],
    "cells": [
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "               s                ",
      "                                ",
      "             b                  ",
      "                                ",
      "          h                     ",
      "                 h              ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                "
    ]
  },
  {
    "id": "level3_2",
    "title": "3 · 2",
    "chapter": "3",
    "bpm": 135,
    "sourcePath": "scripts/levels/3.js",
    "symbols": {
      "B": {
        "instrument": "BD",
        "emitterDirections": [
          "right"
        ],
        "period": 8
      },
      "b": {
        "instrument": "BD"
      },
      "s": {
        "instrument": "SD",
        "direction": "left"
      },
      "o": {
        "instrument": "HO"
      }
    },
    "targetRows": [
      "Bbsbbbsb",
      "o o o o "
    ],
    "cells": [
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                 b              ",
      "           b     o              ",
      "                                ",
      "              B                 ",
      "             s                  ",
      "          s       o             ",
      "          o                     ",
      "             b  o               ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                "
    ]
  },
  {
    "id": "level3_3",
    "title": "3 · 3",
    "chapter": "3",
    "bpm": 115,
    "sourcePath": "scripts/levels/3.js",
    "symbols": {
      "B": {
        "instrument": "BD",
        "emitterDirections": [
          "right"
        ],
        "period": 16
      },
      "b": {
        "instrument": "BD",
        "direction": "down"
      },
      "s": {
        "instrument": "SD",
        "direction": "left"
      },
      "t": {
        "instrument": "HH"
      }
    },
    "targetRows": [
      "b   s  sb b s b ",
      "tttttttttttttttt"
    ],
    "cells": [
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                 t              ",
      "           b     t              ",
      "                      t         ",
      "                          B     ",
      "             s      t           ",
      "          s       t             ",
      "          t       t t s         ",
      "             b  t               ",
      "              t    t            ",
      "                t      t        ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                "
    ]
  },
  {
    "id": "level3_4",
    "title": "3 · 4",
    "chapter": "3",
    "bpm": 80,
    "sourcePath": "scripts/levels/3.js",
    "symbols": {
      "B": {
        "instrument": "BD",
        "emitterDirections": [
          "right"
        ],
        "period": 12
      },
      "b": {
        "instrument": "BD",
        "direction": "down"
      },
      "s": {
        "instrument": "SD",
        "direction": "left"
      },
      "h": {
        "instrument": "HH"
      },
      "o": {
        "instrument": "HO"
      }
    },
    "targetRows": [
      "B  s  b s  b",
      "h hh hh hh o"
    ],
    "cells": [
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "          h                     ",
      "                                ",
      "            h s                 ",
      "                                ",
      "                 s              ",
      "          h                     ",
      "         b   B                  ",
      "         h     h                ",
      "                   h            ",
      "           h                    ",
      "              o                 ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                "
    ]
  },
  {
    "id": "levelbonus_1",
    "title": "加演 · 1",
    "chapter": "bonus",
    "bpm": 80,
    "sourcePath": "scripts/levels/3.js",
    "symbols": {
      "B": {
        "instrument": "BD",
        "emitterDirections": [
          "right"
        ],
        "period": 16
      },
      "b": {
        "instrument": "BD",
        "direction": "left"
      },
      "s": {
        "instrument": "SD",
        "direction": "down"
      },
      "h": {
        "instrument": "HH"
      },
      "t": {
        "instrument": "TAM",
        "direction": "right"
      },
      "r": {
        "instrument": "RIM",
        "direction": "left"
      }
    },
    "targetRows": [
      "B   t sb  s r  s",
      "h h h h h h h h "
    ],
    "cells": [
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "            h     r             ",
      "              b                 ",
      "                 t              ",
      "          h                     ",
      "             B                  ",
      "               h                ",
      "            s                   ",
      "           h                    ",
      "              s                 ",
      "                  s             ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                ",
      "                                "
    ]
  }
] as const;
