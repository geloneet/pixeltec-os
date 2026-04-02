import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a number as MXN currency.
 * Single source of truth — replaces all local formatCurrency definitions.
 * @example formatCurrency(45000) → "MX$45,000"
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(value)
}

/**
 * Returns initials from a full name string.
 * Handles edge cases: empty string, single word, extra spaces.
 * @example getInitials("Miguel Robles") → "MR"
 * @example getInitials("") → "?"
 */
export function getInitials(name: string): string {
  if (!name?.trim()) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(n => n[0]?.toUpperCase() ?? '')
    .join('')
}
