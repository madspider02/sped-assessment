/**
 * 特殊教育鑑定資料整合系統 v6 - GitHub Pages + Apps Script + Google Sheets + email PDF
 * 只在 Apps Script 控制台執行 setupSheets()。公開端點僅提供 doPost 個案建立。
 * 本版應使用匿名測試資料先驗收；Anyone 公開部署不具備使用者身分認證。
 */
const SPREADSHEET_ID='19cXXJfry4Xr9YHs0jcWgYcpQQX9OKOzR6sxnDFGhYkc';
// 寄送 PDF 的最小收件限制。請在此填入「允許收信」的教師信箱或學校網域。
// 兩個清單都為空時，只儲存 Sheets 與提供本機 PDF，不會寄送個案報告。
// 注意：這只能限制收件對象，無法把公開 GitHub + Apps Script 變成封閉登入系統。
const EMAIL_ALLOWED_ADDRESSES_ = []; // 範例：['teacher@example.edu.tw']
const EMAIL_ALLOWED_DOMAINS_ = []; // 範例：['example.edu.tw']（不含 @）
const EMAIL_PER_RECIPIENT_DAILY_LIMIT_ = 10;

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
 const receipt={type:'SPED_SAVE_RECEIPT',nonce,ok:false,caseId:'',message:'',emailStatus:'not_requested',emailMessage:''};
 try{
   assert_(nonce,'缺少本次提交識別碼。');
   assert_(typeof v.payload==='string'&&v.payload.length<=250000,'資料格式不正確或過大。');
   const p=JSON.parse(v.payload);
   const saved=saveCase(p);
   receipt.ok=true;receipt.caseId=saved.caseId;
   // 先確保 Sheet 寫入成功，才嘗試寄 PDF。信件錯誤不影響已儲存的資料。
   try{
     const mail=sendReportEmail_(p,saved.caseId);
     receipt.emailStatus=mail.status;
     receipt.emailMessage=mail.message||'';
   }catch(mailErr){receipt.emailStatus='failed';receipt.emailMessage=txt_(mailErr&&mailErr.message||'郵件寄送失敗',180);}
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
  const submitterEmail=String(m.submitterEmail||'').trim();
  assert_(!submitterEmail||isEmail_(submitterEmail),'填寫者 Email 格式不正確。');
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
    appendIfMissing_(ss,'Audit_Log',caseId,[...base,submitterEmail||'GitHubPages','CREATE_CASE','個案已儲存，待教師人工綜合研判']);
    return {caseId,submittedAt:base[1],reused:existing.length>0};
  } finally {lock.releaseLock()}
}


