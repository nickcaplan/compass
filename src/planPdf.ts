import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Brief, Plan } from './data';
import { OBJECTIVES, campaignWeeks, formatDate, gbp, marketLabels, weeksLabel } from './data';

export const REPORT_NOTE = 'Design concept - scenario, figures and rationale are illustrative, adapted from the Compass brief';

// Plain text only: campaign names are never interpreted as HTML or PDF markup.
export function planReport(brief: Brief, plan: Plan): TDocumentDefinitions {
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
  const heading = (text: string): Content => ({ text, style: 'section' });
  return {
    pageSize: 'A4', pageMargins: [42, 40, 42, 60],
    info: { title: brief.name || 'Untitled campaign', author: 'The Hybrid House', subject: 'Compass saved media plan - illustrative concept' },
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.25, color: '#17171c' },
    footer: (page, pages) => ({ margin: [42, 10, 42, 0], stack: [
      { text: REPORT_NOTE, fontSize: 7.5, color: '#656571' },
      { text: `Compass by The Hybrid House  |  ${page} / ${pages}`, fontSize: 8, color: '#656571', margin: [0, 5, 0, 0] },
    ] }),
    content: [
      { text: 'COMPASS', fontSize: 24, bold: true, characterSpacing: 2, margin: [0, 0, 0, 2] },
      { text: 'by The Hybrid House', fontSize: 9, color: '#656571', margin: [0, 0, 0, 24] },
      { text: brief.name || 'Untitled campaign', fontSize: 21, bold: true, margin: [0, 0, 0, 6] },
      { text: 'SAVED MEDIA PLAN', fontSize: 8, characterSpacing: 1.3, color: '#656571', margin: [0, 0, 0, 16] },
      heading('Your brief'),
      { table: { widths: [104, '*'], body: rows.map(([label, value]) => [
        { text: label, color: '#656571' }, { text: value, bold: true },
      ]) }, layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 10, paddingTop: () => 5, paddingBottom: () => 5 } },
      heading('Plan summary'),
      { table: { widths: ['*', 165], body: plan.metrics.map(metric => [
        { text: metric.k, margin: [8, 6] }, { text: metric.v, bold: true, color: metric.hl ? '#8b6400' : '#17171c', margin: [8, 6], alignment: 'right' },
      ]) }, layout: { fillColor: (row: number) => row % 2 === 0 ? '#f4f3ef' : '#ffffff', hLineWidth: () => 0, vLineWidth: () => 0 } },
      { text: 'Publisher allocations', style: 'section', pageBreak: 'before' },
      ...plan.items.map((item): Content => ({ unbreakable: true, stack: [
        { text: item.title, style: 'publisher' },
        { text: item.format, fontSize: 8, color: '#8b6400', margin: [0, 0, 0, 7] },
        { text: [{ text: 'Spend: ', color: '#656571' }, { text: gbp(item.spend), bold: true }, ...item.metrics.flatMap(metric => [{ text: `    ${metric.k}: `, color: '#656571' }, { text: metric.v, bold: true }])], margin: [0, 0, 0, 7] },
        { text: [{ text: 'Why: ', bold: true }, { text: item.why }], margin: [0, 0, 0, 18] },
      ] })),
      heading('Suggested timing'),
      ...plan.timing.map((timing): Content => ({ columns: [{ text: timing.label, width: 94, bold: true, color: '#8b6400' }, { text: timing.activity, width: '*' }], columnGap: 12, margin: [0, 0, 0, 10] })),
    ],
    styles: {
      section: { fontSize: 15, bold: true, margin: [0, 18, 0, 10] },
      publisher: { fontSize: 12, bold: true, margin: [0, 6, 0, 4] },
    },
  };
}

export async function downloadPlanPdf(brief: Brief, plan: Plan): Promise<void> {
  // Large renderer/font chunks load only on demand, never on initial page load.
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts'),
  ]);
  pdfMake.addVirtualFileSystem(fonts);
  const blob = await pdfMake.createPdf(planReport(brief, plan)).getBlob();
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
