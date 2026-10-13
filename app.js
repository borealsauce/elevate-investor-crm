(function(){
const D = window.CRM, S = D.sheets;
const TABS = ['Dashboard','Investors','Investor Positions','Deals','Commissions','Raise Income','Brokering Income','Brokered RE Transactions','Combined','Pipeline','Activity Log','Year by Year','Reconciliation','Notes'];
const $ = (h)=>{const t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstChild;};
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const money = (v,dec) => (v<0?'-':'')+'$'+Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:dec?2:0,maximumFractionDigits:dec?2:0});
const fmtMoney = v => money(v, Math.round(v)!==v);
const moneyOrDash = v => (v==null||v===''||v===0||(typeof v==='number'&&!Number.isFinite(v))) ? '—' : fmtMoney(v);
/** Count-up like Shep's site: easeOutCubic 1-(1-t)^3 via rAF. Default 1200ms (Shep KPIs use ~3s; panel heroes stay snappy). */
function prefersReducedMotion(){ try{ return matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } }
function countUp(el, target, {duration=1200, decimals=false, prefix='$'}={}){
  if(!el) return;
  const end = Number(target)||0;
  const fmt = v => {
    if(prefix==='$') return money(v, decimals || Math.round(v)!==v);
    return String(Math.round(v));
  };
  if(prefersReducedMotion() || end===0){ el.textContent = fmt(end); return; }
  const t0 = performance.now();
  const ease = t => 1 - Math.pow(1-t, 3);
  const tick = now => {
    const p = Math.min(1, (now-t0)/duration);
    el.textContent = fmt(end * ease(p));
    if(p<1) requestAnimationFrame(tick); else el.textContent = fmt(end);
  };
  el.textContent = fmt(0);
  requestAnimationFrame(tick);
}

