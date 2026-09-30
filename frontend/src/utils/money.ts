import { useAuth } from '../context/AuthContext.tsx';

// Rs. 1,25,000.00 (Nepali/Indian digit grouping)
export function formatMoney(amount: number | null | undefined, symbol = 'Rs.'): string {
  const value = Number(amount) || 0;
  const text = Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${value < 0 ? '-' : ''}${symbol} ${text}`;
}

// Inside components: const money = useMoney(); ... {money(total)}
export function useMoney() {
  const { activeSchool } = useAuth();
  const symbol = activeSchool?.currencySymbol || 'Rs.';
  return (amount: number | null | undefined) => formatMoney(amount, symbol);
}
