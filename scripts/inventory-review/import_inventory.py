#!/usr/bin/env python3
"""Private Compass workbook import. Requires openpyxl. Never changes the workbook."""
import sys,json,re,hashlib,collections,pathlib,math
import openpyxl

AUDIENCES=['Procurement','Laboratory Manager','Laboratory Technician','Scientist / Researcher','Purchasing Manager','Quality / Compliance']

def calculate(raw):
    """Brief section 6. The workbook's cached Expected Result / Estimated Cost are not used.
    CPM: volume (5,000 if missing) / 1,000 x rate; delivery = volume.
    CPL: 100 leads per package; cost = 100 x rate.
    Flat fee: cost = package price. Delivery: CTR = volume x CTR; Impressions/Reach = volume;
    Registrations, Listens, Clicks and leads are counts, never multiplied by volume."""
    model=raw['Buying Model']; kpi=raw['Primary KPI']; rate=raw['Cost / Rate']
    volume=raw['Forecast Base Volume'] if isinstance(raw['Forecast Base Volume'],(int,float)) and raw['Forecast Base Volume']>0 else 5000
    n=raw['KPI Assumption']
    if model=='CPM': cost=volume/1000*rate
    elif model=='CPL': cost=100*rate
    elif model=='Flat fee': cost=rate
    else: return None,None,'unsupported_buying_model'
    if model=='CPL': result,basis=100,'cpl_package_100_leads'
    elif kpi in ('Impressions','Reach'): result,basis=volume,'volume'
    elif kpi in ('CTR','VTR'): result,basis=volume*n,'volume_x_rate'
    elif kpi in ('Registrations','Listens','Clicks','CPL'): result,basis=n,'package_count'
    else: return None,None,'unsupported_kpi'
    return round(result),round(cost,2),basis

def import_workbook(path):
    w=openpyxl.load_workbook(path,data_only=True)  # cached T/U are read only to record what changed
    def rows(name):
        it=iter(w[name].values); heads=next(it)
        return [dict(zip(heads,r)) for r in it if any(v is not None for v in r)]
    rules={r['Tactic']:r for r in rows('Tactic Rules')}
    descriptions={r['Tactic']:r for r in rows('Tactic Descriptions')}
    records=[]; ids=set()
    for excel_row,raw in enumerate(rows('Media Inventory'),2):
        rid=raw['Record ID']
        if rid in ids: raise ValueError('Duplicate record ID: '+rid)
        ids.add(rid)
        tactic='Other / Review' if raw['Tactic']=='Other' else raw['Tactic']
        issues=[]
        if tactic=='Other / Review':issues.append('unclassified_tactic')
        if tactic not in rules:issues.append('missing_tactic_rule')
        if tactic not in descriptions:issues.append('missing_tactic_description')
        name=str(raw['Product / Format']).strip(' \t\n•·-')
        if not re.search('[A-Za-z]',name) or re.fullmatch(r'[C$£€\s\d,.:]+(?:CPM|CPL|USD|CAD)?',name,re.I):issues.append('price_like_product_name')
        rate=raw['Cost / Rate']; volume=raw['Forecast Base Volume']; kpi=raw['KPI Assumption']
        if not all(isinstance(v,(int,float)) and math.isfinite(v) and v>0 for v in [rate,volume]):issues.append('invalid_rate_or_volume')
        if raw['Buying Model']=='CPM' and isinstance(rate,(int,float)) and rate>1000:issues.append('cpm_over_1000_review_threshold')
        if raw['Primary KPI'] in ('CTR','VTR') and not (isinstance(kpi,(int,float)) and 0<=kpi<=1):issues.append('invalid_kpi_fraction')
        # The thresholds are review triggers, not asserted industry limits.
        expected,cost,basis=calculate(raw)
        if cost is None:issues.append('unsupported_calculation')
        flags={a_:raw[a_]=='Yes' for a_ in AUDIENCES}
        if any(raw[a_] not in ('Yes','No') for a_ in AUDIENCES):issues.append('invalid_audience_flag')
        prio=raw['Priority of Media Selection']
        if prio not in (1,2,3,4,5):issues.append('invalid_priority')
        if raw['Currency']!='USD':issues.append('non_usd_currency')
        records.append(dict(id=rid,source_sheet='Media Inventory',source_excel_row=excel_row,raw=raw,tactic=tactic,publisher=raw['Publisher'],product=name,market=raw['Market'],objective=raw['Suggested Objective'],source_audiences=[x.strip() for x in raw['Audience Type'].split('|')],primary_kpi=raw['Primary KPI'],forecast_unit=raw['Forecast Unit'],expected_result=expected,estimated_source_cost=cost,calc_basis=basis,source_cached_result=raw['Expected Result'],source_cached_cost=raw['Estimated Cost'],priority=prio,audience_fit=flags,selection_rationale=raw['Media Selection Rationale'],why_tactic=raw['Why Tactic'],declared_currency=raw['Currency'],gbp_cost=None,preferred=False,mock=True,tactic_description=descriptions.get(tactic,{}).get('Why this tactic is useful — dashboard summary'),structural_issues=issues,structurally_reviewable=not issues,recommendation_blockers=issues+['currency_unverified','availability_unverified','mock_data'],production_eligible=False))
    counts=collections.Counter(i for r in records for i in r['structural_issues'])
    summary=dict(rows=len(records),source_products=len({r['raw']['Source Excel Row'] for r in records}),markets=dict(collections.Counter(r['market'] for r in records)),tactics=dict(collections.Counter(r['tactic'] for r in records)),structurally_reviewable=sum(r['structurally_reviewable'] for r in records),structural_issue_counts=dict(counts),priority_1=sum(r['priority']==1 for r in records),currencies=dict(collections.Counter(r['declared_currency'] for r in records)),result_recalculated=sum(r['expected_result']!=r['source_cached_result'] for r in records),cost_recalculated=sum(abs(r['estimated_source_cost']-r['source_cached_cost'])>.011 for r in records),production_eligible=0)
    return dict(schema_version=1,source_sha256=hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest(),notice='MOCK DATA - NOT VALIDATED. Private integration fixture, not client quotations.',policy={'global':'separate market, never fallback','currencies':'USD only, no conversion','audiences':'six Yes/No flags per row; match any selected audience','selection':'whole source packages only; rank by priority ascending, then lower cost, then record ID','preference':'none until scoring approved','cpm_review_threshold':1000},rules=rules,descriptions=descriptions,summary=summary,records=records)

if __name__=='__main__':
    data=import_workbook(sys.argv[1]);out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
    (out/'inventory.private.json').write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
    (out/'validation-summary.json').write_text(json.dumps(data['summary'],indent=2)+'\n')
    print(json.dumps(data['summary'],indent=2))