const pct = v => (v*100).toLocaleString('en-US',{maximumFractionDigits:2})+'%';
const isPct = h => /RATE|COMM\. %|MARGIN|VS BEST/.test(h);
const isMoney = h => /\$|RAISE|COMMISSION|AMOUNT|INCOME|GAP|BASIS|DIFFERENCE|SHEP SHEET|SCREENSHOT|^20\d\d$|TOTAL RAISED|LIFETIME|INVESTED|SALE PRICE|VOLUME|PRICE/.test(h) && !/YEAR|YR|TAB NAME|NOTE|STATUS|COMMENT|OFFERING\(S\)|PROPERTY TYPE|CONFIDENCE/.test(h);
function fmt(h, v){
  if(v===null||v===undefined||v==='') return '';
  if(typeof v==='number'){ if(isPct(h)) return pct(v); if(isMoney(h)) return fmtMoney(v); return String(v); }
  return esc(v);
}
function badge(v){
  const s=String(v), l=s.toLowerCase();
  let c='b-gray';
  if(/active|committed|credited|closed|brokering|high|sell/.test(l)) c='b-gold';
  if(/past investor|transacted|open|buy|medium/.test(l)) c='b-green';
  if(/not interested|duplicate|low|lease/.test(l)) c='b-red';
  if(l==='low') c='b-warn';
  if(l==='medium') c='b-amber';
  if(l==='high') c='b-green';
  return `<span class="badge ${c}">${esc(s)}</span>`;
}
const BADGE_COLS = /^(STATUS|STAGE|OUTCOME|TYPE|PROGRAM|PROGRAMS|SYNDICATOR|SYNDICATORS|CONFIDENCE|CLIENT SIDE)$/;
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
  const rowHtml=(r,cls='')=>{ const extra=(typeof opts.rowClass==='function'?opts.rowClass(r):'')||''; return `<tr class="${cls} ${extra}">${r.map((v,i)=>{const h=t.header[i];
    const inner = (BADGE_COLS.test(h)&&v&&!cls)? badge(v) : fmt(h,v);
    return `<td class="${numCol[i]?'num':''} ${(opts.wide||WIDE_COLS).test(h)?'wrapc':''}">${inner}</td>`;}).join('')}</tr>`; };
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
    app.appendChild(sec('Income split','Elevate cash · Boa Vida B-share · Brokering'));
    const comb=tables('Combined')[0], ch=comb.header, cix=n=>ch.indexOf(n);
    const years=comb.rows.filter(r=>typeof r[cix('YEAR')]==='number').map(r=>r[cix('YEAR')]).sort((a,b)=>a-b);
    const crow=y=>comb.rows.find(r=>r[cix('YEAR')]==y);
    const num=(r,h)=>{ if(!r) return null; const v=r[cix(h)]; return (typeof v==='number')?v:null; };
    const elevRaise=y=>num(crow(y),'ELEVATE RAISE $');
    const elevCash=y=>num(crow(y),'ELEVATE CASH COMM');
    const bvgRaise=y=>num(crow(y),'BVG RAISE $');
    const bvgShare=y=>num(crow(y),'BVG B-SHARE COMM');
    const brokComm=y=>num(crow(y),'BROKERING COMM');
    const cashTot=y=>num(crow(y),'CASH TOTAL INCOME');
    const grandTot=y=>num(crow(y),'GRAND TOTAL (CASH+B-SHARE)');
    const volAmt=y=>num(crow(y),'VOLUME (NO COMM)');
    const sum=fn=>years.reduce((a,y)=>a+(fn(y)||0),0);

    const totElevRaise=sum(elevRaise), totElevCash=sum(elevCash), totBvgRaise=sum(bvgRaise), totBvgShare=sum(bvgShare);
    const totBrok=sum(brokComm), totCash=sum(cashTot), totGrand=sum(grandTot);
    const totRaised=totElevRaise+totBvgRaise;
    const brt=(tables('Brokered RE Transactions')||[]).find(t=>t.header.includes('SALE PRICE'));
    const totSales=brt?brt.rows.filter(r=>r[0]&&String(r[0]).toUpperCase()!=='TOTAL').reduce((a,r)=>a+(typeof r[brt.header.indexOf('SALE PRICE')]==='number'?r[brt.header.indexOf('SALE PRICE')]:0),0):0;

    const grand=$(`<div class="grand-split">
      <div class="grand-card cash"><div class="eyebrow">Elevate commissions · cash</div><div class="grand-label">ELEVATE RAISE INCOME</div><div class="grand-value" data-count="${totElevCash}" data-dec="1">$0</div></div>
      <div class="grand-card bshare"><div class="eyebrow">Boa Vida Group · non-cash</div><div class="grand-label">BVG B-SHARE TOTAL</div><div class="grand-value" data-count="${totBvgShare}" data-dec="0">$0</div></div>
      <div class="grand-card brok"><div class="eyebrow">All brokering commissions · cash</div><div class="grand-label">AGENT BROKERING INCOME</div><div class="grand-value" data-count="${totBrok}" data-dec="0">$0</div></div>
      <div class="grand-card all"><div class="eyebrow">Elevate + BVG + Brokering</div><div class="grand-label">TOTAL INCOME</div><div class="grand-value" data-count="${totElevCash+totBvgShare+totBrok}" data-dec="1">$0</div></div>
    </div>`);
    app.appendChild(grand);

    const panels=$(`<div class="income-split"></div>`);
    const raise=$(`<div class="panel income-panel raise-panel"><div class="panel-head">
      <div class="eyebrow">Raise commissions</div><h3>RAISE INCOME <span class="h3-total"><span data-count="${totRaised}" data-dec="1">$0</span> RAISED</span></h3>
      <p class="sub">Elevate = cash (2024+) · Boa Vida Group = B shares, non-cash (2020–2023)</p>
      <div class="hero-kpis twin">
        <div class="hero-block elev">
          <div class="hb-title">ELEVATE · CASH</div>
          <div class="hero"><div class="hl">TOTAL RAISED</div><div class="hv" data-count="${totElevRaise}" data-dec="1">$0</div></div>
          <div class="hero"><div class="hl">CASH COMMISSION</div><div class="hv" data-count="${totElevCash}" data-dec="1">$0</div></div>
        </div>
        <div class="hero-block bvg">
          <div class="hb-title">BOA VIDA GROUP · B SHARES</div>
          <div class="hero"><div class="hl">TOTAL RAISED</div><div class="hv" data-count="${totBvgRaise}" data-dec="0">$0</div></div>
          <div class="hero"><div class="hl">B-SHARE COMMISSION</div><div class="hv" data-count="${totBvgShare}" data-dec="0">$0</div></div>
          <div class="hb-note">Paid in B shares · non-cash</div>
        </div>
      </div>
    </div>
      <table class="income-tbl"><thead><tr><th>YEAR</th><th class="num">ELEVATE RAISE</th><th class="num">ELEVATE CASH COMM</th><th class="num">BVG RAISE</th><th class="num">BVG B-SHARE</th></tr></thead><tbody></tbody><tfoot></tfoot></table>
      <div class="bars raise-bars" style="margin-top:14px"></div></div>`);
    const rt=raise.querySelector('tbody'), rtf=raise.querySelector('tfoot'), rb=raise.querySelector('.raise-bars');
    const rMax=Math.max(...years.map(y=>(elevCash(y)||0)+(bvgShare(y)||0)),1);
    years.forEach(y=>{
      rt.appendChild($(`<tr><td>${y}</td><td class="num">${moneyOrDash(elevRaise(y))}</td><td class="num">${moneyOrDash(elevCash(y))}</td><td class="num">${moneyOrDash(bvgRaise(y))}</td><td class="num">${moneyOrDash(bvgShare(y))}</td></tr>`));
      const ec=elevCash(y)||0, bs=bvgShare(y)||0;
      rb.appendChild($(`<div class="bar"><div><div class="yr">${y}</div><div class="prog">comm</div></div><div class="track stacked"><div class="fill raise-fill" style="width:${(ec/rMax*100).toFixed(1)}%"></div><div class="fill bshare-fill" style="width:${(bs/rMax*100).toFixed(1)}%"></div></div><div class="amt">${moneyOrDash((ec+bs)||null)}</div></div>`));
    });
    rtf.appendChild($(`<tr class="total"><td>TOTAL</td><td class="num">${fmtMoney(totElevRaise)}</td><td class="num">${fmtMoney(totElevCash)}</td><td class="num">${fmtMoney(totBvgRaise)}</td><td class="num">${fmtMoney(totBvgShare)}</td></tr>`));
    panels.appendChild(raise);

    const brok=$(`<div class="panel income-panel brok-panel"><div class="panel-head"><div class="eyebrow">Deal commissions · cash</div><h3>BROKERING INCOME <span class="h3-total"><span data-count="${totSales}" data-dec="1">$0</span> IN SALES</span></h3><p class="sub">Commission by year · volume noted separately</p>
      <div class="hero-kpis">
        <div class="hero"><div class="hl">BROKERING COMMISSION</div><div class="hv" data-count="${totBrok}" data-dec="0">$0</div></div>
      </div>
    </div>
      <table class="income-tbl"><thead><tr><th>YEAR</th><th class="num">COMMISSION</th><th class="num">VOLUME (NO COMM)</th></tr></thead><tbody></tbody><tfoot></tfoot></table>
      <div class="bars brok-bars" style="margin-top:14px"></div>
      <p class="sub" style="margin-top:10px">Volume = deals transacted with no brokering commission (2024 only). BVG B-share income is non-cash and shown under Raise.</p></div>`);
    const bt=brok.querySelector('tbody'), btf=brok.querySelector('tfoot'), bb=brok.querySelector('.brok-bars');
    const bMax=Math.max(...years.map(y=>brokComm(y)||0),1);
    years.forEach(y=>{
      const v=volAmt(y);
      bt.appendChild($(`<tr><td>${y}</td><td class="num">${moneyOrDash(brokComm(y))}</td><td class="num">${v?fmtMoney(v):'—'}</td></tr>`));
      bb.appendChild($(`<div class="bar"><div><div class="yr">${y}</div><div class="prog">commission</div></div><div class="track"><div class="fill brok-fill" style="width:${((brokComm(y)||0)/bMax*100).toFixed(1)}%"></div></div><div class="amt">${moneyOrDash(brokComm(y))}</div></div>`));
    });
    btf.appendChild($(`<tr class="total"><td>TOTAL</td><td class="num">${fmtMoney(totBrok)}</td><td class="num">${fmtMoney(sum(y=>volAmt(y)||0))}</td></tr>`));
    panels.appendChild(brok);
    app.appendChild(panels);
    app.querySelectorAll('[data-count]').forEach(el=>{
      const target = Number(el.getAttribute('data-count'));
      const dec = el.getAttribute('data-dec') === '1';
      countUp(el, target, {duration:1200, decimals:dec});
    });

    app.appendChild(sec('Combined','Cash vs B-share by year'));
    const ct=$(`<div class="panel combined-panel"><table class="income-tbl"><thead><tr><th>YEAR</th><th class="num">ELEVATE CASH</th><th class="num">BVG B-SHARE</th><th class="num">BROKERING</th><th class="num">CASH TOTAL</th><th class="num">GRAND (CASH+B)</th></tr></thead><tbody></tbody><tfoot></tfoot></table>
      <div class="bars stacked-bars" style="margin-top:16px"></div></div>`);
    const ctb=ct.querySelector('tbody'), ctf=ct.querySelector('tfoot'), sb=ct.querySelector('.stacked-bars');
    const iMax=Math.max(...years.map(y=>grandTot(y)||0),1);
    years.forEach(y=>{
      ctb.appendChild($(`<tr><td>${y}</td><td class="num">${moneyOrDash(elevCash(y))}</td><td class="num">${moneyOrDash(bvgShare(y))}</td><td class="num">${moneyOrDash(brokComm(y))}</td><td class="num">${moneyOrDash(cashTot(y))}</td><td class="num">${moneyOrDash(grandTot(y))}</td></tr>`));
      const ec=elevCash(y)||0, bs=bvgShare(y)||0, bc=brokComm(y)||0, g=grandTot(y)||0;
      sb.appendChild($(`<div class="bar"><div><div class="yr">${y}</div><div class="prog">stacked</div></div><div class="track stacked"><div class="fill raise-fill" style="width:${(ec/iMax*100).toFixed(1)}%"></div><div class="fill bshare-fill" style="width:${(bs/iMax*100).toFixed(1)}%"></div><div class="fill brok-fill" style="width:${(bc/iMax*100).toFixed(1)}%"></div></div><div class="amt">${moneyOrDash(g||null)}</div></div>`));
    });
    ctf.appendChild($(`<tr class="total"><td>TOTAL</td><td class="num">${fmtMoney(totElevCash)}</td><td class="num">${fmtMoney(totBvgShare)}</td><td class="num">${fmtMoney(totBrok)}</td><td class="num">${fmtMoney(totCash)}</td><td class="num">${fmtMoney(totGrand)}</td></tr>`));
    app.appendChild(ct);
    app.appendChild($(`<div class="legend"><span class="lg raise-lg"></span> Elevate cash &nbsp;&nbsp; <span class="lg bshare-lg"></span> BVG B-share (non-cash) &nbsp;&nbsp; <span class="lg brok-lg"></span> Brokering</div>`));

    app.appendChild(sec('Leaderboard','Investors & follow-ups'));
    const g=$(`<div class="grid2"></div>`);
    const top=tables('Investors')[0].rows.slice().sort((a,b)=>b[1]-a[1]).slice(0,8);
    const left=$(`<div class="panel"><h3>Top investors</h3><table><thead><tr><th>#</th><th>Investor</th><th class="num">Total</th></tr></thead><tbody></tbody></table></div>`);
    top.forEach((r,i)=>left.querySelector('tbody').appendChild($(`<tr><td>${i+1}</td><td>${esc(r[0])}</td><td class="num">${fmtMoney(r[1])}</td></tr>`)));
    g.appendChild(left);
    const fu=tables('Follow-ups')[0];
    const right=$(`<div class="panel"><h3>Follow-ups due</h3><table><thead><tr><th>Who</th><th>When</th><th>Why</th></tr></thead><tbody></tbody></table></div>`);
    fu.rows.slice(0,8).forEach(r=>right.querySelector('tbody').appendChild($(`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[3]||'')}</td></tr>`)));
    g.appendChild(right);
    app.appendChild(g);
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
        const held=mine.filter(r=>r[ix('SYNDICATOR')]!=='Brokering'), brok=mine.filter(r=>r[ix('SYNDICATOR')]==='Brokering');
        const total=held.reduce((a,r)=>a+(r[ix('AMOUNT INVESTED')]||0),0);
        const joint=held.filter(r=>r[ix('INVESTOR')]!==inv||r[ix('JOINT')]).reduce((a,r)=>a+(r[ix('AMOUNT INVESTED')]||0),0);
        const parks=new Set(); held.forEach(r=>{const d=r[ix('DEAL')]; if(r[ix('SYNDICATOR')]==='BoaVida') return; d.split(' & ').filter(x=>/MHC|RV|Park/i.test(x)||!d.includes(' & ')).forEach(x=>parks.add(x.trim()));});
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
    app.appendChild(renderTable(T,{search:'positions',filterCol:'SYNDICATOR',splitTotal:true,wide:/NOTE|^SOURCE$/}));
  },

  'Brokered RE Transactions'(app){
    const bl=S['Brokered RE Transactions']||[];
    const t=bl.find(b=>b.type==='table' && b.header && b.header.some(h=>/DEAL|CLOSING DATE|PROPERTY/i.test(String(h)))) || bl.find(b=>b.type==='table');
    const titles=bl.filter(b=>b.type==='title').map(b=>b.text);
    app.appendChild(sec('Brokered RE','Documented closings · no bank numbers / SSNs', titles[1]||'From brokered_re_deals.csv'));
    if(!t){ app.appendChild($(`<div class="callout">No brokered RE table in data.</div>`)); return; }
    const H=t.header, ix=n=>H.indexOf(n);
    const confI=ix('CONFIDENCE'), priceI=ix('SALE PRICE'), ryanI=ix("RYAN'S COMMISSION");
    const rows=t.rows.filter(r=>r[0] && !/^total/i.test(String(r[0])));
    const num=v=> (typeof v==='number'&&Number.isFinite(v))?v:0;
    const n=rows.length;
    const vol=rows.reduce((a,r)=>a+num(r[priceI]),0);
    const ryan=rows.reduce((a,r)=>a+num(r[ryanI]),0);
    const doc=rows.filter(r=>String(r[confI]||'').toLowerCase()==='high');
    const docRyan=doc.reduce((a,r)=>a+num(r[ryanI]),0);
    const docVol=doc.reduce((a,r)=>a+num(r[priceI]),0);
    const heroes=$(`<div class="grand-split brokered-heroes">
      <div class="grand-card cash"><div class="eyebrow">All deals</div><div class="grand-label">DEALS</div><div class="grand-value" data-count="${n}" data-prefix="">0</div></div>
      <div class="grand-card cash"><div class="eyebrow">Sale / lease value</div><div class="grand-label">TOTAL VOLUME</div><div class="grand-value" data-count="${vol}" data-dec="0">$0</div></div>
      <div class="grand-card all"><div class="eyebrow">All rows</div><div class="grand-label">RYAN COMMISSION</div><div class="grand-value" data-count="${ryan}" data-dec="1">$0</div></div>
      <div class="grand-card bshare"><div class="eyebrow">High confidence · closing / commission docs</div><div class="grand-label">DOCUMENTED · RYAN COMM</div><div class="grand-value" data-count="${docRyan}" data-dec="1">$0</div>
        <div class="hb-note" style="margin-top:6px;opacity:.85">${doc.length} deals · vol ${fmtMoney(docVol)}</div></div>
    </div>`);
    app.appendChild(heroes);
    app.querySelectorAll('[data-count]').forEach(el=>{
      const target=Number(el.getAttribute('data-count'));
      const dec=el.getAttribute('data-dec')==='1';
      const prefix=el.hasAttribute('data-prefix')?'':'$';
      countUp(el, target, {duration:1200, decimals:dec, prefix});
    });
    app.appendChild($(`<p class="sub">Amber rows = low confidence or conflicting source notes. Click column headers to sort. Documented = confidence high (closing statement / CDA / commission invoice).</p>`));
    const conflict=/misprint|does not match|misstates|conflict|not match|duplicate|possible duplicate/i;
    const noteI=ix('NOTES');
    app.appendChild(renderTable({header:H, rows}, {
      search:'brokered deals', filterCol:'CONFIDENCE', splitTotal:true, noMax:true, wide:/NOTE|ADDRESS|CLIENT$/,
      rowClass: r=>{
        const c=String(r[confI]||'').toLowerCase();
        const n=String(r[noteI]||'');
        if(c==='low' || conflict.test(n)) return 'row-warn';
        if(c==='medium') return 'row-warn-soft';
        return '';
      }
    }));
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
