(function () {
  'use strict';
  const C=window.Lotto,KEY='dd-jackpot-demo-v2',root=document.querySelector('#lottery-root'),modalRoot=document.querySelector('#lottery-modal');
  let s,opsTab='experience',modal=null,opsOpen=false,ticketFilter='all',resultFilter='all',resultPage=0,resultSearch='',toastTimer;
  try{s=JSON.parse(localStorage.getItem(KEY));if(s?.version!==2)s=C.create();else {s.config={...C.defaults,...s.config,betTiers:s.config.betTiers||C.defaults.betTiers};Object.values(s.rounds||{}).forEach(r=>{r.config={...C.defaults,...r.config,betTiers:r.config.betTiers||C.defaults.betTiers};});}}catch{s=C.create();}
  const iconPaths={
    back:'m14 5-7 7 7 7',arrow:'M5 12h14m-6-6 6 6-6 6',chevron:'m9 5 7 7-7 7',close:'m6 6 12 12M18 6 6 18',
    ticket:'M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4V5Zm12 0v14',trophy:'M8 3h8v7a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v6m-4 0h8',
    wallet:'M20 8V5H4a2 2 0 0 1 0-4h14v4M4 5a2 2 0 0 0-2 2v13h18V8H4Zm16 4h-6v5h6m-3-2.5h.01',clock:'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    info:'M12 11v6m0-10v.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',check:'m5 12 4 4L19 6',lock:'M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4',
    game:'M8 6h8l4 4 1 8-4 1-3-4h-4l-3 4-4-1 1-8 4-4Zm0 3v5m-2-2h4m6-2h.01m2 3h.01',deposit:'M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6',history:'M3 5v5h5M3 10a9 9 0 1 1 1 8m8-11v6l4 2',
    settings:'M4 7h16M4 17h16M9 4v6m6 4v6',home:'m3 11 9-8 9 8M5 10v11h14V10m-10 11v-7h6v7',shield:'m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Zm-5 10 3 3 7-7',
    list:'M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01',share:'M12 16V2m-5 5 5-5 5 5M5 11H3v11h18V11h-2',refresh:'M20 7v5h-5M4 17v-5h5m11 0a8 8 0 0 0-14-6m-2 6a8 8 0 0 0 14 6',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7'};
  const icon=(name,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[name]||iconPaths.spark}"/></svg>`;
  const esc=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money=n=>'₹'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const whole=n=>'₹'+Number(n).toLocaleString('en-US',{maximumFractionDigits:0});
  const datetime=t=>new Date(t).toISOString().slice(0,16).replace('T',' ');
  const time=t=>new Date(t).toISOString().slice(11,16);
  const dateLabel=date=>new Date(date+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  const datePlus=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*C.DAY).toISOString().slice(0,10);
  const action=(name,text,cls='',extra='')=>`<button type="button" data-action="${name}" class="${cls}" ${extra}>${text}</button>`;
  const previous=()=>Object.values(s.rounds).filter(r=>r.snapshot).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const checked=(arr,v)=>arr.includes(v)?'checked':'';
  function save(){localStorage.setItem(KEY,JSON.stringify(s));}
  function notify(text){clearTimeout(toastTimer);const el=document.querySelector('#lottery-toast');el.className='lotto-toast';el.textContent=text;toastTimer=setTimeout(()=>{el.className='';el.textContent='';},3400);}
  function task(type,title,desc,current,max){
    const r=C.current(s),pending=C.pending(r)[type],isFull=r.claimed[type]>=max;
    const button=pending>0?action('claim-tickets:'+type,`领取 ${pending} 张`,'task-action claim'):action('open-'+(type==='bet'?'bet':'deposit'),isFull?'已达上限':type==='bet'?'去游戏':'去充值','task-action',(!r.active||isFull)?'disabled':'');
    return `<article class="task ${!r.active?'locked':''}"><div class="task-top"><span class="task-icon">${icon(r.active?(type==='bet'?'game':'deposit'):'lock')}</span><div class="task-copy"><h3>${title}</h3><p>${desc}</p></div>${button}</div><div class="task-progress"><div><span>${type==='bet'?'有效投注 '+whole(r.validBet):'单笔最高匹配档位 · 不叠加'}</span><strong>${r.claimed[type]} / ${max} 已领</strong></div><div class="track"><i style="width:${Math.min(100,current/max*100)}%"></i></div></div>${type==='deposit'?`<div class="deposit-tiers">${[...r.config.tiers].sort((a,b)=>a.amount-b.amount).map(t=>`<div class="deposit-tier"><b>+${t.tickets} <em>张</em></b><small>单笔 ≥ ${whole(t.amount)}</small></div>`).join('')}</div>`:''}</article>`;
  }
  function phone(){
    const r=C.current(s),c=r.config,pool=C.pool(r),p=C.pending(r),prev=previous(),wait=prev&&!prev.published&&!prev.expired;
    const end=C.collectEnd(r.date,c),remaining=Math.max(0,end-s.now),hours=Math.floor(remaining/C.HOUR),mins=Math.floor(remaining%C.HOUR/60000);
    const collectRange=`${dateLabel(r.date)} 02:30 – ${dateLabel(datePlus(r.date,1))} 02:25`,settleRange=`${dateLabel(datePlus(r.date,1))} 02:25 – 02:30`,claimRange=`${dateLabel(datePlus(r.date,1))} 02:30 – ${dateLabel(datePlus(r.date,2))} 02:30`;
    return `<div class="phone"><div class="phone-top"><a class="circle-btn" href="index.html" aria-label="返回大厅">${icon('back')}</a><span class="wordmark">GOGO LOTTO</span>${action('wallet',icon('wallet')+whole(s.wallet),'wallet-chip','aria-label="演示钱包"')}${action('ops-open',icon('settings'),'mobile-toolbar-button circle-btn','aria-label="演示控制台"')}</div>
      <div class="round-bar"><b>${esc(r.id)}</b><span>${esc(c.timezone)} · 每日一期</span></div>
      <section class="lotto-hero"><div class="stars"><span>✦</span><span>✧</span><span>✦</span><span>✧</span></div><div class="eyebrow">A LITTLE LUCK. A GRAND REWARD.</div><h1>JACKPOT</h1><p class="hero-sub">D A I L Y　L O T T O</p><div class="jackpot-sign"><div class="sign-inner"><div class="pool-label">本期实时预估奖池 ${action('pool',icon('info'),'','aria-label="奖池说明"')}</div><div class="pool-value"><span class="currency">₹</span>${pool.total.toLocaleString('en-US',{maximumFractionDigits:0})}</div><div class="pool-change">每一份参与，汇聚更多惊喜</div></div><span class="coin coin-one">₹</span><span class="coin coin-two">₹</span></div><p class="hero-caption">每张奖券一次机会 · <b>同用户多张券可中多个奖</b></p></section>
      <div class="phone-content"><div class="timeline"><div class="time-step active"><i></i><b>收集奖券</b><small>${collectRange}</small></div><div class="time-step"><i></i><b>结算开奖</b><small>${settleRange} · 5 分钟</small></div><div class="time-step"><i></i><b>手动领奖</b><small>${claimRange}</small></div></div>
      ${wait?`<div class="phase-banner">${icon('clock',prev.hold?'':'spinner')}<div><b>上一期${prev.hold?'结算延迟，核对中':'正在结算'}</b><small>${prev.id} · ${prev.hold?'结果核对完成后公布，暂不发奖':'02:30 公布结果；新一期将在 02:30 开始收集'}</small></div>${action('results:'+prev.date,'查看','task-action')}</div>`:prev?.published&&!prev.expired?`<div class="phase-banner">${icon('trophy')}<div><b>${prev.result.my?'上一期你已中奖 · '+money(prev.result.my.amount):'上一期开奖结果已公布'}</b><small>${prev.id} · ${prev.claimedPrize?'奖金已领取':prev.result.my?'请于次日 02:30 前手动领取':'查看完整中奖名单'}</small></div>${action('results:'+prev.date,prev.result.my&&!prev.claimedPrize?'领奖':'查看','task-action '+(prev.result.my&&!prev.claimedPrize?'claim':''))}</div>`:''}
      ${action('tickets',`<span class="ticket-glyph">✦</span><div><strong>我的奖券<span class="ticket-count">${r.tickets.length}/${c.ticketCap}</span></strong><small>${p.bet+p.deposit?`${p.bet+p.deposit} 张待领取 · 仅已领券参与开奖`:'每张券 = 一次机会 · 当期有效'}</small></div>${icon('chevron')}`,'ticket-overview')}
      <div class="section-head"><h2>完成任务，收集幸运</h2>${action('rules','玩法说明 '+icon('info'))}</div><p class="section-sub">奖券越多，被抽中的机会越大</p>
      <article class="task"><div class="task-top"><span class="task-icon">${icon(r.active?'check':'shield')}</span><div class="task-copy"><h3>激活当期 Jackpot Lotto</h3><p>${c.activationMode==='single'?'单笔':'累计'}充值 ≥ ${whole(c.activationAmount)} · 仅当期有效</p></div>${action('open-deposit',r.active?'已激活':'去激活','task-action '+(r.active?'done':'claim'),r.active?'disabled':'')}</div>${!r.active&&c.activationMode==='cumulative'?`<div class="task-progress"><div><span>激活进度</span><strong>${whole(r.activationTotal)} / ${whole(c.activationAmount)}</strong></div><div class="track"><i style="width:${Math.min(100,r.activationTotal/c.activationAmount*100)}%"></i></div></div>`:''}</article>
      ${task('bet','玩游戏，赢取奖券',`投注档位按最高匹配计算：${(c.betTiers||[]).map(t=>`${whole(t.amount)}→${t.tickets}张`).join(' / ')}`,r.claimed.bet+p.bet,c.betCap)}
      ${task('deposit','充值更多，领取更多',`仅激活后的单笔充值 · 最多 ${c.depositCap} 张`,r.claimed.deposit+p.deposit,c.depositCap)}
      <p class="daily-note">本期收集剩余 <span class="phase-counter">${String(hours).padStart(2,'0')}h ${String(mins).padStart(2,'0')}m</span><br>02:25 停止收集 · 02:25–02:30 结算 · 02:30 开始领奖与新一期</p></div>
      <div class="phone-bottom">${action('prizes',icon('trophy')+'奖项分配')}${action('history',icon('history')+'开奖记录'+(prev?.published&&!prev.seen?'<i class="notification-dot"></i>':''))}${action('wallet',icon('wallet')+'我的钱包')}</div></div><div class="phone-footer">GOGO PRIVILEGES · EVERY TICKET, A POSSIBILITY</div>`;
  }
  function experience(){
    const r=C.current(s),prev=previous();
    return `<div class="ops-label">一键体验场景 <small>切换将替换演示数据</small></div><div class="scenario-grid">${[['new','未激活','从参与第一步开始'],['tickets','待领券','体验任务手动领取'],['settling','结算中','次日 02:27'],['win','中奖待领取','次日 02:30'],['multi','同用户多奖','合计奖金一次领取'],['lose','未中奖','查看未中奖榜单'],['expired','奖金已过期','超过次日 02:30']].map(([id,t,d])=>action('scenario:'+id,t+`<small>${d}</small>`)).join('')}</div>
      <div class="ops-label">模拟业务事件 <small>使用当前期配置</small></div>${action('open-deposit',icon('deposit')+'模拟充值','ops-primary')}${action('open-bet',icon('game')+'模拟已结算投注','ops-primary')}
      <div class="ops-sep"></div><div class="ops-label">推进开奖流程 <small>时间只向前推进</small></div><div class="time-controls">${action('advance:close',`<div>① 到次日 02:25<small>停止收集 · 封存奖券和奖池</small></div><b>→</b>`)}${action('advance:draw',`<div>② 到次日 02:29<small>结算核对 · 结果对玩家隐藏</small></div><b>→</b>`)}${action('advance:publish',`<div>③ 到次日 02:30<small>公布上一期榜单 · 开启领奖</small></div><b>→</b>`)}${action('advance:expire',`<div>④ 到领奖截止次日 02:30<small>未领奖金过期 · 新期继续收集</small></div><b>→</b>`)}</div>
      <div class="ops-label">异常结算演示</div>${action('toggle-hold',prev?.hold?'解除核对阻断':'模拟核对异常 / 阻止公布','ops-primary',!prev||prev.published?'disabled':'')}
      <p class="ops-hint">02:25–02:30 为 5 分钟结算窗口；02:30 后上一期进入领奖期，同时开启新一期收集。</p>
      <div class="ops-summary"><div><span>当期已激活</span><b>${r.active?'是':'否'}</b></div><div><span>个人已领 / 待领</span><b>${r.tickets.length} / ${C.pending(r).bet+C.pending(r).deposit} 张</b></div><div><span>上一期</span><b>${prev?prev.date:'暂无'}</b></div><div><span>演示钱包</span><b>${money(s.wallet)}</b></div></div>${action('reset','重置全部演示数据','ops-reset')}`;
  }
  function field(name,title,value,extra='',type='number'){return `<label class="ops-field"><span>${title}</span><input name="${name}" class="ops-input" type="${type}" value="${esc(value)}" ${extra}></label>`;}
  function config(){const c=s.config;return `<form id="lottery-config"><p class="ops-hint warning">保存后从下一期生效，当前与历史期次保留配置快照。可点击“按新配置新建演示”立即体验。</p><h3 class="config-title">参与资格</h3><label class="ops-field"><span>活动业务时区</span><select class="ops-select" name="timezone">${['Asia/Kolkata','Asia/Shanghai','UTC'].map(z=>`<option ${c.timezone===z?'selected':''}>${z}</option>`).join('')}</select></label><label class="ops-field"><span>收集开始时间</span><input class="ops-input" name="collectionStart" type="time" value="${esc(c.collectionStart)}"></label><label class="ops-field"><span>激活方式</span><select class="ops-select" name="activationMode"><option value="single" ${c.activationMode==='single'?'selected':''}>单笔充值达标</option><option value="cumulative" ${c.activationMode==='cumulative'?'selected':''}>累计充值达标</option></select></label>${field('activationAmount','激活金额 ₹',c.activationAmount,'min="1" step="0.01"')}<div class="ops-label">计入充值方式</div><div class="ops-checks">${['UPI','Bank','Wallet'].map(ch=>`<label><input type="checkbox" name="channels" value="${ch}" ${checked(c.channels,ch)}>${ch}</label>`).join('')}</div><h3 class="config-title">有效投注范围</h3><div class="ops-checks">${['PG','JILI','Evolution'].map(ch=>`<label><input type="checkbox" name="providers" value="${ch}" ${checked(c.providers,ch)}>${ch}</label>`).join('')}</div><div class="ops-checks" style="margin-top:8px">${['Slots','Fishing','Live'].map(ch=>`<label><input type="checkbox" name="types" value="${ch}" ${checked(c.types,ch)}>${ch}</label>`).join('')}</div>${field('betStep','每多少有效投注送 1 张券 ₹',c.betStep,'min="1"')}<div class="ops-field-grid">${field('betCap','投注券上限',c.betCap,'min="1" max="10000"')}${field('depositCap','充值券上限',c.depositCap,'min="1" max="10000"')}</div>${field('ticketCap','每人每期总券上限',c.ticketCap,'min="1" max="10000"')}<h3 class="config-title">单笔充值档位（不叠加）</h3><div class="config-row"><small class="ops-hint">充值金额 ≥ ₹</small><small class="ops-hint">赠券数</small></div>${c.tiers.map((t,i)=>`<div class="config-row"><input class="ops-input" aria-label="充值档位 ${i+1} 金额" name="tierAmount${i}" type="number" min="1" step="0.01" value="${t.amount}"><input class="ops-input" aria-label="充值档位 ${i+1} 券数" name="tierTickets${i}" type="number" min="1" value="${t.tickets}"></div>`).join('')}<h3 class="config-title">投注档位（不叠加）</h3><div class="config-row"><small class="ops-hint">有效投注金额 ≥ ₹</small><small class="ops-hint">奖券数</small></div>${c.betTiers.map((t,i)=>`<div class="config-row"><input class="ops-input" aria-label="投注档位 ${i+1} 金额" name="betTierAmount${i}" type="number" min="1" step="0.01" value="${t.amount}"><input class="ops-input" aria-label="投注档位 ${i+1} 券数" name="betTierTickets${i}" type="number" min="1" value="${t.tickets}"></div>`).join('')}<h3 class="config-title">奖池资金</h3><div class="ops-field-grid">${field('rtp','大盘加权 RTP %',c.rtp,'min="0" max="100" step="0.01"')}${field('poolShare','理论毛利分成 %',c.poolShare,'min="0" max="100" step="0.01"')}</div>${field('marketBet','模拟其他用户有效投注 ₹',c.marketBet,'min="0"')}${field('basePool','平台基础金额 ₹',c.basePool,'min="0"')}${field('demoPoolRatePerMinute','Demo 每分钟增长 ₹',c.demoPoolRatePerMinute,'min="0"')}${field('participants','模拟其他参与用户数',c.participants,'min="1" max="10000"')}<h3 class="config-title">奖项分配（每名占总池比例）</h3><div class="config-prize"><span>奖级</span><span>人数</span><span>单人比例 %</span></div>${c.prizes.map((p,i)=>`<div class="config-prize"><span>${p.name}</span><input name="prizeCount${i}" aria-label="${p.name}人数" class="ops-input" type="number" min="0" value="${p.count}"><input name="prizeRate${i}" aria-label="${p.name}比例" class="ops-input" type="number" min="0.00001" step="0.00001" value="${p.rate}"></div>`).join('')}<p class="config-total">当前合计：${c.prizes.reduce((n,p)=>n+p.count*p.rate,0).toFixed(3)}%</p><div id="config-error" role="alert"></div><button class="ops-primary gold" type="submit">保存配置 · 下一期生效</button>${action('config-fresh','按新配置新建演示','ops-primary')}<p class="ops-hint">时区在此作为业务时间标识，演示时钟展示该时区的墙上时间；生产以服务端统一时间切分期次。</p></form>`;}
  function audit(){
    const r=previous();
    return `<div class="ops-label">${r?esc(r.id)+' · 结算轨迹':'尚无封存期次'}</div>${r?r.audit.map((a,i)=>`<div class="audit-step"><span>${i+1}</span><div><b>${esc(a.label)}</b><p>${esc(a.detail)}</p></div></div>`).join(''):'<div class="empty-ops">先领取奖券，再推进到次日 02:25<br>即可查看封存与抽奖过程。</div>'}${r?.result?`<div class="audit-info">候选快照指纹（演示）：${r.result.fingerprint}<br>随机种子（演示）：${r.seed}<br>算法：${r.result.algorithm}<br>中奖人数：${r.result.rows.length}<br>未分配金额：${money(r.result.unallocated)}<br>结果状态：${r.published?'已公布':'未公布，不对用户展示'}</div>${action('verify:'+r.date,'重算并核对演示结果','ops-primary')}`:''}<h3 class="audit-heading">当前期事件流水</h3>${C.current(s).events.length?[...C.current(s).events].reverse().slice(0,18).map(e=>`<div class="event-line"><b>${time(e.time)}</b>${esc(e.detail)}</div>`).join(''):'<p class="inline-empty">暂无事件。可模拟充值或投注。</p>'}<p class="ops-hint">本地抽奖用于说明产品逻辑，不构成真实可验证公平服务。完整候选集合、随机源与审计记录应在服务端实现。</p>`;
  }
  function render(){
    const r=C.current(s);
    root.innerHTML=`<div class="demo-layout"><aside class="desk-nav"><a class="brand" href="index.html">Go<b>go</b></a><div class="edition">REWARDS COLLECTION</div><nav><a href="index.html">${icon('home')}游戏大厅</a><button class="active" type="button">${icon('ticket')}Jackpot Lotto</button>${action('history',icon('history')+'开奖记录')}${action('rules',icon('info')+'玩法说明')}${action('wallet',icon('wallet')+'我的钱包')}</nav><div class="nav-note"><b>每天一份幸运</b><br>参与 → 收集奖券 → 等待开奖<br><br>交互原型 · 全部使用模拟数据<br>未连接真实充值、投注或发奖</div></aside><main class="stage-column"><div class="workspace-top"><span><i class="live-dot"></i>每日 Jackpot / 活动预览</span><span class="version-pill">INTERACTIVE DEMO · V1.0</span></div>${phone()}</main><aside class="ops-panel ${opsOpen?'open':''}"><div class="ops-heading"><span>${icon('settings')}</span><div><h2>演示控制台</h2><p>切换场景，走完一次开奖</p></div>${action('ops-close',icon('close'),'circle-btn ops-back','aria-label="关闭控制台"')}</div><div class="ops-clock"><div><small>模拟业务时间 · ${esc(r.config.timezone)}</small><b>${datetime(s.now)}</b></div><span>SIMULATED</span></div><div class="ops-tabs">${[['experience','体验场景'],['config','后台配置'],['audit','开奖审计']].map(([id,t])=>action('ops-tab:'+id,t,opsTab===id?'active':'')).join('')}</div>${opsTab==='config'?config():opsTab==='audit'?audit():experience()}<p class="ops-footer">场景与配置仅保存在当前浏览器。<br>右侧面板为评审工具，不属于玩家端页面。</p></aside></div>`;
    if(modal)renderModal();
  }
  function open(type,date){modal={type,date};if(type==='tickets')ticketFilter='all';if(type==='results'){resultPage=0;resultSearch='';resultFilter='all';const r=s.rounds[date];if(r?.published){r.seen=true;save();}}renderModal();}
  function close(){modal=null;modalRoot.innerHTML='';document.body.style.overflow='';}
  function dialog(title,subtitle,body,footer=''){
    modalRoot.innerHTML=`<div class="lotto-overlay" data-overlay="true"><section class="lotto-dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="dialog-head"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div>${action('close',icon('close'),'circle-btn','aria-label="关闭弹窗"')}</div><div class="dialog-body">${body}</div>${footer?`<div class="dialog-footer">${footer}</div>`:''}</section></div>`;
    document.body.style.overflow='hidden';modalRoot.querySelector('button')?.focus({preventScroll:true});
  }
  function prizeTable(r){const total=r.snapshot?.pool.total??C.pool(r).total;return `<table class="prize-table"><thead><tr><th>奖项</th><th>名额</th><th>每名占比</th><th>每名奖金</th></tr></thead><tbody>${r.config.prizes.map(p=>`<tr><td>${p.name}</td><td>${p.count}</td><td>${p.rate}%</td><td>${whole(Math.floor(total*100*p.rate/100)/100)}</td></tr>`).join('')}</tbody></table>`;}
  function renderModal(){
    if(!modal)return;const r=C.current(s),c=r.config;
    if(modal.type==='rules')return dialog('How Jackpot Lotto Works','每日一期 · 收集幸运，分享惊喜',[
      ['激活当期活动',`${c.activationMode==='single'?'单笔':'累计'}充值达到 ${whole(c.activationAmount)} 激活；激活当期有效。触发激活的该笔充值只用于激活，不赠券；此前充值和投注不追溯。`],
      ['完成任务，手动领券',`配置范围内每 ${whole(c.betStep)} 已结算有效投注送 1 张；单笔充值取最高档，不叠加。两类分别上限 ${c.betCap}/${c.depositCap} 张，总计不超过 ${c.ticketCap} 张。`],
      ['次日 02:25 封存本期',`仅已手动领取奖券进入候选池；未领券、未满进度失效。封存后个人页面进入新一期，新一期需重新激活，不影响上一期结算。`],
      ['由高至低加权抽奖','每张已领券权重相同，依次抽一等奖、二等奖、三等奖、幸运奖。同一张券最多中奖一次，抽中后仅移除该券；同用户其他券继续参与，可中同奖级或不同奖级。候选券不足时剩余名额空缺。'],
      ['02:30 公布，手动领奖','02:25–02:30 结算，02:30 公开结果。首次登录自动弹出上一期榜单；中奖按钮亮起，手动领取后到账。次日 02:30 截止，超时失效，无自动补领。'],
      ['结果核对与异常处理','开奖结果在公布后锁定；开奖库按期次＋券号去重，不按用户去重。核对异常则保持结算中，解除异常后再公布。演示采用固定领奖截止；生产异常延期补偿策略需另行确认。']
    ].map(([t,d],i)=>`<div class="rules-step"><span>${i+1}</span><div><h3>${t}</h3><p>${d}</p></div></div>`).join('')+`<p class="dialog-note">全部时间按活动业务时区 ${esc(c.timezone)} 计算。RTP 资金采用理论毛利贡献，属于平台活动预算，不从玩家已经赢得的奖金中另行扣除。</p>`,action('close','我知道了','gold-button'));
    if(modal.type==='prizes')return dialog('奖项与奖金分配','每一个中奖名额，按最终奖池比例获得奖金',prizeTable(r)+`<div class="formula-card">单人奖金 = 最终总奖池 × 对应奖级比例</div><p class="dialog-note">默认奖项比例合计 100%。幸运奖 1,000 名 × 0.028%，用于修正竞品截图合计 102% 的问题。金额按分向下取整；尾差、空缺名额及过期未领金额记入平台活动账户，不滚入下一期。</p>`,action('close','了解奖项','gold-button'));
    if(modal.type==='share'){
      const rr=s.rounds[modal.date],my=rr?.result?.my;
      const link=`平台邀请链接（示例）/lotto?invite=DD10086&round=${modal.date}`;
      return dialog('分享 Jackpot','分享页沿用平台邀请奖励，不额外赠送奖券',`<p class="dialog-note">${my?`我在 ${dateLabel(modal.date)} 的 Jackpot 中中奖 ${my.count} 次，合计 ${money(my.amount)}。`:'每日 Jackpot 正在进行，来一起收集奖券、参与开奖。'}</p><label class="modal-label">我的邀请链接</label><div class="share-link"><input class="modal-input" value="${link}" readonly><button data-action="copy-link:${esc(link)}" class="circle-btn" aria-label="复制邀请链接">${icon('share')}</button></div><div class="share-methods"><button data-action="share-method:whatsapp">WhatsApp</button><button data-action="share-method:facebook">Facebook</button><button data-action="share-method:telegram">Telegram</button><button data-action="share-method:more">更多</button></div><p class="dialog-note">分享、复制链接不直接发券；邀请奖励按平台现有归因和结算规则执行。</p>`,action('close','返回开奖记录','gold-button'));
    }
    if(modal.type==='pool'){
      const p=C.pool(r);return dialog('奖池如何汇聚','参与期间动态增加，02:25 停止增长并在结算后锁定',`<div class="formula-card">实时奖池 = 初始投入 + 已归集有效投注贡献<br>有效投注贡献 = Σ [有效投注 × (1 − 游戏 RTP) × Jackpot 分成比例]</div><div class="ledger-row"><span>本期初始投入</span><strong>${money(p.base)}</strong></div><div class="ledger-row"><span>已归集投注贡献<small>演示加权 RTP ${c.rtp}% · 分成 ${c.poolShare}%</small></span><strong>${money(p.contribution)}</strong></div><div class="ledger-row"><span>本期实时奖池</span><strong>${money(p.total)}</strong></div><p class="dialog-note">充值不直接进入奖池。符合大盘配置的有效投注会贡献奖池，即使投注用户尚未激活或已领满个人奖券。02:25 后停止上一期增长，最终金额以结算核对为准。</p>`,action('close','我知道了','gold-button'));
    }
    if(modal.type==='tickets'){
      const pending=C.pending(r),list=r.tickets.filter(t=>ticketFilter==='all'||t.source===ticketFilter);
      return dialog('My Lotto Tickets',`${r.id} · 已领取的奖券才参与本期开奖`, `<div class="dialog-stats"><div><b>${r.tickets.length}</b><small>已领券</small></div><div><b>${pending.bet+pending.deposit}</b><small>待领取</small></div><div><b>${c.ticketCap}</b><small>当期上限</small></div></div><div class="filter-tabs">${[['all','全部'],['bet','投注券'],['deposit','充值券']].map(([id,t])=>action('ticket-filter:'+id,t,ticketFilter===id?'active':'')).join('')}</div>${list.length?list.map(t=>`<article class="ticket-item"><div><b>${esc(t.id)}</b><small>${t.source==='bet'?'投注任务':'充值任务'} · ${datetime(t.claimedAt)}</small></div><span>本期有效</span></article>`).join(''):`<div class="empty-state">${icon('ticket')}<h3>幸运从第一张券开始</h3><p>完成任务并手动领取奖券<br>已领取的奖券会展示在这里</p></div>`}`,action('close',pending.bet+pending.deposit?'返回任务，领取奖券':'返回任务，收集更多','gold-button'));
    }
    if(modal.type==='deposit'||modal.type==='bet'){
      const isBet=modal.type==='bet';
      return dialog(isBet?'模拟游戏投注':'模拟充值',isBet?'用于演示有效投注计算，不产生真实游戏交易':'用于演示激活与充值赠券，不产生真实支付',`<form id="lottery-event-form"><label class="modal-label">${isBet?'已结算投注金额':'充值金额'} ₹</label><input name="amount" class="modal-input" type="number" min="1" max="1000000000" step="0.01" value="${isBet?600:r.active?1000:c.activationAmount}" required aria-label="金额"><div class="amount-grid">${(isBet?[600,6000,36000]:[50,500,1000]).map(n=>action('amount:'+n,whole(n))).join('')}</div>${isBet?`<label class="modal-label">游戏厂商</label><select name="provider" class="modal-input">${['PG','JILI','Evolution'].map(p=>`<option>${p}</option>`).join('')}</select><label class="modal-label">游戏类型</label><select name="gameType" class="modal-input">${['Slots','Fishing','Live'].map(p=>`<option>${p}</option>`).join('')}</select><label class="modal-label">注单状态</label><select name="status" class="modal-input"><option value="settled">已结算 / 有效</option><option value="pending">未结算</option><option value="refunded">已退款 / 已撤销</option></select>`:`<label class="modal-label">充值方式</label><select name="channel" class="modal-input">${['UPI','Bank','Wallet'].map(p=>`<option>${p}</option>`).join('')}</select>`}<div id="event-error" role="alert"></div><p class="dialog-note">${isBet?`仅 ${esc(c.providers.join(' / '))} 的 ${esc(c.types.join(' / '))} 类型、激活后的已结算有效投注计个人任务；退款与未结算不计入。`:r.active?'按单笔最高匹配档位计算，不叠加。券需返回任务手动领取。':'本笔若触发激活，只完成激活，不计算充值赠券；激活后下一笔充值开始计券。'}</p><button class="gold-button" type="submit">${isBet?'确认模拟投注':'确认模拟充值'}</button></form>`);
    }
    if(modal.type==='history'){
      const rounds=Object.values(s.rounds).filter(x=>x.snapshot).sort((a,b)=>b.date.localeCompare(a.date));
      return dialog('Lotto Draw History','查看每期开奖与我的领奖状态',rounds.length?rounds.map(x=>action('results:'+x.date,`<div><b>${dateLabel(x.date)}</b><small>${x.id} · ${x.published?'奖池 '+money(x.snapshot.pool.total):'结算中，结果尚未公布'}</small></div><span>${x.expired?'已结束':x.claimedPrize?'已领取':x.published?x.result.my?'可领取':'未中奖':'结算中'} ›</span>`,'history-item')).join(''):`<div class="empty-state">${icon('history')}<h3>暂无开奖记录</h3><p>每期次日 02:30 公布结果<br>可使用演示控制台体验完整流程</p></div>`,action('close','返回活动','gold-button'));
    }
    if(modal.type==='results')return resultModal(modal.date);
    if(modal.type==='wallet')return dialog('我的演示钱包','仅记录 Jackpot 奖金领取，不接入真实账户',`<div class="result-pool">可用演示余额<strong>${money(s.wallet)}</strong></div>${s.walletEntries.length?[...s.walletEntries].reverse().map(e=>`<div class="ledger-row"><span>Jackpot 奖金 · ${e.date}<small>${datetime(e.time)} · ${esc(e.id)}</small></span><strong>+${money(e.amount)}</strong></div>`).join(''):`<div class="empty-state">${icon('wallet')}<h3>暂无奖金入账</h3><p>中奖后手动领取，奖金才会进入钱包。</p></div>`}`,action('close','返回活动','gold-button'));
  }
  function resultModal(date){
    const r=s.rounds[date];if(!r)return close();
    if(!r.published)return dialog('Lotto Draw Results',`${dateLabel(date)} · ${r.id}`,`<div class="settlement-card">${icon('clock',r.hold?'':'spinner')}<h3>${r.hold?'核对进行中，开奖延迟':'本期正在结算'}</h3><p>${r.hold?'开奖结果完成核对后公布。<br>此时无法领取奖金。':'次日 02:30 公布中奖名单。<br>仅已领取奖券进入本期抽奖。'}</p></div><p class="dialog-note">当前可以继续参与新一期活动，上一期结算不会占用新一期奖券。内部抽奖过程可在控制台“开奖审计”中查看。</p>`,action('close','返回参与新一期','gold-button'));
    let rows=r.result.rows;
    if(resultFilter==='mine')rows=rows.filter(x=>x.userId==='YOU');else if(resultFilter!=='all')rows=rows.filter(x=>x.prize===resultFilter);
    if(resultSearch)rows=rows.filter(x=>(x.name+' '+x.ticket).toLowerCase().includes(resultSearch.toLowerCase()));
    const size=15,pages=Math.max(1,Math.ceil(rows.length/size));resultPage=Math.min(resultPage,pages-1);
    const my=r.result.my,expired=C.stage(s,r)==='expired',canClaim=my&&!expired&&!r.claimedPrize;
    const cards=rows.slice(resultPage*size,(resultPage+1)*size).map((row,i)=>{
      const rank={first:'1st',second:'2nd',third:'3rd',lucky:'★'}[row.prize];
      return `<article class="winner-ticket ${row.prize} ${row.userId==='YOU'?'is-me':''}"><div class="winner-rank">${rank}<small>${row.prize==='lucky'?'LUCKY':'PRIZE'}</small></div><div class="winner-money"><strong>${money(row.amount)}</strong><code>${esc(row.ticket)}</code></div><div class="winner-person"><img src="lobby/assets/profile/avatar-${1+(Number(row.userId.replace(/\D/g,''))||i)%6}.png" alt=""><span>${row.userId==='YOU'?'You · 我':esc(row.name)}</span></div></article>`;
    }).join('');
    return dialog('Lotto Draw Results',`Draw Date: ${dateLabel(date)} · ${r.id}`,`<div class="result-pool">Total Prize Pool<strong>${money(r.snapshot.pool.total)}</strong></div><div class="result-toolbar"><select data-result-filter aria-label="奖项筛选">${[['all','全部奖项'],['first','一等奖'],['second','二等奖'],['third','三等奖'],['lucky','幸运奖'],['mine','仅看我的']].map(([v,t])=>`<option value="${v}" ${resultFilter===v?'selected':''}>${t}</option>`).join('')}</select><input data-result-search value="${esc(resultSearch)}" placeholder="搜索昵称 / 券号" aria-label="搜索中奖记录"></div>${cards||`<div class="empty-state">${icon('trophy')}<h3>${resultFilter==='mine'?'本期未中奖':'暂无匹配记录'}</h3><p>${resultFilter==='mine'?'Better luck next time! Keep going!':'换一个奖项或搜索条件试试'}</p></div>`}${pages>1?`<div class="pagination">${action('result-page:-1','上一页','',resultPage<=0?'disabled':'')}<span>${resultPage+1} / ${pages} · ${rows.length} 名</span>${action('result-page:1','下一页','',resultPage>=pages-1?'disabled':'')}</div>`:''}<p class="dialog-note">逐张随机抽券，同一张券仅中一次；同用户多张券可中多个奖。<br>本期 ${r.result.participants.toLocaleString()} 名参与用户，${r.result.rows.length.toLocaleString()} 张中奖券 / ${new Set(r.result.rows.map(x=>x.userId)).size.toLocaleString()} 名中奖用户。</p>`, `<div class="my-prize"><div><small>MY PRIZE · 合计奖金</small><strong>${money(my?.amount||0)}</strong></div><span>${r.claimedPrize?'✓ 已领取':my?(expired?'已过领取期限':`共中 ${my.count} 个奖`):'Better luck next time!'}</span></div><div class="result-footer-actions">${action('share:'+date,'Share Prize')}${action('claim-prize:'+date,r.claimedPrize?'Claimed · 已领取':my&&expired?'Expired · 已过期':my?'Claim Prize · 领取奖金':'未中奖','gold-button',canClaim?'':'disabled')}</div><p class="dialog-note" style="margin-bottom:0">多奖合计一次入账，不重复领取。<br>领取期限：次日 02:30–再下一日 02:30 · ${esc(r.config.timezone)}</p>`);
  }
  function randomSeed(){const a=new Uint32Array(1);if(window.crypto?.getRandomValues){crypto.getRandomValues(a);return a[0];}return Date.now()>>>0;}
  function generateAndPublish(){Object.values(s.rounds).filter(r=>r.snapshot&&!r.expired&&!r.hold).forEach(r=>{
    const drawAt=C.settlementEnd(r.date,r.config);
    if(s.now>=drawAt){C.draw(s,r.date,r.seed??randomSeed());C.publish(s,r.date);}
  });}
  function autoPopup(){const r=Object.values(s.rounds).filter(r=>r.published&&!r.expired&&!r.seen).sort((a,b)=>b.date.localeCompare(a.date))[0];if(r)open('results',r.date);}
  function advance(mode){
    close();let r=C.current(s),prev=previous(),target;
    if(mode==='close'){target=C.collectEnd(r.date,r.config);}
    else if(mode==='expire'){if(!prev)throw new Error('请先封存一期，再体验过期');target=C.claimEnd(prev.date,prev.config);if(target<=s.now)throw new Error('上一期已经过期');}
    else {const working=prev&&!prev.expired?prev:r;target=mode==='draw'?C.collectEnd(working.date,working.config)+4*C.MINUTE:C.settlementEnd(working.date,working.config);if(target<s.now)throw new Error('该节点已经过去，请继续下一步或切换演示场景');}
    C.advance(s,target);
    if(mode==='draw'){const sealed=previous();if(sealed&&!sealed.hold)C.draw(s,sealed.date,sealed.seed??randomSeed());opsTab='audit';}
    generateAndPublish();save();render();autoPopup();notify(mode==='close'?'上一期已封存，新一期已开启':mode==='draw'?'结果已生成并核对，02:30 前不对玩家展示':mode==='publish'?'已到开奖时间；核对完成的期次已公布':'领取窗口结束，未领奖金已过期');
  }
  function prepareTickets(target){
    const r=C.current(target),c=r.config,ch=c.channels[0];
    C.deposit(target,c.activationAmount,ch);
    C.deposit(target,Math.max(...c.tiers.map(t=>t.amount)),ch);
    C.bet(target,c.betStep*20,c.providers[0],c.types[0]);
  }
  function scenario(name){
    close();const cfg=s.config;s=C.create(cfg);
    if(name!=='new')prepareTickets(s);
    if(['settling','win','multi','lose','expired'].includes(name)){
      if(C.pending(C.current(s)).bet)C.claimTickets(s,'bet');if(C.pending(C.current(s)).deposit)C.claimTickets(s,'deposit');
      const date=C.current(s).date;C.advance(s,C.collectEnd(date,s.config)+3*C.MINUTE);
      if(name!=='settling'){
        const r=s.rounds[date];let seed=1,desired=name!=='lose';
        // Outcome fixtures deliberately search a demo seed; never used in normal draw flow.
        for(;seed<300;seed++){r.result=null;r.seed=null;r.audit=r.audit.filter(a=>['close','reconcile'].includes(a.step));C.draw(s,date,seed);if(name==='multi'?r.result.my?.count>=2:Boolean(r.result.my)===desired)break;}
        if((name==='multi'?!(r.result.my?.count>=2):Boolean(r.result.my)!==desired))throw new Error('当前奖项配置无法生成此场景，请调整参与人数与奖项数量');
        C.advance(s,C.settlementEnd(date,s.config));C.publish(s,date);
        if(name==='expired')C.advance(s,C.claimEnd(date,s.config));
      }
    }
    opsTab='experience';opsOpen=false;save();render();if(['win','multi','lose'].includes(name))autoPopup();else if(name==='expired')open('results',Object.values(s.rounds).find(r=>r.published).date);
    notify('已切换场景；中奖结果为演示测试数据');
  }
  function parseConfig(form){
    const f=new FormData(form),n=key=>Number(f.get(key));
    const cfg={...s.config,activationMode:f.get('activationMode'),timezone:f.get('timezone'),collectionStart:f.get('collectionStart'),channels:f.getAll('channels'),providers:f.getAll('providers'),types:f.getAll('types')};
    ['activationAmount','betStep','betCap','depositCap','ticketCap','rtp','poolShare','marketBet','basePool','demoPoolRatePerMinute','participants'].forEach(k=>cfg[k]=n(k));
    cfg.tiers=cfg.tiers.map((t,i)=>({amount:n('tierAmount'+i),tickets:n('tierTickets'+i)}));cfg.betTiers=cfg.betTiers.map((t,i)=>({amount:n('betTierAmount'+i),tickets:n('betTierTickets'+i)}));cfg.prizes=cfg.prizes.map((p,i)=>({...p,count:n('prizeCount'+i),rate:n('prizeRate'+i)}));return cfg;
  }
  function configSave(fresh){const form=document.querySelector('#lottery-config');try{C.nextConfig(s,parseConfig(form));if(fresh){s=C.create(s.config);opsTab='experience';}save();render();notify(fresh?'已按新配置新建演示':'配置已保存，下一期开启时生效');}catch(e){document.querySelector('#config-error').innerHTML=`<p class="modal-error">${esc(e.message)}</p>`;}}
  document.addEventListener('click',async event=>{
    if(event.target.dataset.overlay){close();return;}
    const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
    const [name,...args]=button.dataset.action.split(':'),value=args.join(':');
    try{
      if(name==='close')return close();
      if(['tickets','rules','prizes','pool','history','wallet'].includes(name))return open(name);
      if(name==='results')return open('results',value);
      if(name==='open-deposit'||name==='open-bet')return open(name==='open-bet'?'bet':'deposit');
      if(name==='claim-tickets'){const count=C.claimTickets(s,value);save();render();notify(`${count} 张奖券已领取，已加入本期抽奖`);}
      if(name==='claim-prize'){const amount=C.claimPrize(s,value);save();render();notify(`${money(amount)} 奖金已到账，可在“我的钱包”查看`);}
      if(name==='amount'){modalRoot.querySelector('[name="amount"]').value=value;modalRoot.querySelectorAll('.amount-grid button').forEach(b=>b.classList.toggle('active',b===button));}
      if(name==='ticket-filter'){ticketFilter=value;renderModal();}
      if(name==='result-page'){resultPage+=Number(value);renderModal();}
      if(name==='ops-tab'){opsTab=value;render();}
      if(name==='ops-open'){opsOpen=true;render();}
      if(name==='ops-close'){opsOpen=false;render();}
      if(name==='scenario')scenario(value);
      if(name==='advance')advance(value);
      if(name==='toggle-hold'){const r=previous();if(r&&!r.published){r.hold=!r.hold;r.audit.push({step:'hold',label:r.hold?'结算核对异常':'解除核对异常',detail:r.hold?'演示对账差异；不公布、不发奖':'对账完成；在领取窗口内恢复公布'});generateAndPublish();save();render();autoPopup();}}
      if(name==='config-fresh')configSave(true);
      if(name==='reset'){close();s=C.create();save();render();notify('演示数据已重置');}
      if(name==='verify'){
        const r=s.rounds[value],clone=JSON.parse(JSON.stringify(s)),other=clone.rounds[value];other.result=null;other.audit=[];other.hold=false;
        C.draw(clone,value,r.seed);const equal=JSON.stringify(other.result.rows)===JSON.stringify(r.result.rows);
        notify(equal?'核对通过：同一候选快照和种子得到相同结果':'核对失败：结果存在差异');
      }
      if(name==='share')return open('share',value);
      if(name==='copy-link'){try{await navigator.clipboard.writeText(value);notify('邀请链接已复制');}catch{notify('请长按链接复制');}}
      if(name==='share-method')notify(`${value} 分享已打开演示入口；邀请奖励沿用平台规则`);
    }catch(e){notify(e.message);}
  });
  document.addEventListener('submit',event=>{
    if(event.target.id==='lottery-config'){event.preventDefault();configSave(false);return;}
    if(event.target.id!=='lottery-event-form')return;event.preventDefault();
    const f=new FormData(event.target),amount=Number(f.get('amount'));
    try{const result=modal.type==='bet'?C.bet(s,amount,f.get('provider'),f.get('gameType'),f.get('status')):C.deposit(s,amount,f.get('channel'));close();save();render();notify(result.message);}catch(e){document.querySelector('#event-error').innerHTML=`<div class="modal-error">${esc(e.message)}</div>`;}
  });
  document.addEventListener('change',event=>{if(event.target.hasAttribute('data-result-filter')){resultFilter=event.target.value;resultPage=0;renderModal();}});
  document.addEventListener('input',event=>{
    if(event.target.hasAttribute('data-result-search')){resultSearch=event.target.value;resultPage=0;const at=event.target.selectionStart;renderModal();const input=modalRoot.querySelector('[data-result-search]');input.focus();input.setSelectionRange(at,at);}
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){if(modal)close();else if(opsOpen){opsOpen=false;render();}}
    if(event.key==='Tab'&&modal){const items=[...modalRoot.querySelectorAll('button:not(:disabled),input,select,textarea,a[href]')],first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){last?.focus();event.preventDefault();}else if(!event.shiftKey&&document.activeElement===last){first?.focus();event.preventDefault();}}
  });
  save();render();autoPopup();
})();
