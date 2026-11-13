// Test-only wrapping of known served adapter/controller method bodies.
export function settledMethod(source,name,signal){
 const pattern=new RegExp('(?:async (?:function )?'+name+'\\([^)]*\\)|'+name+':async\\s*(?:\\([^)]*\\)|\\w+)=>)\\{','g');const hit=[...source.matchAll(pattern)].at(-1);if(!hit)return source;
 const start=hit.index+hit[0].length;let depth=1,quote=null,escaped=false,end=start;
 for(;end<source.length;end++){const c=source[end];if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote=null;continue}if(c==='"'||c==="'"||c==='`'){quote=c;continue}if(c==='{')depth++;if(c==='}'&&--depth===0)break;}
 if(depth!==0)throw Error('Unclosed instrumented method '+name);
 return source.slice(0,start)+'try{'+source.slice(start,end)+'}finally{'+signal+'}'+source.slice(end);
}
