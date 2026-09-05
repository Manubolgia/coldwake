import type { Summary } from './metrics';

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

export type Band = { label: string; value: number; min: number; max: number; unit?: 'pct' };

export function markdownReport(
  title: string,
  rows: { label: string; summary: Summary }[],
  bands: Band[],
  meta: Record<string, string | number>,
): string {
  const out: string[] = [];
  out.push(`# ${title}`, '');
  out.push(Object.entries(meta).map(([k, v]) => `**${k}**: ${v}`).join('  ·  '), '');

  out.push('## Win rate', '');
  out.push('| config | runs | win rate | 95% CI | median turn | mean score |');
  out.push('|---|---|---|---|---|---|');
  for (const r of rows) {
    const s = r.summary;
    out.push(
      `| ${r.label} | ${s.runs} | ${pct(s.winRate)} | ${pct(s.winCI[0])}–${pct(s.winCI[1])} | ${s.medianTurn} | ${s.means.score.toFixed(1)} |`,
    );
  }
  out.push('');

  out.push('## Endings', '');
  const endingKeys = ['escaped', 'carrier', 'overload', 'relay', 'specimen', 'killed', 'adrift'];
  out.push(`| config | ${endingKeys.join(' | ')} |`);
  out.push(`|---|${endingKeys.map(() => '---').join('|')}|`);
  for (const r of rows) {
    out.push(`| ${r.label} | ${endingKeys.map((k) => pct(r.summary.endings[k] ?? 0)).join(' | ')} |`);
  }
  out.push('');

  out.push('## Loss causes (share of losses)', '');
  const causeKeys = ['attrition', 'timeout', 'objective'];
  out.push(`| config | ${causeKeys.join(' | ')} |`);
  out.push(`|---|${causeKeys.map(() => '---').join('|')}|`);
  for (const r of rows) {
    out.push(`| ${r.label} | ${causeKeys.map((k) => pct(r.summary.causes[k] ?? 0)).join(' | ')} |`);
  }
  out.push('');

  // Which route actually finished each win. A game with four ways to win that
  // measures one of them is a game with one way to win and three decorations.
  out.push('## Wins by route', '');
  out.push('| config | RUN | BURN | CALL | KNOW | declared |');
  out.push('|---|---|---|---|---|---|');
  for (const r of rows) {
    const w = r.summary.winSplit;
    out.push(
      `| ${r.label} | ${pct(w.run ?? 0)} | ${pct(w.burn ?? 0)} | ${pct(w.call ?? 0)} | ${pct(w.know ?? 0)} | ${pct(r.summary.declaredWinRate)} |`,
    );
  }
  out.push('');

  out.push('## Shape', '');
  out.push(
    '| config | early deaths (<8) | top action | share | dominant route | cards played/drawn | moves | mean wounds | mean kills | mean shaken |',
  );
  out.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const s = r.summary;
    out.push(
      `| ${r.label} | ${pct(s.earlyDeathRate)} | ${s.topAction} | ${pct(s.topActionShare)} | ${pct(s.dominantRouteShare)} | ${pct(s.cardPlayRate)} | ${s.movesPerRun.toFixed(1)} | ${s.means.wounds.toFixed(2)} | ${s.means.killed.toFixed(2)} | ${s.means.shaken.toFixed(2)} |`,
    );
  }
  out.push('');

  if (bands.length > 0) {
    out.push('## Gates', '');
    out.push('| check | value | band | status |');
    out.push('|---|---|---|---|');
    for (const b of bands) {
      const ok = b.value >= b.min && b.value <= b.max;
      const fmt = (n: number): string => (b.unit === 'pct' ? pct(n) : n.toFixed(2));
      out.push(`| ${b.label} | ${fmt(b.value)} | ${fmt(b.min)}–${fmt(b.max)} | ${ok ? 'PASS' : 'FAIL'} |`);
    }
    out.push('');
  }

  const first = rows[0];
  if (first) {
    out.push('## Card play rate (given drawn)', '');
    out.push('| card | rate |');
    out.push('|---|---|');
    for (const [id, rate] of Object.entries(first.summary.cardPlayRates).sort((a, b) => a[1] - b[1])) {
      out.push(`| ${id} | ${pct(rate)} |`);
    }
    out.push('');
  }
  return out.join('\n');
}
