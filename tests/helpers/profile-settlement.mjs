// Instrument the served application, including a hosted minified App chunk.
// Signals run at operation settlement, not merely at HTTP response delivery.
function endBrace(source,start){let depth=1,quote=null,escape=false;for(let i=start;i<source.length;i++){const c=source[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote=null;continue}if(c==='"'||c==="'"||c==='`'){quote=c;continue}if(c==='{')depth++;else if(c==='}'&&!--depth)return i;}throw Error('Unclosed profile instrumentation block')}
export function profileSettlement(source){
 const marker=source.indexOf('Could not save your details. Please try again.');if(marker<0)return source;
 const functions=[...source.slice(0,marker).matchAll(/async function [\w$]+\([^)]*\)\{/g)];const fn=functions.at(-1);if(!fn)throw Error('Profile save handler not found');let start=fn.index+fn[0].length,end=endBrace(source,start);if(end<marker)throw Error('Profile save marker outside handler');source=source.slice(0,start)+'try{'+source.slice(start,end)+'}finally{window.profileSaveSettled=(window.profileSaveSettled||0)+1;}'+source.slice(end);
 const lookup=source.lastIndexOf('.getUser(');if(lookup<0)throw Error('Profile lookup not found');const catchAt=source.indexOf('.catch(()=>{})',lookup);if(catchAt<0)throw Error('Profile lookup settlement not found');const finish=catchAt+'.catch(()=>{})'.length;source=source.slice(0,finish)+'.finally(()=>{window.profileLookupSettled=(window.profileLookupSettled||0)+1;})'+source.slice(finish);return source;
}
