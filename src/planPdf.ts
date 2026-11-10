import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Brief, Plan } from './data';
import { OBJECTIVES, campaignWeeks, formatDate, gbp, marketLabels, weeksLabel } from './data';

export const REPORT_NOTE = 'Design concept - scenario, figures and rationale are illustrative, adapted from the Compass brief';

// Plain text only: campaign names are never interpreted as HTML or PDF markup.
export function planReport(brief: Brief, plan: Plan, { brandLogo, brandMark }: { brandLogo: string; brandMark: string }): TDocumentDefinitions {
  const weeks = campaignWeeks(brief.start, brief.end);
  const rows = [
    ['Campaign name', brief.name || 'Untitled campaign'],
    ['Objective', brief.objectives.map(id => OBJECTIVES.find(o => o.id === id)?.label).filter(Boolean).join(' + ') || '-'],
    ['Market', marketLabels(brief.markets) || 'Not specified'],
    ['KPI', brief.kpis.join(' + ') || '-'],
    ['Audience', brief.audiences.join(' + ') || '-'],
    ['Budget', brief.budget !== null ? gbp(brief.budget) : '-'],
    ['Campaign dates', weeks > 0 ? `${formatDate(brief.start)} to ${formatDate(brief.end)} - ${weeksLabel(weeks)}` : '-'],
  ];
  const heading = (text: string, number: string): Content => ({
    columns: [
      { width: 28, table: { widths: [22], body: [[{ text: number, bold: true, fontSize: 10, alignment: 'center', fillColor: '#ffcc00', margin: [0, 3] }]] }, layout: 'noBorders' },
      { text, style: 'section', margin: [8, 1, 0, 0] },
    ], margin: [0, 15, 0, 10], unbreakable: true,
  });
  const metricRows: Content[] = [];
  for (let i = 0; i < plan.metrics.length; i += 3) {
    metricRows.push({ columns: plan.metrics.slice(i, i + 3).map(metric => ({
      width: 163, stack: [
        { canvas: [{ type: 'rect', x: 0, y: 0, w: 64, h: 3, color: '#ffcc00' }] },
        { table: { widths: [147], body: [[{ stack: [
          { text: metric.k, fontSize: 8, margin: [0, 0, 0, 6] },
          { text: metric.v, font: 'Poppins', bold: true, fontSize: 17 },
        ], fillColor: '#f4f3ef', margin: [5, 8, 5, 9] }]] }, layout: 'noBorders' },
      ],
    })), columnGap: 11, margin: [0, 0, 0, 10], unbreakable: true });
  }
  const allocated = plan.items.reduce((total, item) => total + item.spend, 0);
  const exactShares = plan.items.map(item => allocated > 0 ? 100 * item.spend / allocated : 0);
  const spendShares = exactShares.map(Math.floor);
  const remaining = allocated > 0 ? 100 - spendShares.reduce((sum, share) => sum + share, 0) : 0;
  exactShares.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    .slice(0, remaining).forEach(({ index }) => { spendShares[index] += 1; });


  return {
    pageSize: 'A4', pageMargins: [42, 108, 42, 60],
    header: () => ({ margin: [42, 20, 42, 0], stack: [
      { table: { widths: [310, '*'], body: [[
        { fillColor: '#17171c', margin: [12, 11, 12, 11], columns: [{ image: brandMark, width: 26, margin: [0, 5, 9, 0] }, { text: 'COMPASS', font: 'Poppins', fontSize: 20, bold: true, characterSpacing: 2, color: '#ffffff', margin: [10, 6, 0, 0] }], columnGap: 3 },
        { fillColor: '#17171c', margin: [12, 11, 12, 11], image: brandLogo, fit: [72, 36], alignment: 'right' },
      ]] }, layout: 'noBorders' },
      { canvas: [{ type: 'line', x1: 0, y1: 1, x2: 64, y2: 1, lineWidth: 2, lineColor: '#ffcc00' }] },
    ] }),
    info: { title: brief.name || 'Untitled campaign', author: 'The Hybrid House', subject: 'Compass saved media plan - illustrative concept' },
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.25, color: '#000000' },
    footer: (page, pages) => ({ margin: [42, 10, 42, 0], stack: [
      { text: REPORT_NOTE, fontSize: 7.5, color: '#000000' },
      { text: `Compass by The Hybrid House  |  ${page} / ${pages}`, fontSize: 8, color: '#000000', margin: [0, 5, 0, 0] },
    ] }),
    content: [
      { text: brief.name || 'Untitled campaign', font: 'Poppins', fontSize: 19, bold: true, margin: [0, 0, 0, 6] },
      { text: 'SAVED MEDIA PLAN', fontSize: 8, characterSpacing: 1.3, color: '#000000', margin: [0, 0, 0, 16] },
      heading('Your brief', '01'),
      { table: { widths: [92, 292], body: rows.map(([label, value]) => [
        { text: label, color: '#000000' }, { text: value, bold: true },
      ]) }, layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 10, paddingTop: () => 3.5, paddingBottom: () => 3.5 } },
      heading('Key figures', '02'),
      ...metricRows,
      { ...heading('Publisher allocations', '03') as object, pageBreak: 'before' } as Content,
      ...plan.items.map((item, index): Content => ({ unbreakable: true, stack: [
        { text: item.title, style: 'publisher' },
        { text: item.format, fontSize: 8, color: '#000000', margin: [0, 0, 0, 7] },
        { canvas: [
          { type: 'rect', x: 0, y: 0, w: 180, h: 5, color: '#f0efeb' },
          { type: 'rect', x: 0, y: 0, w: allocated > 0 ? 180 * item.spend / allocated : 0, h: 5, color: '#ffcc00' },
        ], margin: [0, 0, 0, 5] },
        { text: `${spendShares[index]}% of allocated spend`, fontSize: 8, margin: [0, 0, 0, 7] },
        { text: [{ text: 'Spend: ', color: '#000000' }, { text: gbp(item.spend), bold: true }, ...item.metrics.flatMap(metric => [{ text: `    ${metric.k}: `, color: '#000000' }, { text: metric.v, bold: true }])], margin: [0, 0, 0, 7] },
        { text: [{ text: 'Why: ', bold: true }, { text: item.why }], margin: [0, 0, 0, 18] },
      ] })),
      { unbreakable: true, stack: [
        heading('Suggested timing', '04'),
        ...plan.timing.map((timing): Content => ({ columns: [{ text: timing.label, width: 94, bold: true, color: '#000000' }, { text: timing.activity, width: '*' }], columnGap: 12, margin: [0, 0, 0, 8] })),
      ] },
    ],
    styles: {
      section: { font: 'Poppins', fontSize: 13, bold: true, margin: [0, 13, 0, 8] },
      publisher: { font: 'Poppins', fontSize: 11, bold: true, margin: [0, 6, 0, 4] },
    },
  };
}

export async function downloadPlanPdf(brief: Brief, plan: Plan): Promise<void> {
  // Large renderer/font chunks load only on demand, never on initial page load.
  const [{ default: pdfMake }, { default: fonts }, { brandFont }, brand] = await Promise.all([
    import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts'), import('./reportFont'), import('./reportBrand'),
  ]);
  pdfMake.addVirtualFileSystem({ ...fonts, 'Poppins-Bold.ttf': brandFont });
  pdfMake.addFonts({ Poppins: { normal: 'Poppins-Bold.ttf', bold: 'Poppins-Bold.ttf', italics: 'Poppins-Bold.ttf', bolditalics: 'Poppins-Bold.ttf' } });
  const blob = await pdfMake.createPdf(planReport(brief, plan, brand)).getBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const name = brief.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 _-]/g, '-').replace(/[- ]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
  link.download = `Compass-${name || 'plan'}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
