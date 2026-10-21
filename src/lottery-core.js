/* Business-time simulation. No payments, real wagers or server-side drawing. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Lotto = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY = 86400000, HOUR = 3600000, MINUTE = 60000;
  const copy = value => JSON.parse(JSON.stringify(value));
  const defaults = {
    timezone: 'Asia/Kolkata', collectionStart: '02:30', activationMode: 'single', activationAmount: 50,
    channels: ['UPI', 'Bank'], providers: ['PG', 'JILI'], types: ['Slots', 'Fishing'],
    betStep: 600, betCap: 60, depositCap: 40, ticketCap: 100,
    tiers: [{amount:100,tickets:1},{amount:500,tickets:2},{amount:1000,tickets:4}],
    rtp: 96, poolShare: 25, basePool: 1000000, floorPool: 0,
    marketBet: 0, demoPoolRatePerMinute: 520, participants: 1250,
    betTiers: [{amount:600,tickets:1},{amount:6000,tickets:10},{amount:36000,tickets:60}],
    prizes: [{id:'first',name:'一等奖',en:'1st Prize',count:1,rate:24},
      {id:'second',name:'二等奖',en:'2nd Prize',count:7,rate:4},
      {id:'third',name:'三等奖',en:'3rd Prize',count:50,rate:0.4},
      {id:'lucky',name:'幸运奖',en:'Lucky Prize',count:1000,rate:0.028}]
  };
  function validate(c) {
    const errors=[];
    if(!['single','cumulative'].includes(c.activationMode)) errors.push('请选择激活方式');
    for(const key of ['activationAmount','betStep']) if(!Number.isFinite(c[key])||c[key]<=0) errors.push(`${key} 必须大于 0`);
    for(const key of ['betCap','depositCap','ticketCap','participants']) if(!Number.isInteger(c[key])||c[key]<1||c[key]>10000) errors.push(`${key} 必须为 1–10000 的整数`);
    if(c.betCap+c.depositCap>c.ticketCap) errors.push('两类任务上限之和不能超过总券上限');
    if(!Number.isFinite(c.rtp)||c.rtp<0||c.rtp>100) errors.push('RTP 应在 0–100% 之间');
    if(!Number.isFinite(c.poolShare)||c.poolShare<0||c.poolShare>100) errors.push('奖池分成应在 0–100% 之间');
    for(const key of ['basePool','floorPool','marketBet','demoPoolRatePerMinute']) if(!Number.isFinite(c[key])||c[key]<0||c[key]>1e12) errors.push(`${key} 金额无效`);
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.collectionStart)) errors.push('收集开始时间必须是 HH:MM');
    if(!c.channels.length||!c.providers.length||!c.types.length) errors.push('充值渠道、厂商和类型至少各选一项');
    if(!c.tiers.length||c.tiers.some(t=>!Number.isFinite(t.amount)||t.amount<=0||!Number.isInteger(t.tickets)||t.tickets<1)) errors.push('充值档位金额和券数必须为正数');
    if(new Set(c.tiers.map(t=>t.amount)).size!==c.tiers.length) errors.push('充值档位金额不能重复');
    if(!c.betTiers?.length||c.betTiers.some(t=>!Number.isFinite(t.amount)||t.amount<=0||!Number.isInteger(t.tickets)||t.tickets<1)) errors.push('投注档位金额和券数必须为正数');
    if(new Set(c.betTiers?.map(t=>t.amount)).size!==(c.betTiers?.length||0)) errors.push('投注档位金额不能重复');
    if(!c.prizes.length||c.prizes.some(p=>!Number.isInteger(p.count)||p.count<0||!Number.isFinite(p.rate)||p.rate<=0)) errors.push('奖项数量必须为非负整数，比例必须大于 0');
    const allocation=c.prizes.reduce((s,p)=>s+p.count*p.rate,0);
    if(allocation>100+1e-8) errors.push(`奖金分配合计 ${allocation.toFixed(3)}%，不能超过 100%`);
    return errors;
  }
  const dateKey = time => new Date(time).toISOString().slice(0,10);
  const midnight = date => Date.parse(date+'T00:00:00Z');
  const clockMinute = value => Number(value.slice(0,2))*60+Number(value.slice(3));
  const roundStart = (date, config=defaults) => midnight(date)+clockMinute(config.collectionStart)*MINUTE;
  const collectEnd = (date, config=defaults) => roundStart(date,config)+23*HOUR+55*MINUTE;
  const settlementEnd = (date, config=defaults) => roundStart(date,config)+DAY;
  const claimEnd = (date, config=defaults) => roundStart(date,config)+2*DAY;
  function roundKeyFor(time,config=defaults){
    const date=dateKey(time);
    const start=roundStart(date,config),end=collectEnd(date,config),settle=settlementEnd(date,config);
    if(time<start) return dateKey(midnight(date)-DAY);
    if(time<end) return date;
    return dateKey(midnight(date)+DAY);
  }
  const roundId = date => 'JL-'+date.replaceAll('-','');
  function create(config={}) {
    const c={...copy(defaults),...copy(config)};
    const errors=validate(c);if(errors.length) throw new Error(errors.join('；'));
    const s={version:2,now:Date.parse('2026-10-20T12:20:00Z'),config:c,rounds:{},wallet:0,walletEntries:[],sequence:0};
    ensureRound(s,roundKeyFor(s.now,c));return s;
  }
  function ensureRound(s,date) {
    if(!s.rounds[date])s.rounds[date]={date,id:roundId(date),config:copy(s.config),active:false,activationAt:null,activationTotal:0,
      validBet:0,marketVolume:0,depositEarned:0,claimed:{bet:0,deposit:0},tickets:[],events:[],contribution:0,status:'participating',
      snapshot:null,audit:[],result:null,published:false,claimedPrize:false,expired:false,seen:false,hold:false,seed:null};
    return s.rounds[date];
  }
  const current = s => {const r=ensureRound(s,roundKeyFor(s.now,s.config));r._now=s.now;return r;};
  function log(s,r,kind,detail){r.events.push({id:++s.sequence,time:s.now,kind,detail});}
  function stage(s,r) {
    const start=roundStart(r.date,r.config),end=collectEnd(r.date,r.config),settle=settlementEnd(r.date,r.config),claim=claimEnd(r.date,r.config);
    if(s.now<start)return 'preparing';
    if(s.now<end)return 'participating';
    if(s.now<settle)return 'settling';
    if(s.now<claim&&r.published)return 'published';
    if(s.now<claim)return 'settling';
    return 'expired';
  }
  function pending(r) {
    const matched=[...(r.config.betTiers||[{amount:r.config.betStep,tickets:1}])].sort((a,b)=>a.amount-b.amount).filter(t=>r.validBet>=t.amount).at(-1)?.tickets||0;
    const bet=Math.max(0,Math.min(r.config.betCap,matched)-r.claimed.bet);
    const deposit=Math.max(0,Math.min(r.config.depositCap,r.depositEarned)-r.claimed.deposit);
    return {bet,deposit};
  }
  function deposit(s,amount,channel='UPI') {
    if(!Number.isFinite(amount)||amount<=0||amount>1e9)throw new Error('请输入有效充值金额');
    const r=current(s),c=r.config;
    if(s.now<roundStart(r.date,c)) throw new Error('新一期将在 02:30 开始，请稍候');
    if(s.now>=collectEnd(r.date,c)) throw new Error('本期已于 02:25 截止收集，请参与新一期');
    if(!c.channels.includes(channel)){log(s,r,'deposit','充值渠道未纳入活动');return {activated:false,earned:0,message:'该充值方式不计入活动'};}
    if(!r.active){
      r.activationTotal+=amount;
      const qualifies=c.activationMode==='single'?amount>=c.activationAmount:r.activationTotal>=c.activationAmount;
      if(qualifies){r.active=true;r.activationAt=s.now;log(s,r,'activate',`当期激活，触发充值 ₹${amount} 不发券`);}
      else log(s,r,'deposit',`激活前充值 ₹${amount}，仅计入累计激活门槛`);
      return {activated:qualifies,earned:0,message:qualifies?'当期已激活；本笔充值不发券':'未达到激活门槛，未产生奖券'};
    }
    const tier=[...c.tiers].sort((a,b)=>b.amount-a.amount).find(t=>amount>=t.amount);
    const earned=Math.max(0,Math.min(tier?.tickets||0,c.depositCap-r.depositEarned));
    r.depositEarned+=earned;log(s,r,'deposit',`充值 ₹${amount}，最高匹配档位，待领取 +${earned} 张`);
    return {activated:false,earned,message:earned?`充值成功，${earned} 张券待手动领取`:'未达到赠券档位或已达到充值券上限'};
  }
  function bet(s,amount,provider='PG',type='Slots',status='settled',rtpOverride) {
    if(!Number.isFinite(amount)||amount<=0||amount>1e9)throw new Error('请输入有效投注金额');
    const r=current(s),c=r.config;
    if(s.now<roundStart(r.date,c)) throw new Error('新一期将在 02:30 开始，请稍候');
    if(s.now>=collectEnd(r.date,c)) throw new Error('本期已于 02:25 截止收集，请参与新一期');
    if(!c.providers.includes(provider)||!c.types.includes(type)||status!=='settled'){
      log(s,r,'bet','该笔投注未结算、已退款或不在配置范围，不计任务和奖池');return {message:'该笔投注不计入有效投注',counted:false};
    }
    // Pool funding is a market-wide ledger, independent of a player's activation.
    const rtp=rtpOverride===undefined?c.rtp:rtpOverride;
    if(!Number.isFinite(rtp)||rtp<0||rtp>100)throw new Error('游戏 RTP 无效');
    r.contribution+=amount*(1-rtp/100)*c.poolShare/100;r.marketVolume=(r.marketVolume||0)+amount;
    if(!r.active){log(s,r,'bet',`激活前有效投注 ₹${amount}，不计个人任务`);return {message:'激活前投注不计入个人任务',counted:false};}
    r.validBet+=amount;log(s,r,'bet',`有效投注 +₹${amount} · ${provider}/${type} · RTP ${rtp}%`);
    return {message:'有效投注进度已更新',counted:true};
  }
  function claimTickets(s,source) {
    if(!['bet','deposit'].includes(source))throw new Error('未知奖券来源');
    const r=current(s);
    if(s.now<roundStart(r.date,r.config)) throw new Error('新一期将在 02:30 开始，请稍候');
    if(s.now>=collectEnd(r.date,r.config)) throw new Error('本期已于 02:25 截止领券，请参与新一期');
    if(!r.active)throw new Error('请先激活当期活动');
    const count=Math.min(pending(r)[source],r.config.ticketCap-r.tickets.length);
    if(count<=0)throw new Error('暂无可领取奖券');
    for(let i=0;i<count;i++){
      const serial=r.tickets.length+1;
      r.tickets.push({id:r.id.replace('JL-','')+'-U'+String(serial).padStart(4,'0'),source,claimedAt:s.now});
    }
    r.claimed[source]+=count;log(s,r,'ticket',`${source==='bet'?'投注':'充值'}任务手动领取 ${count} 张`);
    return count;
  }
  function pool(r) {
    const c=r.config;
    const elapsed=Math.max(0,Math.min(24*60-5,Math.floor((r._now||midnight(r.date)+clockMinute(c.collectionStart)*MINUTE)-roundStart(r.date,c))/MINUTE));
    const demoContribution=elapsed*c.demoPoolRatePerMinute;
    const contribution=c.marketBet*(1-c.rtp/100)*c.poolShare/100+r.contribution+demoContribution;
    const raw=c.basePool+contribution;
    return {base:c.basePool,turnover:c.marketBet+(r.marketVolume||0),contribution:Math.floor(contribution*100)/100,
      subsidy:0,total:Math.round(raw*100)/100};
  }
  function closeRound(s,r) {
    if(r.snapshot)return;
    const lost=pending(r);
    r.snapshot={tickets:copy(r.tickets),pendingExpired:lost,pool:pool(r),config:copy(r.config),closedAt:collectEnd(r.date,r.config),
      participants:r.config.participants+(r.tickets.length?1:0)};
    r.status='settling';r.audit.push({step:'close',label:'封存期次',detail:`${r.tickets.length} 张个人已领券入池；${lost.bet+lost.deposit} 张未领券失效`});
    r.audit.push({step:'reconcile',label:'核对投注与奖池',detail:'按已结算记录及配置快照核对，未结算不提前计入'});
  }
  function advance(s,target) {
    if(!Number.isFinite(target)||target<s.now)throw new Error('演示时间只能向前推进');
    if(target-s.now>31*DAY)throw new Error('一次最多推进 31 天');
    const first=dateKey(s.now),last=dateKey(target);
    for(let day=midnight(first)-DAY;day<=midnight(last);day+=DAY)ensureRound(s,dateKey(day));
    s.now=target;
    Object.values(s.rounds).forEach(r=>{
      r._now=target;
      const end=collectEnd(r.date,r.config),claim=claimEnd(r.date,r.config);
      if(target>=end)closeRound(s,r);
      if(target>=claim){r.expired=true;r.status='expired';}
    });
    return current(s);
  }
  // Deterministic demo PRNG. Production must use a server-side audited draw service.
  function random(seed) {let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
  function hash(value) {let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
  function draw(s,date,seed) {
    const r=s.rounds[date];if(!r?.snapshot)throw new Error('请先封存上一期');
    if(r.result)return r.result;
    if(r.hold)throw new Error('核对异常：先解除结算阻断');
    const snap=r.snapshot,c=snap.config,rng=random(seed);
    if(new Set(snap.tickets.map(t=>t.id)).size!==snap.tickets.length)throw new Error('开奖库存在重复券号，请先核对');
    // The draw library is keyed by round + ticket. User IDs are deliberately not unique.
    const candidates=[];
    for(let i=0;i<c.participants;i++){
      const userId='P'+String(i+1).padStart(5,'0'),name=['Ar***un','Sa***ya','Ra***sh','Pr***ya','Vi***am','Ne***ha'][i%6];
      for(let n=1;n<=Math.min(c.ticketCap,1+(i*37%100));n++)candidates.push({userId,name,ticket:r.id.replace('JL-','')+'-'+userId+'-'+String(n).padStart(3,'0')});
    }
    for(const t of snap.tickets)candidates.push({userId:'YOU',name:'You · DD10086',ticket:t.id});
    const entryCount=candidates.length,rows=[];
    for(const prize of c.prizes){
      for(let position=0;position<prize.count&&candidates.length;position++){
        const index=Math.floor(rng()*candidates.length),entry=candidates[index];
        candidates[index]=candidates[candidates.length-1];candidates.pop();
        rows.push({...entry,prize:prize.id,prizeName:prize.name,prizeEn:prize.en,rate:prize.rate,
          amount:Math.floor((snap.pool.total*100)*prize.rate/100)/100,
          drawOrder:rows.length+1});
      }
    }
    const myWins=rows.filter(row=>row.userId==='YOU');
    const my=myWins.length?{wins:myWins,count:myWins.length,amount:Math.round(myWins.reduce((n,row)=>n+row.amount,0)*100)/100,
      prizeName:myWins.length===1?myWins[0].prizeName:`共中 ${myWins.length} 个奖`}:null;
    const liability=Math.round(rows.reduce((sum,row)=>sum+row.amount,0)*100)/100;
    r.seed=seed;r.result={rows,my,liability,unallocated:Math.round((snap.pool.total-liability)*100)/100,entryCount,participants:snap.participants,
      fingerprint:hash(JSON.stringify(snap)),seed,generatedAt:s.now,algorithm:'uniform-ticket-without-replacement-v2'};
    r.audit.push({step:'freeze',label:'冻结候选集合',detail:`${entryCount.toLocaleString()} 张券 / ${snap.participants.toLocaleString()} 名用户；仅已领取奖券`});
    r.audit.push({step:'draw',label:'按奖级随机抽券',detail:`由高至低抽出 ${rows.length} 张中奖券；仅移除已中奖券，同用户其他券继续参与`});
    r.audit.push({step:'check',label:'核对开奖库与负债',detail:`唯一中奖券 ${new Set(rows.map(x=>x.ticket)).size} 张 / 中奖用户 ${new Set(rows.map(x=>x.userId)).size} 名；奖金负债 ₹${liability.toFixed(2)}，不超过锁定奖池`});
    return r.result;
  }
  function publish(s,date) {
    const r=s.rounds[date];if(!r?.result)throw new Error('先完成抽奖与结果核对');
    if(r.hold)throw new Error('核对异常未解除，暂不公布');
    if(s.now<settlementEnd(date,r.config))throw new Error('尚未到次日 02:30');
    if(s.now>=claimEnd(date,r.config))throw new Error('本期领取窗口已结束，不能公布');
    if(!r.published){r.published=true;r.status='published';r.audit.push({step:'publish',label:'公布中奖名单',detail:'结果已锁定，领取截止次日 02:30；不重复抽奖'});}
    return r;
  }
  function claimPrize(s,date) {
    const r=s.rounds[date];if(!r?.published)throw new Error('开奖结果尚未公布');
    if(stage(s,r)!=='published')throw new Error('领取期限已过');
    if(!r.result?.my)throw new Error('本期未中奖');
    if(r.claimedPrize)throw new Error('该期奖金已领取，请勿重复领取');
    const id='LOTTO:'+r.id+':YOU';
    if(s.walletEntries.some(e=>e.id===id))throw new Error('该期奖金已入账');
    const amount=r.result.my.amount;
    r.claimedPrize=true;s.wallet=Math.round((s.wallet+amount)*100)/100;
    s.walletEntries.push({id,amount,date:r.date,time:s.now});log(s,r,'prize',`手动领取 ₹${amount} 至演示钱包`);
    return amount;
  }
  function nextConfig(s,config) {
    const c={...copy(s.config),...copy(config)},errors=validate(c);
    if(errors.length)throw new Error(errors.join('；'));
    s.config=c;return c; // Existing rounds retain their configuration snapshot.
  }
  return {DAY,HOUR,MINUTE,defaults,create,validate,current,dateKey,midnight,roundId,roundStart,collectEnd,settlementEnd,claimEnd,pending,stage,deposit,bet,claimTickets,pool,advance,draw,publish,claimPrize,nextConfig,hash,random};
});
