(function(){
const D = window.CRM, S = D.sheets;
const TABS = ['Dashboard','Investors','Investor Positions','Deals','Commissions','Raise Income','Brokering Income','Combined','Pipeline','Activity Log','Year by Year','Reconciliation','Notes'];
const $ = (h)=>{const t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstChild;};
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const money = (v,dec) => (v<0?'-':'')+'$'+Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:dec?2:0,maximumFractionDigits:dec?2:0});
const fmtMoney = v => money(v, Math.round(v)!==v);
const pct = v => (v*100).toLocaleString('en-US',{maximumFractionDigits:2})+'%';
const isPct = h => /RATE|COMM\. %|MARGIN|VS BEST/.test(h);
const isMoney = h => /\$|RAISE|COMMISSION|AMOUNT|INCOME|GAP|BASIS|DIFFERENCE|SHEP SHEET|SCREENSHOT|^20\d\d$|TOTAL RAISED|LIFETIME|INVESTED/.test(h) && !/YEAR|YR|TAB NAME|NOTE|STATUS|COMMENT|OFFERING\(S\)/.test(h);
function fmt(h, v){
  if(v===null||v===undefined||v==='') return '';
  if(typeof v==='number'){ if(isPct(h)) return pct(v); if(isMoney(h)) return fmtMoney(v); return String(v); }
  return esc(v);
}
function badge(v){
  const s=String(v), l=s.toLowerCase();
  let c='b-gray';
  if(/active|committed|credited|closed|brokering/.test(l)) c='b-gold';
  if(/past investor|transacted|open/.test(l)) c='b-green';
  if(/not interested|duplicate/.test(l)) c='b-red';
  return `<span class="badge ${c}">${esc(s)}</span>`;
}
const BADGE_COLS = /^(STATUS|STAGE|OUTCOME|TYPE|PROGRAM|PROGRAMS)$/;
const WIDE_COLS = /NOTE|COMMENT|DETAIL|NEXT STEP|FLAG/;
function tables(name){ return S[name].filter(b=>b.type==='table'); }
function titles(name){ return S[name].filter(b=>b.type==='title').map(b=>b.text); }

