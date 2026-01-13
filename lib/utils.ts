// lib/utils.ts

// Petit utilitaire maison pour fusionner des classes CSS.
// Pas besoin de clsx / tailwind-merge.
export function cn(...inputs: Array<string | undefined | null | false>) {
  return inputs.filter(Boolean).join(" ");
}