export type Accent = "crimson" | "aqua" | "gold" | "emerald" | "amber" | "orange";

export interface PlayerField {
  key: string;
  label: string;
  placeholder: string;
}

export interface Game {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  accent: Accent;
  iconUrl: string;
  groupLabels: Record<string, string>;
  fields: PlayerField[];
}

export const games: Game[] = [
  {
    slug: "free-fire",
    title: "Free Fire",
    shortTitle: "FREE FIRE",
    description: "Алмазы, Weekly и Monthly — быстрое пополнение по UID.",
    accent: "crimson",
    iconUrl: "https://play-lh.googleusercontent.com/cK-U0_B9GrnSy26SNISDuvU_hL4VggyqJ1J5V2oiuyVEfiGo7fzegdBjk0ejXPg3PKK5sPwumdLBbWv8KkBKLQ%3Dw240-h480",
    groupLabels: { diamond: "Diamonds", voucher: "Наборы и подписки" },
    fields: [{ key: "uid", label: "UID Free Fire", placeholder: "Например: 1234567890" }],
  },
  {
    slug: "pubg",
    title: "PUBG Mobile",
    shortTitle: "PUBG",
    description: "UC для PUBG Mobile — быстрое пополнение по игровому ID.",
    accent: "amber",
    iconUrl: "https://play-lh.googleusercontent.com/upQsWd8PLFeUUjeR8Bhix73eTVSl1Vdijn8WEmq35Iouy3R0xQ_ewh1yJXOnX_0-_1Q%3Dw240-h480",
    groupLabels: { uc: "UC", wow: "WOW Coins", voucher: "Наборы и подписки" },
    fields: [{ key: "uid", label: "UID PUBG Mobile", placeholder: "Например: 5123456789" }],
  },
  {
    slug: "mobile-legends",
    title: "Mobile Legends",
    shortTitle: "MOBILE LEGENDS",
    description: "Diamonds и игровые наборы. Нужны ID игрока и Server ID.",
    accent: "gold",
    iconUrl: "https://play-lh.googleusercontent.com/MztmLpB1-_eFbHnqNzzvzl5zjiOH2BEb0D71uBxZYf_4BEmW3QEPWODhRtyqY7Qz4wRLwQ--Rg1RAjOFqtHSs-o%3Dw240-h480",
    groupLabels: { diamond: "Diamonds", voucher: "Наборы и подписки" },
    fields: [
      { key: "uid", label: "ID игрока", placeholder: "Введите Player ID" },
      { key: "server", label: "Server ID", placeholder: "Например: 1234" },
    ],
  },
  {
    slug: "roblox",
    title: "Roblox",
    shortTitle: "ROBLOX",
    description: "Robux любым объёмом — от стартовых пакетов до крупных пополнений.",
    accent: "emerald",
    iconUrl: "https://play-lh.googleusercontent.com/QqZj22aXblAyYDxLQw-Gg0ycW0QkKhrDnwqgERZU9BMRXZnMlgXfq-94sikG5mEpt_I0lzZxcUzfLblmQgwYzUE%3Dw240-h480",
    groupLabels: { robux: "Robux" },
    fields: [{ key: "uid", label: "Никнейм Roblox", placeholder: "Например: ItachiPlayer228" }],
  },
  {
    slug: "genshin-impact",
    title: "Genshin Impact",
    shortTitle: "GENSHIN IMPACT",
    description: "Genesis Crystals для Genshin Impact с выбором региона.",
    accent: "aqua",
    iconUrl: "https://play-lh.googleusercontent.com/PQEqjOxr-3uZaNHmWoQinLVQQ9fbSegMKXmqgFm5nGgagqC2REH-1er3BguYStWbH3YStijj5WH1DDlwPh2ehw%3Dw240-h480",
    groupLabels: { crystal: "Genesis Crystals", voucher: "Наборы и подписки" },
    fields: [
      { key: "uid", label: "UID Genshin Impact", placeholder: "Например: 800000000" },
      { key: "server", label: "Сервер", placeholder: "Asia / Europe / America / TW, HK, MO" },
    ],
  },
  {
    slug: "standoff-2",
    title: "Standoff 2",
    shortTitle: "STANDOFF 2",
    description: "Gold для Standoff 2 — быстрое пополнение по ID игрока.",
    accent: "orange",
    iconUrl: "https://play-lh.googleusercontent.com/uAfkyiLUpCY5pk4J5hKGb03q3afDOybzE3F25c6rbBTWaEtvhm6-qLTuO5LhLvnSIuHljRxXA7P6MH_6mAdy3w%3Dw240-h480",
    groupLabels: { gold: "Gold" },
    fields: [{ key: "uid", label: "ID игрока Standoff 2", placeholder: "Введите ID игрока" }],
  },
];

export const findGame = (slug: string | undefined): Game | undefined => games.find((g) => g.slug === slug);
