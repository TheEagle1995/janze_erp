export const fmt = {
  currency: (n: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(n)),
  escape:   (t: string) => t.replace(/([_*[\]()~`>#+=|{}.!\-])/g, '\\$1'),
  pct:      (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`,
}