function renderTable(t, opts={}){
  const totalIdx = t.rows.findIndex(r=>/^total/i.test(String(r[0]))||/^Total /.test(String(r[0])));
  let body = t.rows.slice(); let total=null;
  if(opts.splitTotal && totalIdx>=0 && totalIdx===t.rows.length-1){ total=body.pop(); }
  const wrap=$(`<div></div>`);
  let state={q:'',f:'',sort:null,dir:1};
  let filterCol = opts.filterCol!=null ? t.header.indexOf(opts.filterCol) : -1;
  if(opts.search){
    const tb=$(`<div class="toolbar"><input type="search" placeholder="Search ${esc(opts.search)}…"></div>`);
    if(filterCol>=0){
      const vals=[...new Set(body.map(r=>r[filterCol]).filter(v=>v!=null))];
      const sel=$(`<select><option value="">All ${esc(t.header[filterCol].toLowerCase())}</option>${vals.map(v=>`<option>${esc(v)}</option>`).join('')}</select>`);
      sel.onchange=()=>{state.f=sel.value;draw();}; tb.appendChild(sel);
    }
    const cnt=$(`<span class="count"></span>`); tb.appendChild(cnt);
    tb.querySelector('input').oninput=e=>{state.q=e.target.value.toLowerCase();draw();};
    wrap.appendChild(tb); wrap._cnt=cnt;
  }
  const tw=$(`<div class="tblwrap"><table><thead></thead><tbody></tbody><tfoot></tfoot></table></div>`);
  if(opts.noMax) tw.style.maxHeight='none';
  wrap.appendChild(tw);
  const thead=tw.querySelector('thead'), tbody=tw.querySelector('tbody'), tfoot=tw.querySelector('tfoot');
  const numCol = t.header.map((h,i)=>body.some(r=>typeof r[i]==='number') && !body.some(r=>typeof r[i]==='string' && r[i]!==''));
  const tr=document.createElement('tr');
  function headHtml(){
    const tr=document.createElement('tr');
    t.header.forEach((h,i)=>{
      const arrow = state.sort===i ? (state.dir>0?' \u25B2':' \u25BC') : '';
      const th=$(`<th class="sortable ${numCol[i]?'num':''}" title="Sort">${esc(h)}${arrow}</th>`);
      th.onclick=()=>{state.dir=state.sort===i?-state.dir:1;state.sort=i;draw();};
      tr.appendChild(th);
    });
    return tr;
  }
  thead.appendChild(headHtml());
  const rowHtml=(r,cls='')=>`<tr class="${cls}">${r.map((v,i)=>{const h=t.header[i];
    const inner = (BADGE_COLS.test(h)&&v&&!cls)? badge(v) : fmt(h,v);
    return `<td class="${numCol[i]?'num':''} ${(opts.wide||WIDE_COLS).test(h)?'wrapc':''}">${inner}</td>`;}).join('')}</tr>`;
  const sortKey=v=>{
    if(v==null||v==='') return null;
    if(typeof v==='number') return v;
    if(typeof v==='string'){
      const n=Number(String(v).replace(/[$,]/g,'').replace(/\((.*)\)/,'-$1'));
      if(!Number.isNaN(n) && /[\d]/.test(v) && /^[\s$(),.\-\d%]+$/.test(v)) return n;
      return v.toLowerCase();
    }
    return v;
  };
  function draw(){
    let rows=body.filter(r=>(!state.q||r.join(' ').toLowerCase().includes(state.q))&&(!state.f||String(r[filterCol])===state.f));
    if(state.sort!=null){
      const i=state.sort;
      rows=rows.slice().sort((a,b)=>{
        const x=sortKey(a[i]), y=sortKey(b[i]);
        if(x==null&&y==null) return 0; if(x==null) return 1; if(y==null) return -1;
        if(typeof x==='number'&&typeof y==='number') return (x-y)*state.dir;
        return String(x).localeCompare(String(y),undefined,{numeric:true,sensitivity:'base'})*state.dir;
      });
    }
    thead.innerHTML=''; thead.appendChild(headHtml());
    tbody.innerHTML=rows.map(r=>rowHtml(r, (!opts.splitTotal && /^total/i.test(String(r[0])))?'total':'')).join('');
    tfoot.innerHTML= total? rowHtml(total,'total'):'';
    if(wrap._cnt) wrap._cnt.textContent=`${rows.length} of ${body.length} rows`;
  }
  draw(); return wrap;
}
function sec(eyebrow, h, sub){ return $(`<div class="sec"><div class="eyebrow">${esc(eyebrow)}</div><h2>${esc(h)}</h2>${sub?`<p class="sub">${esc(sub)}</p>`:''}</div>`); }
function kpiGrid(list){ const g=$(`<div class="kpis"></div>`); list.forEach(k=>{
  let v=k.value; v = typeof v!=='number'? esc(v) : (isPct(k.label)?pct(v): /YEAR$|INVESTORS|PIPELINE/.test(k.label)? String(v) : fmtMoney(v));
  g.appendChild($(`<div class="kpi"><div class="l">${esc(k.label)}</div><div class="v">${v}</div><div class="c">${esc(k.caption||'')}</div></div>`));}); return g; }

