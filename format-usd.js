// Amounts under $1 keep up to six decimals so per-token prices such as
// $0.000375 stay readable. Larger amounts use cents.
export function formatUsd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: value !== 0 && Math.abs(value) < 1 ? 6 : 2,
  }).format(value);
}
