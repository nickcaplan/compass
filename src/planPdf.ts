import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Brief } from './data';
import { MARKETS, OBJECTIVES, campaignWeeks, formatDate, gbp, marketLabels, weeksLabel } from './data';
import inventory from './inventory.mock.json';
import { sourceOptions } from './plannerSourceOptions';


// Plain text only: campaign names are never interpreted as HTML or PDF markup.
export function planReport(brief: Brief, { brandLogo, brandMark }: { brandLogo: string; brandMark: string }): TDocumentDefinitions {
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
  const objectiveLabels = brief.objectives.map(id => OBJECTIVES.find(o => o.id === id)?.label).filter((l): l is string => Boolean(l));
  const marketBlocks: Content[] = MARKETS.filter(m => brief.markets?.includes(m.id)).flatMap((m, mi): Content[] => {
    const result = sourceOptions(inventory.records, m.label, objectiveLabels);
    return [
      { ...heading(m.label, String(mi + 2).padStart(2, '0')) as object, ...(mi === 0 ? { pageBreak: 'before' } : {}) } as Content,
      { text: `${result.optionCount} source options. ${result.heldCount} source rows held for review.`, fontSize: 8, margin: [0, 0, 0, 8] },
      ...(result.optionCount ? [] : [{ text: 'No source options ready in this slice. This is a data limitation, not proof that no publishers exist.', margin: [0, 0, 0, 8] } as Content]),
      ...result.groups.flatMap((g): Content[] => [
        { text: g.tactic, style: 'publisher' },
        ...g.options.map((row): Content => ({ unbreakable: true, margin: [0, 0, 0, 9], stack: [
          { text: `${row.publisher} - ${row.product}`, bold: true },
          { text: [
            { text: 'Expected delivery: ' }, { text: `${row.expected_result.toLocaleString('en-GB', { maximumFractionDigits: 2 })} ${row.forecast_unit}`, bold: true },
            { text: `    Source cost (${row.declared_currency || 'unspecified currency'}): ` }, { text: Math.round(row.estimated_source_cost).toLocaleString('en-GB'), bold: true },
            { text: '    Primary KPI: ' }, { text: row.primary_kpi, bold: true },
          ], fontSize: 9 },
        ] })),
      ]),
    ];
  });

  return {
    pageSize: 'A4', pageMargins: [42, 108, 42, 60],
    header: () => ({ margin: [42, 20, 42, 0], stack: [
      { table: { widths: [310, '*'], body: [[
        { fillColor: '#17171c', margin: [12, 11, 12, 11], columns: [{ image: brandMark, width: 26, margin: [0, 5, 9, 0] }, { text: 'COMPASS', font: 'Poppins', fontSize: 20, bold: true, characterSpacing: 2, color: '#ffffff', margin: [10, 6, 0, 0] }], columnGap: 3 },
        { fillColor: '#17171c', margin: [12, 11, 12, 11], image: brandLogo, fit: [72, 36], alignment: 'right' },
      ]] }, layout: 'noBorders' },
      { canvas: [{ type: 'line', x1: 0, y1: 1, x2: 64, y2: 1, lineWidth: 2, lineColor: '#ffcc00' }] },
    ] }),
    info: { title: brief.name || 'Untitled campaign', author: 'The Hybrid House', subject: 'Compass saved source options' },
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.25, color: '#000000' },
    footer: (page, pages) => ({ margin: [42, 10, 42, 0], stack: [
      { text: `Compass by The Hybrid House  |  ${page} / ${pages}`, fontSize: 8, color: '#000000' },
    ] }),
    content: [
      { text: brief.name || 'Untitled campaign', font: 'Poppins', fontSize: 19, bold: true, margin: [0, 0, 0, 6] },
      { text: 'SAVED SOURCE OPTIONS', fontSize: 8, characterSpacing: 1.3, color: '#000000', margin: [0, 0, 0, 16] },
      heading('Your brief', '01'),
      { table: { widths: [92, 292], body: rows.map(([label, value]) => [
        { text: label, color: '#000000' }, { text: value, bold: true },
      ]) }, layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 10, paddingTop: () => 3.5, paddingBottom: () => 3.5 } },
      { text: 'Source options. No allocated plan. Options are unranked and nothing is preferred or allocated. Costs keep the currency declared in the source workbook.', fontSize: 9, margin: [0, 12, 0, 0] },
      ...marketBlocks,
    ],
    styles: {
      section: { font: 'Poppins', fontSize: 13, bold: true, margin: [0, 13, 0, 8] },
      publisher: { font: 'Poppins', fontSize: 11, bold: true, margin: [0, 6, 0, 4] },
    },
  };
}

export async function downloadPlanPdf(brief: Brief): Promise<void> {
  // Large renderer/font chunks load only on demand, never on initial page load.
  const [{ default: pdfMake }, { default: fonts }, { brandFont }, brand] = await Promise.all([
    import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts'), import('./reportFont'), import('./reportBrand'),
  ]);
  pdfMake.addVirtualFileSystem({ ...fonts, 'Poppins-Bold.ttf': brandFont });
  pdfMake.addFonts({ Poppins: { normal: 'Poppins-Bold.ttf', bold: 'Poppins-Bold.ttf', italics: 'Poppins-Bold.ttf', bolditalics: 'Poppins-Bold.ttf' } });
  const blob = await pdfMake.createPdf(planReport(brief, brand)).getBlob();
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