/** 可用 Email 格式，且僅接受一位收件者（禁止 , ; 換行等）。 */
function isEmail_(value){
  const s=String(value||'').trim();
  return s.length<=254&&/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(s);
}
function mailAllowed_(email){
  const addr=String(email||'').trim().toLowerCase();
  const at=addr.lastIndexOf('@'),domain=addr.slice(at+1);
  return EMAIL_ALLOWED_ADDRESSES_.some(s=>String(s).trim().toLowerCase()===addr)||
    EMAIL_ALLOWED_DOMAINS_.some(s=>String(s).trim().replace(/^@/,'').toLowerCase()===domain);
}
function stamp_(){return Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm:ss')}
function logMail_(ss,caseId,email,action,details){
  append_(ss,'Audit_Log',[caseId,stamp_(),email,action,txt_(details,300)]);
}
function getMailEntries_(ss,caseId,email){
  return rowsFor_(ss,'Audit_Log',caseId).filter(r=>String(r[2]).toLowerCase()===email.toLowerCase()&&/^EMAIL_/.test(String(r[3])));
}
function mailDailyCount_(ss,email){
  const sheet=ss.getSheetByName('Audit_Log'),last=sheet.getLastRow();
  if(last<=1)return 0;
  const records=sheet.getRange(2,1,last-1,5).getValues();
  const today=stamp_().slice(0,10);
  return records.filter(r=>String(r[2]).toLowerCase()===email.toLowerCase()&&r[3]==='EMAIL_SENT'&&String(r[1]).slice(0,10)===today).length;
}

/**
 * 先以 Audit_Log 的 EMAIL_PENDING 預留寄送權，避免網路逾時後重送同一筆個案。
 * 正式信件寄送成功才寫 EMAIL_SENT；出錯則 EMAIL_FAILED，可再次嘗試。
 */
function sendReportEmail_(p,caseId){
  const email=String(p.meta.submitterEmail||'').trim().toLowerCase();
  if(!email)return {status:'not_requested'};
  if(!isEmail_(email))return {status:'failed',message:'填寫者 Email 格式不正確。'};
  if(!mailAllowed_(email))return {status:'failed',message:'此信箱尚未列入後端核准的收件清單，請聯繫系統管理員。'};
  let lock=LockService.getScriptLock();
  try{
    lock.waitLock(20000);
    const ss=getSS_(),history=getMailEntries_(ss,caseId,email);
    const last=history.length?String(history[history.length-1][3]):'';
    if(history.some(r=>r[3]==='EMAIL_SENT'))return {status:'already_sent'};
    if(last==='EMAIL_PENDING')return {status:'pending'};
    if(mailDailyCount_(ss,email)>=EMAIL_PER_RECIPIENT_DAILY_LIMIT_)
      return {status:'failed',message:'這個信箱已達當日寄送上限。'};
    if(MailApp.getRemainingDailyQuota()<1)
      return {status:'failed',message:'Google 帳號今日寄送額度已用完。'};
    logMail_(ss,caseId,email,'EMAIL_PENDING','正在產生及寄送 PDF');
  }catch(err){return {status:'failed',message:txt_(err&&err.message||'寄送檢查失敗',180)}}
  finally{try{lock.releaseLock()}catch(e){}}
  let mailReallySent=false;
  try{
    const pdf=createReportPdf_(p,caseId);
    if(pdf.getBytes().length>12*1024*1024)throw new Error('PDF 超過12MB，請由瀏覽器下載。');
    MailApp.sendEmail({
      to:email,
      subject:'【特殊教育鑑定資料整合系統】評量資料摘要（個案編號 '+caseId.slice(0,8)+'）',
      body:'您好：\n\n您提交的特殊教育鑑定資料已存入系統，附件為 PDF 整合摘要。\n' +
        '本資料涉及學生／幼兒個人與評量資訊，請妥善保管，勿任意轉寄。\n' +
        '本摘要為教師蒐集及初步研判資料，不是正式鑑定結果。\n\n' +
        '系統研發者：國家教育研究院黃彥融副研究員',
      attachments:[pdf],name:'特殊教育鑑定資料整合系統'
    });
    mailReallySent=true;
    lock=LockService.getScriptLock();lock.waitLock(20000);
    try{logMail_(getSS_(),caseId,email,'EMAIL_SENT','PDF 已交由 Google 郵件服務寄送')}
    finally{lock.releaseLock()}
    return {status:'sent'};
  }catch(err){
    // 郵件發出後若只是『寫入寄送成功紀錄』出錯，不能宣稱寄送失敗並允許重寄。
    if(mailReallySent)return {status:'pending',message:'信件已交由 Google 寄送，但後台紀錄未確認；請勿重複送出。'};
    try{lock=LockService.getScriptLock();lock.waitLock(20000);
      try{logMail_(getSS_(),caseId,email,'EMAIL_FAILED',txt_(err&&err.message||'郵件寄送失敗',200))}
      finally{lock.releaseLock()}
    }catch(logErr){
      // 仍保留 EMAIL_PENDING；避免本次可能成功寄出卻無紀錄時，重送造成重複郵件。
      return {status:'pending',message:'寄信狀態無法確認；請先查看信箱或後台紀錄。'};
    }
    return {status:'failed',message:txt_(err&&err.message||'PDF 寄送失敗',180)};
  }
}

/**
 * 後端自動產生 PDF：不將真實個案資料傳到第三方 PDF 服務。
 * 這份郵寄 PDF 與瀏覽器下載版採相同內容欄位，但版型可略有不同。
 * 暫存的 Google Doc 在轉換後即移至垃圾桶；Email 附件本身仍由收件人管理。
 */
function createReportPdf_(p,caseId){
  const m=p.meta,c=p.concerns,iq=p.iq,ad=p.adaptive,rv=p.review;
  const filename='SPED_Assessment_'+caseId.slice(0,8)+'.pdf';
  const doc=DocumentApp.create('SPED_report_temp_'+caseId);
  const id=doc.getId();
  try{
    const body=doc.getBody();
    body.appendParagraph('特殊教育鑑定資料整合摘要').setHeading(DocumentApp.ParagraphHeading.TITLE);
    body.appendParagraph('教師初步資料｜非正式鑑定結果');
    body.appendParagraph('個案編號：'+caseId);
    function heading(s){body.appendParagraph(s).setHeading(DocumentApp.ParagraphHeading.HEADING2)}
    function rowList(rows){for(const [label,value] of rows)body.appendParagraph(label+'：'+txt_(value===null||value===undefined||value===''?'—':value,6000))}
    function grid(heads,rows){
      const table=[heads.map(x=>String(x)),...rows.map(r=>r.map(x=>txt_(x===null||x===undefined||x===''?'—':x,6000)))];
      body.appendTable(table);
    }
    heading('一、基本資料');
    rowList([
      ['姓名形式',m.mode==='real'?'真實姓名':'匿名'],['個案識別',m.mode==='real'?m.name:m.alias],
      ['性別',m.sex],['出生日期',m.dob],['評量日期',m.assessDate],['教育階段',m.stage],
      ['年級／班別',m.grade],['填寫教師／評估人員',m.assessor]
    ]);
    heading('二、學習與適應困難');
    rowList([['轉介原因及主要困難',c.reason],['優勢與興趣',c.strengths],['發展史及既有服務',c.history],
      ['優先蒐集的鑑定方向',(c.focus||[]).map(k=>({id:'智能障礙',ld:'學習障礙',ebd:'情緒行為障礙',asd:'自閉症',dd:'發展遲緩'}[k]||k)).join('、')]]);
    heading('三、認知能力評估');
    rowList([['測驗狀態',iq.status],['測驗版本',iq.test],['施測日期',iq.date],['全量表（FSIQ）',iq.FSIQ],
      ['95%信賴區間',txt_(iq.CI_low||'—')+'～'+txt_(iq.CI_high||'—')]]);
    if(iq.status==='done')grid(['組合分數','分數'],Object.entries(iq.index||{}).map(([name,value])=>[name,value]));
    heading('四、適應行為｜社會適應表現檢核表（第二版）');
    if(ad.status==='done'){
      rowList([['評量者',ad.rater==='其他'?ad.raterOther:ad.rater],['評量日期',ad.date]]);
      const general=ad.general||[];
      grid(['向度','一般學生組標準分數','百分等級'],DOMAINS_.map((d,i)=>[d,general[i]?.standard,general[i]?.percentile]));
      lineChart_(body,DOMAINS_,general.map(x=>num_(x.standard)),'一般學生組標準分數');
      if(idFollowup_(general)){
        const scores=ad.idScores||[];
        heading('智能障礙學生組｜分量表與平均分數');
        grid(['分量表','量表分數'],SUBSCALES_.map((name,i)=>[name,scores[i]]));
        const avgs=idMeans_(scores);
        grid(['向度','平均量表分數'],DOMAINS_.map((d,i)=>[d,avgs[i]===null?'—':avgs[i].toFixed(2)]));
        lineChart_(body,DOMAINS_,avgs,'智能障礙學生組平均量表分數');
      }
    }else rowList([['社會適應表現檢核表',ad.status==='none'?'尚無資料':'未使用本量表']]);
    heading('五、五類鑑定方向的多元評量證據');
    for(const [key,titles] of Object.entries(CATS_)){
      const catName={id:'智能障礙',ld:'學習障礙',ebd:'情緒行為障礙',asd:'自閉症',dd:'發展遲緩'}[key];
      body.appendParagraph(catName).setHeading(DocumentApp.ParagraphHeading.HEADING3);
      const list=Array.isArray(p.evidence[key])?p.evidence[key]:[];
      grid(['鑑定基準','蒐集狀態','證據說明'],titles.map((title,i)=>[title,STATUS_NAMES_[(list[i]||{}).status]||'尚待確認',(list[i]||{}).note||'—']));
    }
    heading('六、專業研判與教育支持需求');
    rowList([['優先討論方向',rv.category],['主要證據',rv.basis],['教育需求',rv.needs],['課程調整與支持服務',rv.supports],['待補充或不同意見',rv.gaps]]);
    body.appendParagraph('本摘要用於多元資料整理與教師初步研判，不能取代鑑輔會法定鑑定程序。');
    body.appendParagraph('系統研發者：國家教育研究院黃彥融副研究員');
    doc.saveAndClose();
    return DriveApp.getFileById(id).getAs(MimeType.PDF).setName(filename);
  }finally{
    try{DriveApp.getFileById(id).setTrashed(true)}catch(e){Logger.log('暫存文件清除失敗：'+e.message)}
  }
}
function lineChart_(body,domains,scores,title){
  try{
    if(typeof Charts==='undefined')return;
    if(scores.length!==5||scores.some(x=>x===null||!Number.isFinite(x)))return;
    const data=Charts.newDataTable();
    data.addColumn(Charts.ColumnType.STRING,'向度');data.addColumn(Charts.ColumnType.NUMBER,'分數');
    domains.forEach((d,i)=>data.addRow([d,Number(scores[i])]));
    const chart=Charts.newLineChart().setDataTable(data.build()).setDimensions(580,270).setTitle(title).build();
    body.appendImage(chart.getBlob());
  }catch(err){Logger.log('折線圖未插入：'+err.message)}
}

/** 初次啟用時在 Apps Script 編輯器執行一次，完成寄信／文件匯出權限授予。 */
function authorizeEmailReport(){
  const quota=MailApp.getRemainingDailyQuota();
  const temp=DocumentApp.create('SPED_mail_permission_check');
  try{
    temp.getBody().appendParagraph('PDF 報告寄送權限測試');temp.saveAndClose();
    DriveApp.getFileById(temp.getId()).getAs(MimeType.PDF);
  }finally{DriveApp.getFileById(temp.getId()).setTrashed(true)}
  Logger.log('寄信權限已確認；目前剩餘收件者額度：'+quota);
}
