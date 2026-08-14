(() => {
  'use strict';
  const DATA = window.NNL_DATA;
  if (!DATA) throw new Error('Dataset not loaded');

  const AUTH_HASH = '09090c74379eedfd5cb1abf8fbcf40f0933937fd4e1a9d5f63982f43a18f304f';
  const detectorHeaders = ['HPGe 동축(p형)','HPGe n형·BEGe','LEGe/평면형','HPGe 우물형','NaI(Tl)','LaBr₃(Ce)','CZT'];
  const suitabilityRank = {'●':3,'◐':2,'✕':1,'':0,null:0,undefined:0};
  const navItems = [
    ['dashboard','▦','개요 대시보드','Overview'],
    ['energy','◎','빠른 에너지 판독','Energy lookup'],
    ['lines','≡','감마 라인 마스터','Gamma lines'],
    ['detectors','◇','검출기 비교','Detector cards'],
    ['pathways','⇢','발생원·시료 경로','Pathways'],
    ['nongamma','β','비감마 핵종 경로','Non-gamma'],
    ['capture','⌁','화학형 포집사전','Capture dictionary'],
    ['interference','≈','간섭 분석','Interference'],
    ['calculator','ƒ','FWHM 계산기','Resolution'],
    ['workbook','▤','원본 시트 브라우저','Workbook'],
    ['sources','§','출처·주의','Sources']
  ];

  const sheet = (name) => DATA.sheets[name].values;
  const lineSheet = sheet('01_★라인마스터');
  const lineHeaders = lineSheet[3];
  const lines = lineSheet.slice(4).filter(r => r[1] !== null && r[1] !== '').map((r,i) => {
    const o = Object.fromEntries(lineHeaders.map((h,j)=>[h,r[j]]));
    o.__id = i;
    return o;
  });
  const detectorSheet = sheet('03_검출기별_적소카드');
  const detectorCardHeaders = detectorSheet[2];
  const detectors = detectorSheet.slice(3).filter(r=>r[0]).map(r=>Object.fromEntries(detectorCardHeaders.map((h,i)=>[h,r[i]])));
  const nonGammaSheet = sheet('04_비감마_핵종경로');
  const nonGammaHeaders = nonGammaSheet[3];
  const nonGamma = nonGammaSheet.slice(4).filter(r=>r[0]).map(r=>Object.fromEntries(nonGammaHeaders.map((h,i)=>[h,r[i]])));
  const sourcePathSheet = sheet('05_발생원×화학형×시료');
  const sourcePathHeaders = sourcePathSheet[3];
  const sourcePaths = sourcePathSheet.slice(4).filter(r=>r[0]).map(r=>Object.fromEntries(sourcePathHeaders.map((h,i)=>[h,r[i]])));
  const captureSheet = sheet('06_화학형태_포집사전');
  const captureHeaders = captureSheet[2];
  const captures = captureSheet.slice(3).filter(r=>r[0]).map(r=>Object.fromEntries(captureHeaders.map((h,i)=>[h,r[i]])));
  const interferenceSheet = sheet('07_에너지_간섭맵');
  const interferenceHeaders = interferenceSheet[6];
  const interferences = interferenceSheet.slice(7).filter(r=>r[0]!==null && r[0]!=='' && r[2]!==null).map(r=>Object.fromEntries(interferenceHeaders.map((h,i)=>[h,r[i]])));
  const sampleSheet = sheet('09_시료별_1순위검출기');
  const sampleHeaders = sampleSheet[2];
  const samples = sampleSheet.slice(3).filter(r=>r[0]).map(r=>Object.fromEntries(sampleHeaders.map((h,i)=>[h,r[i]])));

  const state = {
    view: location.hash.replace('#/','') || 'dashboard',
    theme: localStorage.getItem('nnl-theme') || 'light',
    favorites: new Set(JSON.parse(localStorage.getItem('nnl-favorites') || '[]')),
    lineSort: ['Eγ (keV)','asc'], linePage: 1, linePageSize: Number(localStorage.getItem('nnl-pagesize') || 25),
    detectorSelection: new Set(), pathwayTab:'source', workbookFormulas:false
  };

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt = (v, digits=3) => typeof v === 'number' ? v.toLocaleString('ko-KR',{maximumFractionDigits:digits}) : (v ?? '');
  const text = (v) => String(v ?? '').toLowerCase();
  const lineId = (r) => `${r['핵종']}|${r['Eγ (keV)']}`;
  const badge = (v) => `<span class="badge ${v==='●'?'good':v==='◐'?'mid':v==='✕'?'bad':'neutral'}">${esc(v||'—')}</span>`;
  const saveFavorites = () => localStorage.setItem('nnl-favorites', JSON.stringify([...state.favorites]));
  const download = (name, content, type='text/csv;charset=utf-8') => { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click(); URL.revokeObjectURL(a.href); };
  const toCsv = (headers, rows) => '\ufeff' + [headers, ...rows].map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');

  function applyTheme(){ document.documentElement.dataset.theme=state.theme; localStorage.setItem('nnl-theme',state.theme); }
  function buildNav(){
    $('#nav').innerHTML = navItems.map(([id,icon,label])=>`<button class="nav-btn ${state.view===id?'active':''}" data-view="${id}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`).join('');
    $$('.nav-btn').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view)));
  }
  function navigate(id){ state.view=id; location.hash=`#/${id}`; $('#sidebar').classList.remove('open'); render(); }
  function setHeading(){ const item=navItems.find(x=>x[0]===state.view) || navItems[0]; $('#viewTitle').textContent=item[2]; $('#viewEyebrow').textContent=item[3]; }

  function sectionHead(title, sub, actions='') { return `<div class="section-head"><div><h3>${esc(title)}</h3><p>${esc(sub)}</p></div><div class="section-actions">${actions}</div></div>`; }
  function kpi(label,value,sub=''){return `<div class="kpi"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`;}

  function render(){
    setHeading(); buildNav();
    const view=$('#view');
    const routes={dashboard:renderDashboard,energy:renderEnergy,lines:renderLines,detectors:renderDetectors,pathways:renderPathways,nongamma:renderNonGamma,capture:renderCapture,interference:renderInterference,calculator:renderCalculator,workbook:renderWorkbook,sources:renderSources};
    (routes[state.view]||renderDashboard)(view);
    $('#globalResults').hidden=true;
  }

  function renderDashboard(root){
    const uniqueNuclides = new Set(lines.map(r=>r['핵종']));
    const energies=lines.map(r=>Number(r['Eγ (keV)']));
    root.innerHTML = `
      ${sectionHead('핵종 판독 워크스페이스','에너지, 핵종, 발생원, 화학형, 시료와 검출기 적합성을 한 흐름에서 탐색합니다.')}
      <div class="kpi-grid">
        ${kpi('감마 라인',lines.length,'01 라인마스터')}
        ${kpi('고유 핵종',uniqueNuclides.size,'감마 라인 기준')}
        ${kpi('에너지 범위',`${fmt(Math.min(...energies))}–${fmt(Math.max(...energies),0)} keV`,'원본 데이터')}
        ${kpi('검출기 카드',detectors.length,'03 적소카드')}
        ${kpi('비감마 경로',nonGamma.length,'04 측정경로')}
        ${kpi('원본 시트',Object.keys(DATA.sheets).length,'수식 포함')}
      </div>
      <div class="panel" style="margin-bottom:14px">
        <h4>빠른 에너지 판독</h4>
        <p class="panel-sub">관심 피크의 에너지와 허용 오차를 입력하면 가까운 감마선 후보를 찾습니다.</p>
        <form id="dashQuick" class="quick-form">
          <label class="field"><span>관심 에너지 (keV)</span><input id="dashE" type="number" step="0.001" value="661.657" required></label>
          <label class="field"><span>허용 오차 ±keV</span><input id="dashTol" type="number" step="0.1" value="3" min="0" required></label>
          <label class="field"><span>검출기</span><select id="dashDet"><option value="">전체 검출기</option>${detectorHeaders.map(d=>`<option>${esc(d)}</option>`).join('')}</select></label>
          <button class="btn primary" type="submit">후보 찾기</button>
        </form>
        <div id="dashResults" style="margin-top:12px"></div>
      </div>
      <div class="grid-2">
        <div class="panel"><h4>검출기별 ● 라인 수</h4><p class="panel-sub">라인마스터의 에너지창 적합성 기준</p><div class="canvas-wrap"><canvas id="detectorChart"></canvas></div></div>
        <div class="panel"><h4>에너지 대역 분포</h4><p class="panel-sub">감마 라인 수 기준</p><div class="canvas-wrap"><canvas id="bandChart"></canvas></div></div>
      </div>
      <div class="callout warn" style="margin-top:14px">●/◐/✕ 표시는 에너지창 적합성 참고입니다. 최종 핵종 동정에는 분해능, 효율, 간섭, 계수통계, MDA, 시료 기하와 실제 교정값을 함께 확인해야 합니다.</div>`;
    $('#dashQuick').addEventListener('submit',e=>{e.preventDefault(); dashboardLookup();});
    dashboardLookup(); drawDashboardCharts();
  }

  function energyCandidates(E,tol,det,onlyStrong=false){
    return lines.map(r=>({...r,__delta:Math.abs(Number(r['Eγ (keV)'])-E)}))
      .filter(r=>r.__delta<=tol && (!onlyStrong || !det || r[det]==='●'))
      .sort((a,b)=>a.__delta-b.__delta || (suitabilityRank[b[det]]||0)-(suitabilityRank[a[det]]||0) || Number(b['pγ (%)']||0)-Number(a['pγ (%)']||0));
  }
  function dashboardLookup(){
    const E=Number($('#dashE').value), tol=Number($('#dashTol').value), det=$('#dashDet').value;
    const res=energyCandidates(E,tol,det).slice(0,6); $('#dashResults').innerHTML=res.length?res.map(r=>resultCard(r,det)).join(''):`<div class="empty">±${fmt(tol)} keV 범위에 후보가 없습니다.</div>`; attachResultActions($('#dashResults'));
  }
  function resultCard(r,det=''){
    const id=lineId(r), fav=state.favorites.has(id), fit=det?r[det]:'';
    return `<article class="result-card" data-line-id="${r.__id}"><div class="result-energy">${fmt(r['Eγ (keV)'])}<small>keV · Δ ${fmt(r.__delta||0)} keV</small></div><div><h4>${esc(r['핵종'])} ${det?badge(fit):''}</h4><p>${esc(r['발생원 대분류'])} · ${esc(r['화학형태 (방출·이동 형태)'])}</p><div class="meta-chips"><span class="chip">T½ ${esc(r['T½'])}</span><span class="chip">pγ ${fmt(r['pγ (%)'])}%</span><span class="chip">${esc(r['주 시료 · 채취매체'])}</span></div></div><button class="star-btn ${fav?'active':''}" data-fav="${esc(id)}" title="즐겨찾기">★</button></article>`;
  }
  function attachResultActions(root){
    $$('.result-card',root).forEach(c=>c.addEventListener('click',e=>{if(e.target.closest('[data-fav]'))return; openLine(Number(c.dataset.lineId));}));
    $$('[data-fav]',root).forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();toggleFavorite(b.dataset.fav,b);}));
  }
  function toggleFavorite(id,btn){ state.favorites.has(id)?state.favorites.delete(id):state.favorites.add(id); saveFavorites(); if(btn)btn.classList.toggle('active',state.favorites.has(id)); }

  function drawBars(canvas, labels, vals){
    const ctx=canvas.getContext('2d'), rect=canvas.getBoundingClientRect(), dpr=devicePixelRatio||1; canvas.width=rect.width*dpr; canvas.height=rect.height*dpr; ctx.scale(dpr,dpr); const w=rect.width,h=rect.height;
    const css=getComputedStyle(document.documentElement), textC=css.getPropertyValue('--muted').trim(), accent=css.getPropertyValue('--accent').trim(), border=css.getPropertyValue('--border').trim();
    ctx.clearRect(0,0,w,h); const pad={l:48,r:12,t:10,b:50}, max=Math.max(...vals,1), plotW=w-pad.l-pad.r, plotH=h-pad.t-pad.b, bw=plotW/vals.length*.62;
    ctx.strokeStyle=border; ctx.fillStyle=textC; ctx.font='11px sans-serif'; ctx.textAlign='right';
    for(let i=0;i<=4;i++){const y=pad.t+plotH*(i/4), val=Math.round(max*(1-i/4));ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(val,pad.l-7,y+4)}
    vals.forEach((v,i)=>{const x=pad.l+(i+.5)*plotW/vals.length-bw/2, bh=plotH*v/max,y=pad.t+plotH-bh;ctx.fillStyle=accent;ctx.fillRect(x,y,bw,bh);ctx.save();ctx.translate(x+bw/2,h-pad.b+8);ctx.rotate(-.45);ctx.fillStyle=textC;ctx.textAlign='right';ctx.fillText(labels[i].replace('HPGe ','').replace('(p형)',''),0,0);ctx.restore();});
  }
  function drawDashboardCharts(){
    const dVals=detectorHeaders.map(d=>lines.filter(r=>r[d]==='●').length); drawBars($('#detectorChart'),detectorHeaders,dVals);
    const bands=[...new Set(lines.map(r=>r['에너지대역']))], bVals=bands.map(b=>lines.filter(r=>r['에너지대역']===b).length); drawBars($('#bandChart'),bands,bVals);
  }

  function renderEnergy(root){
    root.innerHTML=`${sectionHead('빠른 에너지 판독','에너지 근접도와 선택 검출기 적합성을 함께 사용해 후보를 정렬합니다.')}
      <div class="panel"><form id="energyForm" class="quick-form"><label class="field"><span>관심 에너지 (keV)</span><input id="energyE" type="number" step="0.001" value="364.489" required></label><label class="field"><span>허용 오차 ±keV</span><input id="energyTol" type="number" step="0.1" value="5" min="0"></label><label class="field"><span>검출기</span><select id="energyDet"><option value="">전체</option>${detectorHeaders.map(d=>`<option>${esc(d)}</option>`).join('')}</select></label><button class="btn primary">판독</button></form><label class="checkbox-row" style="margin-top:10px"><input id="onlyStrong" type="checkbox"> 선택 검출기에서 ●인 라인만 표시</label></div><div id="energySummary" class="table-meta"></div><div id="energyResults" class="result-list"></div>`;
    const run=()=>{const E=Number($('#energyE').value),tol=Number($('#energyTol').value),det=$('#energyDet').value,strong=$('#onlyStrong').checked,res=energyCandidates(E,tol,det,strong);$('#energySummary').innerHTML=`<span>${res.length}개 후보 · ${fmt(E)} ± ${fmt(tol)} keV</span><span>거리순 → 적합성 → pγ 순</span>`;$('#energyResults').innerHTML=res.length?res.map(r=>resultCard(r,det)).join(''):'<div class="empty">조건에 맞는 후보가 없습니다.</div>';attachResultActions($('#energyResults'));};
    $('#energyForm').addEventListener('submit',e=>{e.preventDefault();run()}); $('#onlyStrong').addEventListener('change',run); run();
  }

  function renderLines(root){
    const nuclides=[...new Set(lines.map(r=>r['핵종']))].sort(); const bands=[...new Set(lines.map(r=>r['에너지대역']))];
    root.innerHTML=`${sectionHead('감마 라인 마스터','원본 01 시트의 88개 감마선을 다중 필터·정렬합니다.','<button id="exportLines" class="btn small">CSV 내보내기</button>')}
    <div class="filter-bar"><input id="lfText" type="search" placeholder="핵종, 발생원, 화학형, 시료, 주의 검색"><select id="lfNuclide"><option value="">전체 핵종</option>${nuclides.map(n=>`<option>${esc(n)}</option>`).join('')}</select><select id="lfBand"><option value="">전체 에너지대역</option>${bands.map(b=>`<option>${esc(b)}</option>`).join('')}</select><select id="lfDetector"><option value="">전체 검출기</option>${detectorHeaders.map(d=>`<option>${esc(d)}</option>`).join('')}</select><select id="lfFit"><option value="">적합성 전체</option><option>●</option><option>◐</option><option>✕</option></select><input id="lfMin" type="number" placeholder="최소 keV"><input id="lfMax" type="number" placeholder="최대 keV"></div>
    <div id="lineMeta" class="table-meta"></div><div id="lineTable"></div>`;
    ['lfText','lfNuclide','lfBand','lfDetector','lfFit','lfMin','lfMax'].forEach(id=>$('#'+id).addEventListener(id==='lfText'?'input':'change',()=>{state.linePage=1;drawLineTable()}));
    $('#exportLines').addEventListener('click',()=>exportLineRows(getFilteredLines())); drawLineTable();
  }
  function getFilteredLines(){
    const q=text($('#lfText')?.value),n=$('#lfNuclide')?.value||'',b=$('#lfBand')?.value||'',d=$('#lfDetector')?.value||'',fit=$('#lfFit')?.value||'',min=Number($('#lfMin')?.value||-Infinity),max=Number($('#lfMax')?.value||Infinity);
    let out=lines.filter(r=>!q || [r['핵종'],r['발생원 대분류'],r['구체 발생원 / 생성경로'],r['화학형태 (방출·이동 형태)'],r['주 시료 · 채취매체'],r['간섭 · 주의']].some(v=>text(v).includes(q))).filter(r=>!n||r['핵종']===n).filter(r=>!b||r['에너지대역']===b).filter(r=>Number(r['Eγ (keV)'])>=min&&Number(r['Eγ (keV)'])<=max).filter(r=>!d||!fit||r[d]===fit);
    if(d&&!fit) out=out.filter(r=>r[d] && r[d]!=='✕');
    const [col,dir]=state.lineSort; out.sort((a,b)=>{let av=a[col],bv=b[col]; if(typeof av==='number'&&typeof bv==='number')return(dir==='asc'?1:-1)*(av-bv); return(dir==='asc'?1:-1)*String(av??'').localeCompare(String(bv??''),'ko');}); return out;
  }
  const lineCols=['Eγ (keV)','핵종','T½','pγ (%)','발생원 대분류','화학형태 (방출·이동 형태)','주 시료 · 채취매체'];
  function drawLineTable(){
    const rows=getFilteredLines(), total=rows.length, pages=Math.max(1,Math.ceil(total/state.linePageSize)); state.linePage=Math.min(state.linePage,pages); const start=(state.linePage-1)*state.linePageSize, pageRows=rows.slice(start,start+state.linePageSize), det=$('#lfDetector')?.value; const cols=det?[...lineCols,det,'간섭 · 주의']:lineCols;
    $('#lineMeta').innerHTML=`<span>${total}개 결과 · ${start+1}-${Math.min(start+state.linePageSize,total)}</span><div class="pager"><label>페이지 크기 <select id="linePageSize" style="width:auto;padding:5px 7px"><option ${state.linePageSize===15?'selected':''}>15</option><option ${state.linePageSize===25?'selected':''}>25</option><option ${state.linePageSize===50?'selected':''}>50</option><option ${state.linePageSize===100?'selected':''}>100</option></select></label><button id="prevPage">←</button><span>${state.linePage}/${pages}</span><button id="nextPage">→</button></div>`;
    $('#lineTable').innerHTML=`<div class="table-wrap"><table><thead><tr><th>★</th>${cols.map(c=>`<th><button class="sort-btn" data-sort="${esc(c)}">${esc(c)} ${state.lineSort[0]===c?(state.lineSort[1]==='asc'?'↑':'↓'):''}</button></th>`).join('')}</tr></thead><tbody>${pageRows.map(r=>`<tr data-row="${r.__id}"><td><button class="star-btn ${state.favorites.has(lineId(r))?'active':''}" data-fav="${esc(lineId(r))}">★</button></td>${cols.map(c=>`<td class="${typeof r[c]==='number'?'num':''}">${det&&c===det?badge(r[c]):esc(fmt(r[c]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    $('#linePageSize').addEventListener('change',e=>{state.linePageSize=Number(e.target.value);localStorage.setItem('nnl-pagesize',state.linePageSize);state.linePage=1;drawLineTable()}); $('#prevPage').onclick=()=>{if(state.linePage>1){state.linePage--;drawLineTable()}};$('#nextPage').onclick=()=>{if(state.linePage<pages){state.linePage++;drawLineTable()}};
    $$('[data-sort]').forEach(b=>b.onclick=()=>{state.lineSort=state.lineSort[0]===b.dataset.sort?[b.dataset.sort,state.lineSort[1]==='asc'?'desc':'asc']:[b.dataset.sort,'asc'];drawLineTable()});
    $$('#lineTable tbody tr').forEach(tr=>tr.addEventListener('click',e=>{if(e.target.closest('[data-fav]'))return;openLine(Number(tr.dataset.row))})); $$('[data-fav]',$('#lineTable')).forEach(b=>b.onclick=e=>{e.stopPropagation();toggleFavorite(b.dataset.fav,b)});
  }
  function exportLineRows(rows){ const headers=lineHeaders.filter(Boolean); download('NatureNuclideLibrary_filtered_lines.csv',toCsv(headers,rows.map(r=>headers.map(h=>r[h])))); }

  function renderDetectors(root){
    root.innerHTML=`${sectionHead('검출기 비교','실용 에너지창, 분해능, 대표 핵종, 놓치는 대상과 핵심 한계를 비교합니다.')}
    <div class="callout" style="margin-bottom:12px">카드의 체크박스로 최대 3개 검출기를 선택하면 아래에 항목별 비교표가 생성됩니다.</div><div id="detectorCards" class="card-grid">${detectors.map((d,i)=>`<article class="info-card" data-detcard="${i}"><div class="card-select"><h4>${esc(d['검출기'])}</h4><input type="checkbox" data-detselect="${i}" aria-label="${esc(d['검출기'])} 비교 선택"></div><dl>${detectorCardHeaders.slice(1).map(h=>`<dt>${esc(h)}</dt><dd>${esc(d[h])}</dd>`).join('')}</dl></article>`).join('')}</div><div id="detCompare" style="margin-top:14px"></div>`;
    $$('[data-detselect]').forEach(c=>c.addEventListener('change',()=>{const i=Number(c.dataset.detselect);if(c.checked&&state.detectorSelection.size>=3){c.checked=false;alert('최대 3개까지 비교할 수 있습니다.');return;}c.checked?state.detectorSelection.add(i):state.detectorSelection.delete(i);drawDetectorCompare();})); drawDetectorCompare();
  }
  function drawDetectorCompare(){ if(!$('#detCompare'))return; $$('[data-detcard]').forEach((c,i)=>c.classList.toggle('selected',state.detectorSelection.has(i))); const sel=[...state.detectorSelection].map(i=>detectors[i]); if(!sel.length){$('#detCompare').innerHTML='';return;} $('#detCompare').innerHTML=`${sectionHead('선택 검출기 비교',`${sel.length}개 선택`)}<div class="table-wrap"><table><thead><tr><th>항목</th>${sel.map(d=>`<th>${esc(d['검출기'])}</th>`).join('')}</tr></thead><tbody>${detectorCardHeaders.slice(1).map(h=>`<tr><th>${esc(h)}</th>${sel.map(d=>`<td>${esc(d[h])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }

  function renderPathways(root){
    root.innerHTML=`${sectionHead('발생원·시료 경로','검출 결과를 발생원–화학형–시료–검출기 연결 구조로 해석합니다.')}<div class="tabs"><button class="tab-btn ${state.pathwayTab==='source'?'active':''}" data-tab="source">발생원 → 시료</button><button class="tab-btn ${state.pathwayTab==='sample'?'active':''}" data-tab="sample">시료 → 검출기</button></div><div class="filter-bar compact"><input id="pathSearch" type="search" placeholder="핵종, 발생원, 화학형, 시료, 검출기 검색"><div></div><div></div><button id="pathExport" class="btn">CSV 내보내기</button></div><div id="pathTable"></div>`;
    $$('[data-tab]').forEach(b=>b.onclick=()=>{state.pathwayTab=b.dataset.tab;renderPathways(root)}); $('#pathSearch').addEventListener('input',drawPathTable); $('#pathExport').onclick=()=>exportGenericPath(); drawPathTable();
  }
  function pathData(){return state.pathwayTab==='source'?[sourcePathHeaders,sourcePaths]:[sampleHeaders,samples]}
  function drawPathTable(){const [headers,rows]=pathData(),q=text($('#pathSearch').value),f=rows.filter(r=>!q||headers.some(h=>text(r[h]).includes(q))); $('#pathTable').innerHTML=genericTable(headers,f); $('#pathExport').dataset.count=f.length;}
  function exportGenericPath(){const [headers,rows]=pathData(),q=text($('#pathSearch').value),f=rows.filter(r=>!q||headers.some(h=>text(r[h]).includes(q)));download(`NatureNuclideLibrary_${state.pathwayTab}_pathways.csv`,toCsv(headers,f.map(r=>headers.map(h=>r[h]))));}

  function renderNonGamma(root){ root.innerHTML=`${sectionHead('비감마 핵종 경로','감마 스펙트럼만으로 직접 판독하기 어려운 핵종의 전처리와 검출경로입니다.','<button id="ngExport" class="btn small">CSV 내보내기</button>')}<div class="callout warn" style="margin-bottom:12px">이 표의 핵종을 감마 라이브러리에 넣고 단순히 “미검출”로 보고하면 측정원리 자체가 맞지 않을 수 있습니다.</div><div class="filter-bar compact"><input id="ngSearch" type="search" placeholder="핵종, 화학형, 시료, 전처리, 검출기 검색"><div></div><div></div><div></div></div><div id="ngTable"></div>`; const draw=()=>{const q=text($('#ngSearch').value),f=nonGamma.filter(r=>!q||nonGammaHeaders.some(h=>text(r[h]).includes(q)));$('#ngTable').innerHTML=genericTable(nonGammaHeaders,f)};$('#ngSearch').oninput=draw;$('#ngExport').onclick=()=>download('NatureNuclideLibrary_non_gamma.csv',toCsv(nonGammaHeaders,nonGamma.map(r=>nonGammaHeaders.map(h=>r[h]))));draw(); }
  function renderCapture(root){ root.innerHTML=`${sectionHead('화학형 포집사전','화학형태에 맞는 포집 매체와 사용할 수 없는 매체, 후속 검출기 및 QC를 함께 봅니다.')}<div class="filter-bar compact"><input id="capSearch" type="search" placeholder="희가스, 요오드, CsI, 에어로졸 등 검색"><div></div><div></div><div></div></div><div id="capTable"></div>`;const draw=()=>{const q=text($('#capSearch').value),f=captures.filter(r=>!q||captureHeaders.some(h=>text(r[h]).includes(q)));$('#capTable').innerHTML=genericTable(captureHeaders,f)};$('#capSearch').oninput=draw;draw();}
  function genericTable(headers, rows){return `<div class="table-meta"><span>${rows.length}개 결과</span></div><div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${headers.map(h=>`<td class="${typeof r[h]==='number'?'num':''}">${esc(fmt(r[h]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}

  function renderInterference(root){
    root.innerHTML=`${sectionHead('간섭 분석','원본 인접선 간섭맵과 사용자 지정 두 에너지의 분리도를 함께 확인합니다.')}
    <div class="grid-2" style="margin-bottom:14px"><div class="panel"><h4>사용자 분리도 계산</h4><div class="calc-inputs"><label class="field"><span>첫 번째 에너지 E1 (keV)</span><input id="intE1" type="number" step="0.001" value="185.720"></label><label class="field"><span>두 번째 에너지 E2 (keV)</span><input id="intE2" type="number" step="0.001" value="186.211"></label><label class="field"><span>NaI R662 (%)</span><input id="intNai" type="number" step="0.1" value="7"></label><label class="field"><span>LaBr3 R662 (%)</span><input id="intLabr" type="number" step="0.1" value="3"></label></div></div><div class="panel"><h4>결과</h4><div id="intCalc"></div></div></div>
    <div class="formula-box" style="margin-bottom:12px">HPGe: FWHM = √(0.36 + 0.0025·E)   |   Scintillator: FWHM = (R662/100)·√(662·E)   |   R = ΔE/FWHM</div>
    <div class="filter-bar compact"><input id="intSearch" type="search" placeholder="핵종 또는 간섭 주의 검색"><div></div><div></div><div></div></div><div id="intTable"></div>`;
    const calc=()=>{const e1=Number($('#intE1').value),e2=Number($('#intE2').value),e=(e1+e2)/2,de=Math.abs(e2-e1),n=Number($('#intNai').value),l=Number($('#intLabr').value),hp=Math.sqrt(.36+.0025*e),nai=n/100*Math.sqrt(662*e),lab=l/100*Math.sqrt(662*e);$('#intCalc').innerHTML=`<div class="metric-row">${metric('ΔE',`${fmt(de)} keV`)}${metric('R · HPGe',fmt(de/hp),resolveLabel(de/hp))}${metric('R · NaI',fmt(de/nai),resolveLabel(de/nai))}${metric('R · LaBr₃',fmt(de/lab),resolveLabel(de/lab))}</div><div class="callout" style="margin-top:12px">평균 에너지 ${fmt(e)} keV에서 계산. 실제 피크 강도비와 계수통계는 별도 고려가 필요합니다.</div>`};['intE1','intE2','intNai','intLabr'].forEach(id=>$('#'+id).oninput=calc);calc(); const draw=()=>{const q=text($('#intSearch').value),f=interferences.filter(r=>!q||interferenceHeaders.some(h=>text(r[h]).includes(q)));$('#intTable').innerHTML=genericTable(interferenceHeaders,f)};$('#intSearch').oninput=draw;draw();
  }
  function metric(k,v,s=''){return `<div class="metric"><span>${esc(k)}</span><strong>${esc(v)}</strong>${s?`<span>${esc(s)}</span>`:''}</div>`} function resolveLabel(r){return r>=2?'완전 분해':r>=1?'부분 분해':r>=.5?'어깨 수준':'분해 곤란'}

  function renderCalculator(root){
    root.innerHTML=`${sectionHead('FWHM·분해능 계산기','원본 08 시트의 모델을 웹에서 직접 조정합니다.')}
    <div class="calc-grid"><div class="panel"><h4>입력</h4><div class="calc-inputs"><label class="field"><span>관심 에너지 E (keV)</span><input id="cE" type="number" step="0.001" value="661.657"></label><label class="field"><span>이웃 라인 ΔE (keV)</span><input id="cDE" type="number" step="0.001" value="52.339"></label><label class="field"><span>강도비 ρ (약한선/강한선)</span><input id="cRho" type="number" step="0.01" min="0.0001" value="1"></label><label class="field"><span>HPGe a (keV²)</span><input id="cA" type="number" step="0.01" value="0.36"></label><label class="field"><span>HPGe b (keV)</span><input id="cB" type="number" step="0.0001" value="0.0025"></label><label class="field"><span>NaI R662 (%)</span><input id="cNai" type="number" step="0.1" value="7"></label><label class="field"><span>LaBr₃ R662 (%)</span><input id="cLab" type="number" step="0.1" value="3"></label></div></div><div class="panel"><h4>계산 결과</h4><div id="calcResults"></div></div></div>`;
    const run=()=>{const E=Number($('#cE').value),de=Math.abs(Number($('#cDE').value)),rho=Math.max(.000001,Number($('#cRho').value)),a=Number($('#cA').value),b=Number($('#cB').value),nr=Number($('#cNai').value),lr=Number($('#cLab').value),need=Math.max(1,Math.sqrt(Math.log2(1/rho))), models=[['HPGe',Math.sqrt(a+b*E)],['NaI(Tl)',nr/100*Math.sqrt(662*E)],['LaBr₃(Ce)',lr/100*Math.sqrt(662*E)]]; $('#calcResults').innerHTML=`<div class="formula-box">HPGe FWHM = √(a+bE)\nScintillator FWHM = (R662/100)·√(662E)\nR = ΔE/FWHM\nρ 보정 필요 R = max(1, √log₂(1/ρ)) = ${fmt(need)}</div><div class="table-wrap" style="margin-top:12px;max-height:none"><table><thead><tr><th>검출기</th><th>FWHM (keV)</th><th>상대분해능 (%)</th><th>R</th><th>기하 판정</th><th>ρ 반영</th></tr></thead><tbody>${models.map(([n,f])=>{const R=de/f;return`<tr><td>${n}</td><td class="num">${fmt(f)}</td><td class="num">${fmt(f/E*100)}</td><td class="num">${fmt(R)}</td><td>${esc(resolveLabel(R))}</td><td>${R>=need?badge('●'):badge('✕')} ${R>=need?'OK':'부족'}</td></tr>`}).join('')}</tbody></table></div><div class="callout warn" style="margin-top:12px">신틸레이터의 √E 스케일링은 근사이며, 실제 검출기의 에너지별 FWHM 교정곡선으로 대체하는 것이 바람직합니다.</div>`}; ['cE','cDE','cRho','cA','cB','cNai','cLab'].forEach(id=>$('#'+id).oninput=run);run();
  }

  function renderWorkbook(root){
    const names=Object.keys(DATA.sheets); root.innerHTML=`${sectionHead('원본 시트 브라우저','Excel의 계산값과 원본 수식을 모두 확인할 수 있습니다.')}<div class="sheet-toolbar"><select id="sheetSelect">${names.map(n=>`<option>${esc(n)}</option>`).join('')}</select><input id="sheetSearch" type="search" placeholder="현재 시트 전체 검색"><label class="checkbox-row"><input id="formulaToggle" type="checkbox" ${state.workbookFormulas?'checked':''}> Excel 수식 표시</label><button id="sheetExport" class="btn">현재 시트 CSV</button></div><div id="sheetMeta" class="table-meta"></div><div id="sheetTable"></div>`;
    const draw=()=>{const name=$('#sheetSelect').value,q=text($('#sheetSearch').value),obj=DATA.sheets[name],values=obj.values,forms=obj.formulas,cols=Math.max(...values.map(r=>r.length)), rows=values.map((r,ri)=>({ri,r})).filter(({r})=>!q||r.some(v=>text(v).includes(q))); $('#sheetMeta').innerHTML=`<span>${esc(name)} · ${esc(obj.range)} · ${rows.length}/${values.length}행</span><span>${state.workbookFormulas?'수식 우선 표시':'계산값 표시'}</span>`; const letters=Array.from({length:cols},(_,i)=>colLetter(i)); $('#sheetTable').innerHTML=`<div class="table-wrap"><table><thead><tr><th>#</th>${letters.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(({ri,r})=>`<tr><th>${ri+1}</th>${letters.map((_,ci)=>{const f=forms?.[ri]?.[ci],v=r?.[ci],show=state.workbookFormulas&&f?f:v;return`<td class="${state.workbookFormulas&&f?'formula-cell':''}">${esc(fmt(show))}</td>`}).join('')}</tr>`).join('')}</tbody></table></div>`};
    $('#sheetSelect').onchange=draw;$('#sheetSearch').oninput=draw;$('#formulaToggle').onchange=e=>{state.workbookFormulas=e.target.checked;draw()};$('#sheetExport').onclick=()=>{const name=$('#sheetSelect').value,vals=DATA.sheets[name].values;download(`${name}.csv`,toCsv(Array.from({length:Math.max(...vals.map(r=>r.length))},(_,i)=>colLetter(i)),vals))};draw();
  }
  function colLetter(i){let s='';i++;while(i){let m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s}

  function renderSources(root){ const s=sheet('10_출처·주의'); const rows=s.slice(3).filter(r=>r[0]); root.innerHTML=`${sectionHead('출처·주의','원본 데이터북의 출처와 모델 가정, 웹 변환의 추적 정보를 확인합니다.')}<div class="panel" style="margin-bottom:14px"><h4>데이터 추적성</h4><div class="detail-list"><div class="detail-item"><span class="k">원본 파일</span><div class="v">${esc(DATA.meta.sourceFile)}</div></div><div class="detail-item"><span class="k">SHA-256</span><div class="v formula-cell">${esc(DATA.meta.sourceSha256)}</div></div><div class="detail-item"><span class="k">웹 데이터 구조</span><div class="v">${DATA.meta.sheetCount}개 시트 · 계산값 + Excel 수식 보존</div></div></div></div>${genericTable(['항목','내용'],rows.map(r=>({'항목':r[0],'내용':r[1]})))}<div class="callout warn" style="margin-top:14px">본 사이트는 연구·실무 보조용 데이터 탐색 도구입니다. 규제상 최종 판정, 핵종 확정, 검출한계/MDA 판정은 승인된 절차서와 실제 검출기 교정·QC 자료를 우선해야 합니다.</div>`; }

  function openLine(id){ const r=lines.find(x=>x.__id===id); if(!r)return; $('#drawerTitle').textContent=`${r['핵종']} · ${fmt(r['Eγ (keV)'])} keV`; const fields=lineHeaders.slice(0,9).concat(['간섭 · 주의']); $('#drawerBody').innerHTML=`<div class="detector-strip">${detectorHeaders.map(d=>`<div class="detector-pill"><strong>${esc(d)}</strong>${badge(r[d])}</div>`).join('')}</div><div class="detail-list" style="margin-top:18px">${fields.map(h=>`<div class="detail-item"><span class="k">${esc(h)}</span><div class="v">${esc(fmt(r[h]))}</div></div>`).join('')}</div>`; $('#drawerBackdrop').hidden=false; $('#detailDrawer').classList.add('open'); $('#detailDrawer').setAttribute('aria-hidden','false'); }
  function closeDrawer(){ $('#drawerBackdrop').hidden=true; $('#detailDrawer').classList.remove('open'); $('#detailDrawer').setAttribute('aria-hidden','true'); }

  function globalSearch(q){ q=text(q).trim(); if(!q){$('#globalResults').hidden=true;return;} let res=lines.filter(r=>[r['핵종'],r['Eγ (keV)'],r['발생원 대분류'],r['구체 발생원 / 생성경로'],r['화학형태 (방출·이동 형태)'],r['주 시료 · 채취매체']].some(v=>text(v).includes(q))).slice(0,12); $('#globalResults').innerHTML=res.length?res.map(r=>`<div class="global-item" data-gline="${r.__id}"><div class="e">${fmt(r['Eγ (keV)'])} keV</div><div><strong>${esc(r['핵종'])}</strong><div class="d">${esc(r['발생원 대분류'])} · ${esc(r['주 시료 · 채취매체'])}</div></div><div>${badge(r['NaI(Tl)'])}</div></div>`).join(''):'<div class="empty">검색 결과가 없습니다.</div>'; $('#globalResults').hidden=false; $$('[data-gline]').forEach(x=>x.onclick=()=>{openLine(Number(x.dataset.gline));$('#globalResults').hidden=true}); }

  async function sha256(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
  function unlock(){ $('#authGate').style.display='none'; $('#authGate').setAttribute('aria-hidden','true'); $('#app').hidden=false; }
  function initAuth(){ if(sessionStorage.getItem('nnl-auth')==='1'){unlock();return;} $('#authGate').style.display='grid'; $('#authForm').addEventListener('submit',async e=>{e.preventDefault();$('#authError').textContent='';const h=await sha256($('#passwordInput').value);if(h===AUTH_HASH){sessionStorage.setItem('nnl-auth','1');unlock();render();}else{$('#authError').textContent='비밀번호가 일치하지 않습니다.';$('#passwordInput').select();}}); }

  function init(){ applyTheme(); $('#datasetStamp').textContent=`${DATA.meta.sheetCount} sheets · ${lines.length} gamma lines`; buildNav(); $('#themeBtn').onclick=()=>{state.theme=state.theme==='light'?'dark':'light';applyTheme();render()}; $('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open'); $('#drawerClose').onclick=closeDrawer; $('#drawerBackdrop').onclick=closeDrawer; $('#globalSearch').addEventListener('input',e=>globalSearch(e.target.value)); document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeDrawer();$('#globalResults').hidden=true;$('#sidebar').classList.remove('open')} if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();$('#globalSearch').focus()}}); window.addEventListener('hashchange',()=>{state.view=location.hash.replace('#/','')||'dashboard';render()}); window.addEventListener('resize',()=>{if(state.view==='dashboard')drawDashboardCharts()}); initAuth(); if(sessionStorage.getItem('nnl-auth')==='1')render(); }
  init();
})();