const views={
  'Dashboard'(app){
    const k=D.dashboard.kpis;
    app.appendChild(sec('This year · 2026','Raise & commission'));
    app.appendChild(kpiGrid(k.slice(0,5))); app.appendChild($('<div style="height:12px"></div>')); app.appendChild(kpiGrid(k.slice(5,10)));
    app.appendChild(sec('Benchmark','Best year')); app.appendChild(kpiGrid(k.slice(10,15)));
    app.appendChild(sec('Leaderboard','Investors, offerings & follow-ups'));
    const g=$(`<div class="grid2"></div>`); app.appendChild(g);
    // leaderboard
    const inv=tables('Investors')[0], H=inv.header, li=H.indexOf('LIFETIME $ LISTED'), si=H.indexOf('STATUS');
    const top=inv.rows.filter(r=>r[0]!=='TOTAL'&&typeof r[li]==='number').sort((a,b)=>b[li]-a[li]).slice(0,10);
    const p1=$(`<div class="panel"><h3>TOP INVESTORS · LIFETIME $ LISTED</h3><div class="lb"></div></div>`);
    top.forEach((r,i)=>p1.querySelector('.lb').appendChild($(`<div class="lbrow"><div class="rk">${i+1}</div><div><div class="nm">${esc(r[0])}</div><div class="st">${esc(r[si])}</div></div><div class="amt">${fmtMoney(r[li])}</div></div>`)));
    if(top[0]) p1.appendChild($(`<div class="callout">🏆 ${esc(top[0][0])} leads lifetime $ listed across Shep's tabs.</div>`));
    g.appendChild(p1);
    // offerings
    const dl=tables('Deals')[0], dh=dl.header, ix=n=>dh.indexOf(n);
    const offs=dl.rows.filter(r=>r[ix('TYPE')]==='Raise (offering)');
    const act=tables('Activity Log')[0], ah=act.header;
    const p2=$(`<div class="panel"><h3>OFFERINGS</h3><div class="tblwrap" style="max-height:none"><table><thead><tr><th>OFFERING</th><th class="num">YEAR</th><th class="num">RAISED</th><th class="num">COMMISSION</th><th class="num">RATE</th></tr></thead><tbody>${
      offs.sort((a,b)=>b[ix('GROSS $ (RAISE / PRICE)')]-a[ix('GROSS $ (RAISE / PRICE)')]).map(r=>`<tr><td>${esc(r[ix('DEAL')])}</td><td class="num">${r[ix('YEAR')]}</td><td class="num">${fmtMoney(r[ix('GROSS $ (RAISE / PRICE)')])}</td><td class="num">${fmtMoney(r[ix('COMMISSION $')])}</td><td class="num">${pct(r[ix('COMM. %')])}</td></tr>`).join('')
    }</tbody></table></div></div>`);
    const credited=dl.rows.filter(r=>r[ix('STATUS')]==='Credited');
    p2.appendChild($(`<h3 style="margin-top:16px">2026 CREDITED DEALS · COMMISSION SCREENSHOT</h3>`));
    p2.appendChild($(`<div class="tblwrap" style="max-height:none"><table><thead><tr><th>DEAL</th><th>ASSET</th><th class="num">RAISE</th><th class="num">COMMISSION</th></tr></thead><tbody>${credited.map(r=>`<tr><td>${esc(r[ix('DEAL')])}</td><td>${esc(r[ix('ASSET')]||'')}</td><td class="num">${fmtMoney(r[ix('GROSS $ (RAISE / PRICE)')])}</td><td class="num">${fmtMoney(r[ix('COMMISSION $')])}</td></tr>`).join('')}</tbody></table></div>`));
    g.appendChild(p2);
    // breakdown
    const g2=$(`<div class="grid2" style="margin-top:16px"></div>`); app.appendChild(g2);
    const yb=tables('Year by Year')[0], yh=yb.header, yr=yb.rows.filter(r=>typeof r[0]==='number');
    const ri=yh.indexOf('RAISED PER YEAR TAB'), mx=Math.max(...yr.map(r=>r[ri]||0));
    const p3=$(`<div class="panel"><h3>RAISED BY YEAR · PER YEAR TAB</h3><div class="bars"></div></div>`);
    yr.forEach(r=>p3.querySelector('.bars').appendChild($(`<div class="bar"><div><div class="yr">${r[0]}</div><div class="prog">${esc(r[1])}</div></div><div class="track"><div class="fill" style="width:${(r[ri]/mx*100).toFixed(1)}%"></div></div><div class="amt">${fmtMoney(r[ri])}</div></div>`)));
    g2.appendChild(p3);
    const pl=tables('Pipeline')[0], ph=pl.header, pi=n=>ph.indexOf(n);
    const p4=$(`<div class="panel"><h3>PIPELINE · FOLLOW-UPS</h3><div class="pipe"></div></div>`);
    const order={'Committed':0,'Re-engage':1,'Brokering':2,'Brokering lead':3};
    pl.rows.filter(r=>r[0]!=='TOTAL').sort((a,b)=>(order[a[1]]??9)-(order[b[1]]??9)||(b[pi('INDICATED $')]||0)-(a[pi('INDICATED $')]||0)).slice(0,10)
      .forEach(r=>p4.querySelector('.pipe').appendChild($(`<div class="it"><b>${esc(r[0])}</b> · ${badge(r[1])}<br><span>${esc(r[pi('SUGGESTED NEXT STEP')]||'')}${r[pi('INDICATED $')]?' · '+fmtMoney(r[pi('INDICATED $')]):''}</span></div>`)));
    p4.appendChild($(`<p class="sub" style="margin-top:10px">Full list on the Pipeline tab.</p>`));
    g2.appendChild(p4);
  },
  'Investors'(app){ const t=titles('Investors'); app.appendChild(sec('Investors','Contacts',t[1]));
    app.appendChild($(`<p class="sub">Click an investor's name to open their park positions.</p>`));
    const w=renderTable(tables('Investors')[0],{search:'investors',filterCol:'STATUS',splitTotal:true}); w.classList.add('inv-link');
    w.addEventListener('click',e=>{const td=e.target.closest('tbody td:first-child'); if(td&&td.textContent.trim()) go('Investor Positions',td.textContent.trim());});
    app.appendChild(w); },
  'Investor Positions'(app,name,inv){
    const bl=tables('Investor Positions'), T=bl[0], SUM=bl[1], H=T.header, ix=n=>H.indexOf(n);
    const JOINT={'Don Sanford':['Don / Cari']};
    const names=SUM.rows.filter(r=>r[0]!=='TOTAL').map(r=>r[0]);
    app.appendChild(sec('Investor positions','Park breakdown by investor',titles('Investor Positions')[1]));
    const tb=$(`<div class="toolbar"><select id="invsel"><option value="">Choose an investor…</option>${names.map(n=>`<option ${n===inv?'selected':''}>${esc(n)}</option>`).join('')}</select><span class="count">Amounts come from Shep's sheet + Elevate emails; CHECK = needs confirmation. Brokering rows show deal price, not an investment.</span></div>`);
    tb.querySelector('select').onchange=e=>go('Investor Positions',e.target.value);
    app.appendChild(tb);
    if(inv){
      const want=new Set([inv,...(JOINT[inv]||[])]);
      const mine=T.rows.filter(r=>want.has(r[ix('INVESTOR')]));
      if(!mine.length){ app.appendChild($(`<div class="callout">No park positions on record for <b>${esc(inv)}</b> (only amounts shown in the sources are listed).</div>`)); }
      else{
        const held=mine.filter(r=>r[ix('PROGRAM')]!=='Brokering'), brok=mine.filter(r=>r[ix('PROGRAM')]==='Brokering');
        const total=held.reduce((a,r)=>a+(r[ix('AMOUNT INVESTED')]||0),0);
        const joint=held.filter(r=>r[ix('INVESTOR')]!==inv||r[ix('JOINT')]).reduce((a,r)=>a+(r[ix('AMOUNT INVESTED')]||0),0);
        const parks=new Set(); held.forEach(r=>{const d=r[ix('PARK / DEAL')]; if(r[ix('PROGRAM')]==='BoaVida') return; d.split(' & ').filter(x=>/MHC|RV|Park/i.test(x)||!d.includes(' & ')).forEach(x=>parks.add(x.trim()));});
        const yrs=[...new Set(held.map(r=>r[ix('YEAR')]))].sort();
        app.appendChild(kpiGrid([
          {label:'TOTAL INVESTED',value:total,caption:joint?`incl. ${fmtMoney(joint)} joint (${(JOINT[inv]||[]).join(', ')})`:'Elevate + BoaVida'},
          {label:'PARKS',value:String(parks.size),caption:'Elevate parks (Frontier & Sequoia = 2)'},
          {label:'YEARS INVESTING',value:String(yrs.length),caption:yrs.length?`${yrs[0]}–${yrs[yrs.length-1]}`:''},
          {label:'POSITIONS',value:String(held.length),caption:'park / offering rows'},
          {label:'BROKERED DEALS',value:String(brok.length),caption:'direct purchases (not in total)'}]));
        app.appendChild(sec('',inv+' · positions'));
        app.appendChild(renderTable({header:H,rows:mine.slice().sort((a,b)=>b[ix('YEAR')]-a[ix('YEAR')])},{noMax:true,wide:/NOTE|^SOURCE$/}));
      }
    }
    app.appendChild(sec('All investors','Investor summary'));
    const sw=renderTable(SUM,{noMax:true,splitTotal:true}); sw.classList.add('inv-link');
    sw.addEventListener('click',e=>{const td=e.target.closest('tbody td:first-child'); if(td&&td.textContent.trim()) go('Investor Positions',td.textContent.trim());});
    app.appendChild(sw);
    app.appendChild(sec('All positions','Every park / deal row'));
    app.appendChild(renderTable(T,{search:'positions',filterCol:'PROGRAM',splitTotal:true,wide:/NOTE|^SOURCE$/}));
  },
  'Deals'(app){ const t=titles('Deals'); app.appendChild(sec('Deals','Raises & brokering',t[1])); app.appendChild(renderTable(tables('Deals')[0],{search:'deals',filterCol:'TYPE',splitTotal:true})); },
  'Pipeline'(app){ const t=titles('Pipeline'); app.appendChild(sec('Pipeline','Follow-ups',t[1])); app.appendChild(renderTable(tables('Pipeline')[0],{search:'pipeline',filterCol:'STAGE',splitTotal:true})); },
  'Activity Log'(app){ const t=titles('Activity Log'); app.appendChild(sec('Activity log','Every outreach row',t[1])); app.appendChild(renderTable(tables('Activity Log')[0],{search:'activity',filterCol:'YEAR',splitTotal:true})); },
  'Commissions':sectioned, 'Raise Income':sectioned, 'Brokering Income':sectioned, 'Combined':sectioned, 'Year by Year':sectioned, 'Reconciliation':sectioned,
  'Notes'(app){ app.appendChild(sec('Notes','How this CRM is built')); const p=$(`<div class="panel notes"><dl></dl></div>`);
    S['Notes'].filter(b=>b.type==='line').forEach(b=>p.querySelector('dl').append($(`<dt>${esc(b.cells[0])}</dt>`),$(`<dd>${esc(b.cells.slice(1).join(' '))}</dd>`)));
    p.querySelector('dl').append($(`<dt>Web version</dt>`),$(`<dd>Static site generated from ${esc(D.source)} on ${esc(D.generated)}. ${D.contactsIncluded?'':'Phone and email columns are left out of this public web build; they remain in the workbook.'}</dd>`));
    app.appendChild(p); }
};
function sectioned(app, name){
  const bl=S[name]; let first=true, pendingEyebrow=null;
  bl.forEach((b,i)=>{
    if(b.type==='title'){
      if(i===0) return; if(i===1){ app.appendChild(sec(name,name,b.text)); return; }
      if(b.text===b.text.toUpperCase()) pendingEyebrow=b.text; else { app.appendChild(sec(pendingEyebrow||'',b.text)); pendingEyebrow=null; }
    } else if(b.type==='table'){
      if(pendingEyebrow){ app.appendChild(sec('',pendingEyebrow)); pendingEyebrow=null; }
      app.appendChild(renderTable(b,{noMax:true})); app.appendChild($('<div style="height:10px"></div>'));
    }
  });
}
const nav=document.getElementById('nav'), app=document.getElementById('app');
document.getElementById('subtitle').textContent=D.dashboard.subtitle;
document.getElementById('foot').textContent=`Generated from ${D.source} · ${D.generated} · Shepard Banks Investments · raise & brokering data only.`;
function go(name,arg){ if(arg===undefined&&name&&name.includes('::')){[name,arg]=name.split('::');} if(!views[name]) name='Dashboard'; app.innerHTML=''; [...nav.children].forEach(b=>b.classList.toggle('on',b.textContent===name)); views[name](app,name,arg); const h='#'+encodeURIComponent(name+(arg?'::'+arg:'')); if(location.hash!==h) history.replaceState(null,'',h); window.scrollTo(0,0); }
TABS.forEach(t=>{const b=$(`<button>${t}</button>`);b.onclick=()=>go(t);nav.appendChild(b);});
window.addEventListener('hashchange',()=>go(decodeURIComponent(location.hash.slice(1))));
go(decodeURIComponent(location.hash.slice(1))||'Dashboard');
})();
