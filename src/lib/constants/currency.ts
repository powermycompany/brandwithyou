export const SUPPORTED_CURRENCIES = ["USD","EUR","DKK","CNY","HKD","JPY","KRW","GBP","CHF","SGD","TWD","AUD","CAD"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
