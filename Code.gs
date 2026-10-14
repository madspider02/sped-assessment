/**
 * 特殊教育鑑定資料整合系統 v7 - GitHub Pages + Apps Script + Google Sheets
 * 只在 Apps Script 控制台執行 setupSheets()。公開端點僅提供 doPost 個案建立。
 * 本版應使用匿名測試資料先驗收；Anyone 公開部署不具備使用者身分認證。
 */
const SPREADSHEET_ID='19cXXJfry4Xr9YHs0jcWgYcpQQX9OKOzR6sxnDFGhYkc';
const GITHUB_ORIGIN='https://madspider02.github.io';
const DOMAINS_ = ['生活自理','動作與行動能力','語言與溝通','社會人際與情緒行為','學科（領域）學習表現'];
const SUBSCALES_ = ['飲食','穿著','衛生安全','動作','行動','語言','溝通','社會人際','情緒行為','語文','數學','綜合應用'];
const SUB_DOMAIN_ = [0,0,0,1,1,2,2,3,3,4,4,4];
const CATS_ = {id:['心智功能','適應行為','學科學習','發展歷程'],ld:['智力及認知','基本學業能力','有效教學介入','其他因素'],ebd:['情緒行為表現','學校適應','跨情境','介入成效'],asd:['社會溝通及互動','行為與興趣','功能影響','發展與其他因素'],dd:['年齡','發展能力','類別未明','養育環境']};
const STATUS_NAMES_ = {unknown:'尚待確認',yes:'已有佐證',no:'不支持',missing:'仍缺資料'};
function getSS_(){assert_(!SPREADSHEET_ID.startsWith('PASTE_'),'請先設定試算表ID。');return SpreadsheetApp.openById(SPREADSHEET_ID)}
function txt_(x,max=8000){return String(x===null||x===undefined?'':x).slice(0,max)}
function cell_(x){
  if(x===null||x===undefined)return '';
  if(typeof x==='number')return Number.isFinite(x)?x:'';
  const s=txt_(x,20000);
  // 防止教師的文字內容成為試算表公式。
  return /^[\s]*[=+@\-]/.test(s)?"'"+s:s;
}
function num_(x){if(x===null||x===undefined||x==='')return null;const n=Number(x);return Number.isFinite(n)?n:null}
function assert_(ok,msg){if(!ok)throw new Error(msg)}
function isDate_(x){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(x||'')))return false;
  const parts=x.split('-').map(Number),d=new Date(parts[0],parts[1]-1,parts[2]);
  return d.getFullYear()===parts[0]&&d.getMonth()===parts[1]-1&&d.getDate()===parts[2];
}
function ageMonths_(birth,when){
  if(!isDate_(birth)||!isDate_(when)||when<birth)return null;
  const b=birth.split('-').map(Number),a=when.split('-').map(Number);
  let yrs=a[0]-b[0],mo=a[1]-b[1];
  if(a[2]<b[2])mo--;
  if(mo<0){yrs--;mo+=12}
  return yrs*12+mo;
}
const HEADERS_ = {
  Cases:['case_id','submitted_at','submission_source','payload_hash','name_mode','name_or_alias','sex','birth_date','assessment_date','age_months','stage','grade','assessor','reason','strengths','history','focus_categories_json'],
  IQ_Results:['case_id','submitted_at','assessment_status','test','test_date','FSIQ','CI_low','CI_high','VCI','VSI','FRI','PRI','WMI','PSI'],
  Adaptive_General:['case_id','submitted_at','status','rater','rater_other','test_date',...['D1','D2','D3','D4','D5'].flatMap(d=>[d+'_standard',d+'_percentile']),'id_followup_trigger'],
  // 為維持現有 v4 Sheets 表頭不變，保留已停用的兩個歷史欄位；不再啟用手動覆核。
  Adaptive_ID:['case_id','submitted_at','id_followup_trigger','manual_override','override_reason',...SUBSCALES_.map((x,i)=>'scale_'+(i+1)+'_'+x),...['D1','D2','D3','D4','D5'].map(d=>d+'_mean')],
  Evidence:['case_id','submitted_at','category_key','criterion_number','criterion_name','evidence_status','evidence_note'],
  Professional_Review:['case_id','submitted_at','teacher_priority_direction','basis','educational_needs','support_recommendations','missing_evidence','acknowledged_not_diagnosis'],
  Audit_Log:['case_id','submitted_at','editor_email','action','details']
};
function setupSheets(){
  const ss=getSS_();
  Object.keys(HEADERS_).forEach(name=>{
    let sheet=ss.getSheetByName(name);if(!sheet)sheet=ss.insertSheet(name);
    const h=HEADERS_[name];
    if(sheet.getMaxColumns()<h.length)sheet.insertColumnsAfter(sheet.getMaxColumns(),h.length-sheet.getMaxColumns());
    if(sheet.getLastRow()===0){sheet.appendRow(h);sheet.setFrozenRows(1);sheet.getRange(1,1,1,h.length).setBackground('#ddebea').setFontWeight('bold')}
    else {const got=sheet.getRange(1,1,1,h.length).getValues()[0];
      if(got.some((v,i)=>v!==h[i]))throw new Error('分頁 '+name+' 為舊版表頭，請使用新試算表以免資料錯置。');}
  });
  return '七個資料分頁已完成設定。';
}
function append_(ss,name,cells){
  const sh=ss.getSheetByName(name);if(!sh)throw new Error('缺少 '+name+' 分頁，請執行 setupSheets()。');
  assert_(cells.length===HEADERS_[name].length,`${name} 欄位數不符合表頭設定。`);
  sh.appendRow(cells.map(cell_));
}
function preflightSheets_(ss){
  for(const name of Object.keys(HEADERS_)){
    const sh=ss.getSheetByName(name);
    assert_(sh&&sh.getLastRow()>=1,`資料表${name}尚未建立，請先執行 setupSheets()。`);
    const h=sh.getRange(1,1,1,HEADERS_[name].length).getValues()[0];
    assert_(h.every((x,i)=>x===HEADERS_[name][i]),`資料表${name}表頭不符合v4/v5相容版，請核對或更換新試算表。`);
  }
}
// 百分等級可能依正式手冊呈現數值、範圍或「<1」「≤3」。
// 若為範圍，只有上限不超過3才計為符合PR提示條件。
function parsePR_(value){
  const t=txt_(value,16).trim().replace(/％|%/g,'');if(!t)return null;
  let m=t.match(/^([0-9]+(?:\.[0-9]+)?)$/);
  if(m){const n=Number(m[1]);return n>=0&&n<=100?{low:n,high:n}:null}
  m=t.match(/^([0-9]+(?:\.[0-9]+)?)\s*[~～－-]\s*([0-9]+(?:\.[0-9]+)?)$/);
  if(m){const a=Number(m[1]),b=Number(m[2]);return a>=0&&a<=b&&b<=100?{low:a,high:b}:null}
  m=t.match(/^(?:<|≤|<=)\s*([0-9]+(?:\.[0-9]+)?)$/);
  if(m){const b=Number(m[1]);return b>=0&&b<=100?{low:0,high:b}:null}
  return null;
}
function idFollowup_(rows){
  if(rows.length!==5)return false;
  const hit=r=>(num_(r.standard)!==null&&num_(r.standard)<=72)||(parsePR_(r.percentile)!==null&&parsePR_(r.percentile).high<=3);
  return rows.slice(0,4).some(hit)&&hit(rows[4]);
}
function idMeans_(values){
  return [0,1,2,3,4].map(d=>{
    const v=SUB_DOMAIN_.map((x,i)=>x===d?num_(values[i]):null).filter(x=>x!==null);
    const target=SUB_DOMAIN_.filter(x=>x===d).length;
    return v.length===target?v.reduce((a,b)=>a+b,0)/target:null;
  });
}
function sha256_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8).map(b=>(b<0?b+256:b).toString(16).padStart(2,'0')).join('')}
function rowsFor_(ss,name,caseId){
 const sh=ss.getSheetByName(name),last=sh.getLastRow();
 if(last<=1)return [];
 const rows=sh.getRange(2,1,last-1,HEADERS_[name].length).getValues();
 return rows.filter(r=>String(r[0])===caseId);
}
function appendIfMissing_(ss,name,caseId,row){
 if(!rowsFor_(ss,name,caseId).length)append_(ss,name,row);
}
function doGet(){
 return HtmlService.createHtmlOutput('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><body style="font-family:sans-serif;padding:32px"><h3>特殊教育鑑定資料接收端已部署</h3><p>請回到 GitHub Pages 填寫資料；此網址不提供個案查詢。</p></body></html>');
}
function doPost(e){
 const v=e&&e.parameter||{};
 const nonce=/^[a-f0-9]{40}$/.test(String(v.nonce||''))?v.nonce:'';
 const receipt={type:'SPED_SAVE_RECEIPT',nonce,ok:false,caseId:'',message:''};
 try{
   assert_(nonce,'缺少本次提交識別碼。');
   assert_(typeof v.payload==='string'&&v.payload.length<=250000,'資料格式不正確或過大。');
   const p=JSON.parse(v.payload);
   const saved=saveCase(p);
   receipt.ok=true;receipt.caseId=saved.caseId;
 }catch(err){receipt.message=txt_(err&&err.message||'儲存失敗',220)}
 const data=JSON.stringify(receipt).replace(/</g,'\\u003c');
 const target=JSON.stringify(GITHUB_ORIGIN);
 // HtmlService 本身是 Google 隔離沙箱，從最上層頁面回報結果，不傳回任何個案內容。
 const html='<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><body><script>window.top.postMessage('+data+','+target+');<\/script></body></html>';
 return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function saveCase(p){
  assert_(p&&p.meta&&p.concerns&&p.iq&&p.adaptive&&p.review&&p.evidence,'缺少個案必要資料。');
  const m=p.meta,iq=p.iq,ad=p.adaptive,rv=p.review;
  const name=m.mode==='real'?txt_(m.name):txt_(m.alias);
  assert_(['real','anonymous'].includes(m.mode)&&name.trim(),'請選擇真實姓名或匿名，並填寫個案識別名稱。');
  assert_(txt_(m.sex).trim()&&txt_(m.stage).trim()&&txt_(m.assessor).trim(),'請完成基本資料。');
  assert_(isDate_(m.dob)&&isDate_(m.assessDate)&&m.assessDate>=m.dob,'出生日期或評量基準日期不正確。');
  assert_(txt_(p.concerns.reason).trim().length>=8,'轉介原因至少需8個字。');
  assert_(rv.agreement===true&&txt_(rv.basis).trim(),'請完成教師初步研判與確認。');
  if(iq.status==='done'){
    assert_(['WPPSI4','WISC4','WISC5'].includes(iq.test),'請選擇魏氏測驗版本。');
    assert_(isDate_(iq.date)&&iq.date>=m.dob,'智力測驗施測日期不正確。');
    if(num_(iq.FSIQ)!==null)assert_(num_(iq.FSIQ)>=30&&num_(iq.FSIQ)<=160,'智力測驗全量表分數超出輸入範圍。');
    if(num_(iq.CI_low)!==null&&num_(iq.CI_high)!==null)assert_(num_(iq.CI_low)<=num_(iq.CI_high),'智力信賴區間上下限錯誤。');
  }
  let general=Array.isArray(ad.general)?ad.general:[],trigger=false,showID=false;
  if(ad.status==='done'){
    assert_(isDate_(ad.date)&&ad.date>=m.dob,'檢核日期不正確。');
    assert_(['導師','教保員','特教教師','其他'].includes(ad.rater),'請選擇填寫者身分。');
    if(ad.rater==='其他')assert_(txt_(ad.raterOther).trim(),'請說明其他填寫者身分。');
    assert_(general.length===5,'一般學生組須輸入五向度。');
    const age=ageMonths_(m.dob,ad.date);
    assert_(age!==null&&age>=36&&age<216,'社會適應表現檢核表一般學生組須確認3至17歲的適用年齡。');
    general.forEach((g,i)=>{
      const n=num_(g.standard);
      assert_(n!==null&&n>=0&&n<=200&&parsePR_(g.percentile)!==null,`一般學生組第${i+1}向度標準分數或PR不正確。`);
    });
    trigger=idFollowup_(general);showID=trigger;
  } else {general=[]}
  const scales=Array.isArray(ad.idScores)?ad.idScores:[];
  if(showID){
    assert_(scales.length===12,'智能障礙學生組的十二個分量表欄位缺失。');
    assert_(scales.every(x=>x===null||x===''||(num_(x)!==null&&num_(x)>=0)),'智能障礙學生組各分量表分數不能是負值或文字。');
  }
  const age=ageMonths_(m.dob,m.assessDate);
  const now=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm:ss');
  assert_(/^[0-9a-f-]{32,40}$/i.test(String(p.clientCaseId||'')),'缺少有效的個案編號。');
  const caseId=String(p.clientCaseId);
  const hash=sha256_(JSON.stringify(p));
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    const ss=getSS_();preflightSheets_(ss);
    const existing=rowsFor_(ss,'Cases',caseId);
    if(existing.length){
      const h=HEADERS_.Cases, hashCol=h.indexOf('payload_hash');
      assert_(existing.length===1,'後台存在重複個案編號，請聯繫管理員。');
      assert_(existing[0][hashCol]===hash,'同個案編號的資料已變更；請重新整理後以新個案編號提交，避免覆寫。');
    }
    const base=[caseId,existing.length?existing[0][1]:now];
    if(!existing.length)append_(ss,'Cases',[...base,'GitHubPages',hash,m.mode,name,m.sex,m.dob,m.assessDate,age,m.stage,m.grade,m.assessor,p.concerns.reason,p.concerns.strengths,p.concerns.history,JSON.stringify(p.concerns.focus||[])]);
    const idx=iq.status==='done'?(iq.index||{}):{};
    appendIfMissing_(ss,'IQ_Results',caseId,[...base,iq.status,iq.status==='done'?iq.test:'',iq.status==='done'?iq.date:'',iq.status==='done'?iq.FSIQ:'',iq.status==='done'?iq.CI_low:'',iq.status==='done'?iq.CI_high:'',idx.VCI,idx.VSI,idx.FRI,idx.PRI,idx.WMI,idx.PSI]);
    const generalCells=DOMAINS_.flatMap((_,i)=>ad.status==='done'?[general[i].standard,txt_(general[i].percentile,16)]:['','']);
    appendIfMissing_(ss,'Adaptive_General',caseId,[...base,ad.status,ad.status==='done'?ad.rater:'',ad.status==='done'&&ad.rater==='其他'?ad.raterOther:'',ad.status==='done'?ad.date:'',...generalCells,trigger?'YES':'NO_OR_NOT_ASSESSED']);
    const kept=showID?scales:[];
    appendIfMissing_(ss,'Adaptive_ID',caseId,[...base,trigger?'YES':'NO_OR_NOT_ASSESSED',false,'',...SUBSCALES_.map((_,i)=>kept[i]??''),...idMeans_(kept).map(x=>x===null?'':x)]);
    const eSheet=ss.getSheetByName('Evidence');
    const oldEv=new Set(rowsFor_(ss,'Evidence',caseId).map(r=>r[2]+'|'+r[3]));
    const addEvidence=[];
    for(const cat of Object.keys(CATS_)){
      const answers=Array.isArray(p.evidence[cat])?p.evidence[cat]:[];
      CATS_[cat].forEach((title,i)=>{
        if(oldEv.has(cat+'|'+(i+1)))return;
        const q=answers[i]||{};
        addEvidence.push([...base,cat,i+1,title,STATUS_NAMES_[q.status]?q.status:'unknown',q.note||''].map(cell_));
      });
    }
    if(addEvidence.length){
      const start=eSheet.getLastRow()+1;
      if(eSheet.getMaxRows()<start+addEvidence.length-1)eSheet.insertRowsAfter(eSheet.getMaxRows(),start+addEvidence.length-1-eSheet.getMaxRows());
      eSheet.getRange(start,1,addEvidence.length,HEADERS_.Evidence.length).setValues(addEvidence);
    }
    appendIfMissing_(ss,'Professional_Review',caseId,[...base,rv.category,rv.basis,rv.needs,rv.supports,rv.gaps,true]);
    appendIfMissing_(ss,'Audit_Log',caseId,[...base,'GitHubPages','CREATE_CASE','個案已儲存，待教師人工綜合研判']);
    return {caseId,submittedAt:base[1],reused:existing.length>0};
  } finally {lock.releaseLock()}
}
