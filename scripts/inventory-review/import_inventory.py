#!/usr/bin/env python3
"""Private Compass workbook import. Requires openpyxl. Never changes the workbook."""
import sys,json,re,hashlib,collections,pathlib,math
import openpyxl

def import_workbook(path):
    w=openpyxl.load_workbook(path,data_only=True)
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
        if tactic!='Other / Review' and tactic in rules and raw['Primary KPI']!=rules[tactic]['Primary KPI']:issues.append('tactic_kpi_mismatch')
        name=str(raw['Product / Format']).strip(' \t\n•·-')
        if not re.search('[A-Za-z]',name) or re.fullmatch(r'[C$£€\s\d,.:]+(?:CPM|CPL|USD|CAD)?',name,re.I):issues.append('price_like_product_name')
        rate=raw['Cost / Rate']; volume=raw['Forecast Base Volume']; kpi=raw['KPI Assumption']
        if not all(isinstance(v,(int,float)) and math.isfinite(v) and v>0 for v in [rate,volume]):issues.append('invalid_rate_or_volume')
        if raw['Buying Model']=='CPM' and isinstance(rate,(int,float)) and rate>1000:issues.append('cpm_over_1000_review_threshold')
        if raw['Primary KPI'] in ('CTR','VTR') and not (isinstance(kpi,(int,float)) and 0<=kpi<=1):issues.append('invalid_kpi_fraction')
        # The thresholds are review triggers, not asserted industry limits.
        cost=volume/1000*rate if raw['Buying Model']=='CPM' else rate if raw['Buying Model'] in ('CPL','Flat fee') else None
        if raw['Buying Model']=='CPL':issues.append('cpl_one_unit_cost_not_campaign_budget')
        expected=volume*kpi if raw['Primary KPI'] in ('CTR','VTR') else kpi if raw['Primary KPI']=='Registrations' else cost/kpi if raw['Primary KPI']=='CPL' and kpi else None
        if cost is None or abs(cost-raw['Estimated Cost'])>.011:issues.append('cost_formula_mismatch')
        if expected is None or abs(expected-raw['Expected Result'])>.501:issues.append('result_formula_mismatch')
        records.append(dict(id=rid,source_sheet='Media Inventory',source_excel_row=excel_row,raw=raw,tactic=tactic,publisher=raw['Publisher'],product=name,market=raw['Market'],objective=raw['Suggested Objective'],source_audiences=[x.strip() for x in raw['Audience Type'].split('|')],primary_kpi=raw['Primary KPI'],forecast_unit=raw['Forecast Unit'],expected_result=raw['Expected Result'],estimated_source_cost=raw['Estimated Cost'],declared_currency=raw['Currency'],gbp_cost=None,preferred=False,mock=True,tactic_description=descriptions.get(tactic,{}).get('Why this tactic is useful — dashboard summary'),structural_issues=issues,structurally_reviewable=not issues,recommendation_blockers=issues+['currency_unverified','audience_mapping_unapproved','availability_unverified','mock_data'],production_eligible=False))
    counts=collections.Counter(i for r in records for i in r['structural_issues'])
    summary=dict(rows=len(records),source_products=len({r['raw']['Source Excel Row'] for r in records}),markets=dict(collections.Counter(r['market'] for r in records)),tactics=dict(collections.Counter(r['tactic'] for r in records)),structurally_reviewable=sum(r['structurally_reviewable'] for r in records),structural_issue_counts=dict(counts),production_eligible=0)
    return dict(schema_version=1,source_sha256=hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest(),notice='MOCK DATA - NOT VALIDATED. Private integration fixture, not client quotations.',policy={'global':'separate market, never fallback','currencies':'preserve declared labels; no FX conversion','audiences':'no approved mapping yet; fail closed','selection':'whole source packages only; no unlimited scaling','preference':'none until scoring approved','cpm_review_threshold':1000},rules=rules,descriptions=descriptions,summary=summary,records=records)

if __name__=='__main__':
    data=import_workbook(sys.argv[1]);out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
    (out/'inventory.private.json').write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
    (out/'validation-summary.json').write_text(json.dumps(data['summary'],indent=2)+'\n')
    print(json.dumps(data['summary'],indent=2))
