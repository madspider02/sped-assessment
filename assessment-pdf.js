'use strict';
/** Browser-only PDF export: SVG/Chinese text are drawn with the user's browser fonts.
 * No student data is sent to a PDF API; no remote PDF libraries are loaded.
 * Produces an image-based, A4 multipage PDF. Browser Print remains the text-selectable option.
 */
(function(){
 const CW=1240,CH=1754,LEFT=78,RIGHT=78,TOP=108,BOTTOM=130;
 const A4W=595.28,A4H=841.89;
 const fontFamily='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
 const textEncoder=new TextEncoder();
 function bytes(s){return textEncoder.encode(s)}
 function val(s){return String(s??'').replace(/\s+/g,' ').trim()||'-'}
 function formatFont(ctx,size=23,bold=false){ctx.font=`${bold?'700':'400'} ${size}px ${fontFamily}`}
 function textWrap(ctx,text,width){
   const out=[];String(text??'').split(/\r?\n/).forEach(line=>{
     if(!line.trim()){out.push('');return}
     let part='';
     for(const char of line){const trial=part+char;if(part&&ctx.measureText(trial).width>width){out.push(part);part=char;}else part=trial}
     if(part)out.push(part);
   });return out.length?out:[''];
 }
 async function toJpeg(canvas){
   const blob=await new Promise((ok,bad)=>canvas.toBlob(x=>x?ok(x):bad(new Error('Canvas export failed')),'image/jpeg',0.90));
   return new Uint8Array(await blob.arrayBuffer());
 }
 function encodePdf(images){
   const chunks=[],positions=[0];let size=0;
   const add=x=>{chunks.push(x);size+=x.length};
   const push=x=>add(typeof x==='string'?bytes(x):x);
   function object(n,part){positions[n]=size;push(`${n} 0 obj\n`);for(const x of part)push(x);push('\nendobj\n')}
   push('%PDF-1.4\n% SPED assessment - local PDF export\n');
   const pageNums=images.map((_,i)=>3+i*3);
   object(1,[`<< /Type /Catalog /Pages 2 0 R >>`]);
   object(2,[`<< /Type /Pages /Kids [${pageNums.map(n=>n+' 0 R').join(' ')}] /Count ${images.length} >>`]);
   images.forEach((image,i)=>{
     const page=3+i*3,contents=page+1,im=page+2;
     object(page,[`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4W} ${A4H}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${contents} 0 R >>`]);
     const stream=`q\n${A4W} 0 0 ${A4H} 0 0 cm\n/Im0 Do\nQ\n`;
     object(contents,[`<< /Length ${bytes(stream).length} >>\nstream\n`,stream,'endstream']);
     object(im,[`<< /Type /XObject /Subtype /Image /Width ${CW} /Height ${CH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`,image,'\nendstream']);
   });
   const startXref=size;
   push(`xref\n0 ${positions.length}\n0000000000 65535 f \n`);
   for(let i=1;i<positions.length;i++)push(`${String(positions[i]).padStart(10,'0')} 00000 n \n`);
   push(`trailer\n<< /Size ${positions.length} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`);
   return new Blob(chunks,{type:'application/pdf'});
 }
 function createPainter(caseId){
   let canvas,ctx,y=TOP,number=0;
   const pages=[];
   function drawHeaderFooter(){
      ctx.fillStyle='#144750';ctx.fillRect(0,0,CW,14);
      formatFont(ctx,19,true);ctx.fillStyle='#183f49';ctx.fillText('SPECIAL EDUCATION  |  ASSESSMENT SUMMARY',LEFT,67);
      ctx.strokeStyle='#c6d8db';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(LEFT,CH-88);ctx.lineTo(CW-RIGHT,CH-88);ctx.stroke();
      formatFont(ctx,17);ctx.fillStyle='#557078';ctx.fillText('\u7cfb\u7d71\u7814\u767c\u8005\uff1a\u570b\u5bb6\u6559\u80b2\u7814\u7a76\u9662\u9ec3\u5f65\u878d\u526f\u7814\u7a76\u54e1',LEFT,CH-48);
      ctx.textAlign='right';ctx.fillText(`${number}`,CW-RIGHT,CH-48);ctx.textAlign='left';
   }
   function newPage(){
     canvas=document.createElement('canvas');canvas.width=CW;canvas.height=CH;
     ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('Canvas unavailable');
     ctx.fillStyle='#fff';ctx.fillRect(0,0,CW,CH);number++;
     pages.push(canvas);y=TOP;drawHeaderFooter();
   }
   function room(px){if(y+px>CH-BOTTOM)newPage()}
   function gap(px){room(px);y+=px}
   function line(s,options={}){
     const size=options.size||23,lh=options.lineHeight||size+12,x=options.x??LEFT,w=options.width??CW-LEFT-RIGHT;
     formatFont(ctx,size,!!options.bold);const lines=textWrap(ctx,s,w);
     for(const text of lines){room(lh+4);formatFont(ctx,size,!!options.bold);ctx.fillStyle=options.color||'#233b43';ctx.fillText(text,x,y+size);y+=lh;}
   }
   function heading(s,major=false){
     room(major?104:67);gap(major?24:18);
     line(val(s),{size:major?36:28,bold:true,color:major?'#17434c':'#196a72'});
     gap(major?12:5);
     ctx.strokeStyle='#cadedd';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(LEFT,y+3);ctx.lineTo(CW-RIGHT,y+3);ctx.stroke();gap(11);
   }
   function para(s,muted=false){line(val(s),{size:muted?19:23,color:muted?'#61767b':'#203b43'});gap(9)}
   function pairs(dl){
     const dts=[...dl.querySelectorAll(':scope > dt')],dds=[...dl.querySelectorAll(':scope > dd')];
     for(let i=0;i<Math.min(dts.length,dds.length);i++){
       const key=val(dts[i].textContent),value=val(dds[i].textContent);
       const labelW=270,valueW=CW-LEFT-RIGHT-labelW-26;
       formatFont(ctx,22);const left=textWrap(ctx,key,labelW),right=textWrap(ctx,value,valueW);let at=0;
       while(at<Math.max(left.length,right.length)){
         const n=Math.min(Math.max(1,Math.floor((CH-BOTTOM-y-22)/33)),Math.max(left.length,right.length)-at);
         if(n<=0){newPage();continue}
         room(33*n+20);ctx.fillStyle='#f3f8f8';ctx.fillRect(LEFT,y,CW-LEFT-RIGHT,33*n+14);
         for(let j=0;j<n;j++){
           const ll=left[at+j],rr=right[at+j];
           if(ll!==undefined){formatFont(ctx,21,true);ctx.fillStyle='#375a62';ctx.fillText(ll,LEFT+13,y+27+j*33)}
           if(rr!==undefined){formatFont(ctx,22);ctx.fillStyle='#22383f';ctx.fillText(rr,LEFT+labelW+20,y+27+j*33)}
         }
         y+=33*n+19;at+=n;
       }
     }
     gap(10);
   }
   function table(node){
     const heads=[...node.querySelectorAll('thead tr:first-child th')].map(x=>val(x.textContent));
     const rows=[...node.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(x=>val(x.textContent)));
     if(!heads.length)return;
     let widths;
     const W=CW-LEFT-RIGHT;
     if(heads.length===2)widths=[W*.3,W*.7];
     else if(heads.length===3)widths=[W*.28,W*.22,W*.50];
     else widths=Array(heads.length).fill(W/heads.length);
     function drawHeader(){
       room(58);ctx.fillStyle='#dfeeed';ctx.fillRect(LEFT,y,W,52);let x=LEFT;
       heads.forEach((h,i)=>{formatFont(ctx,20,true);ctx.fillStyle='#244d55';const txt=textWrap(ctx,h,widths[i]-18)[0]||'';ctx.fillText(txt,x+9,y+34);x+=widths[i];});y+=55;
     }
     drawHeader();
     for(let r=0;r<rows.length;r++){
       formatFont(ctx,21);const lines=rows[r].map((s,i)=>textWrap(ctx,s,widths[i]-20));
       let start=0;const max=Math.max(...lines.map(l=>l.length));
       while(start<max){
         let available=Math.floor((CH-BOTTOM-y-18)/31);
         if(available<1){newPage();drawHeader();available=Math.floor((CH-BOTTOM-y-18)/31)}
         const count=Math.min(max-start,available,25),h=Math.max(43,31*count+14);
         room(h);ctx.fillStyle=(r%2===0?'#fff':'#f7fafb');ctx.fillRect(LEFT,y,W,h);
         let x=LEFT;lines.forEach((ls,i)=>{
           ctx.strokeStyle='#dfebec';ctx.strokeRect(x,y,widths[i],h);
           formatFont(ctx,21);ctx.fillStyle='#263f46';for(let j=0;j<count;j++){const t=ls[start+j];if(t!==undefined)ctx.fillText(t,x+10,y+29+31*j)}x+=widths[i];
         });y+=h;start+=count;
       }
     }
     gap(17);
   }
   async function chart(svg){
     if(!svg)return;
     const h=380;room(h+24);
     const src=new XMLSerializer().serializeToString(svg);
     const patched=src.includes('xmlns=')?src:src.replace('<svg','<svg xmlns="http://www.w3.org/2000/svg"');
     const url=URL.createObjectURL(new Blob([patched],{type:'image/svg+xml;charset=utf-8'}));
     try{
       const image=new Image();image.src=url;
       await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});
       ctx.drawImage(image,LEFT+35,y,Math.min(CW-LEFT-RIGHT-70,940),h-26);
     }catch(e){para('Chart omitted; numerical table above remains authoritative.',true)}
     finally{URL.revokeObjectURL(url)}
     y+=h+11;
   }
   newPage();return {pages,heading,para,pairs,table,chart,gap};
 }
 async function downloadFromReport(reportRoot,caseId){
   if(!reportRoot?.children?.length)throw new Error('Report is not ready');
   const p=createPainter(caseId);
   p.heading('\u7279\u6b8a\u6559\u80b2\u9451\u5b9a\u8cc7\u6599\u6574\u5408\u6458\u8981',true);
   p.para(`Case ID: ${caseId}`,true);
   p.para('\u6559\u5e2b\u521d\u6b65\u8cc7\u6599\uff5c\u975e\u6b63\u5f0f\u9451\u5b9a\u7d50\u679c',true);
   for(const node of reportRoot.querySelector('section')?.children||reportRoot.children){
     if(node.classList?.contains('reporthead'))continue;
     switch(node.tagName){
       case 'H2':p.heading(node.textContent,true);break;
       case 'H3':p.heading(node.textContent);break;
       case 'P':p.para(node.textContent,node.classList?.contains('tiny'));break;
       case 'DL':p.pairs(node);break;
       default:
         if(node.classList?.contains('tablewrap'))p.table(node.querySelector('table'));
         else if(node.classList?.contains('chart'))await p.chart(node.querySelector('svg'));
     }
     if(p.pages.length>35)throw new Error('Report exceeds 35 A4 pages; use print-to-PDF instead.');
   }
   const images=[];for(const page of p.pages)images.push(await toJpeg(page));
   const pdf=encodePdf(images);
   const name=`SPED_Assessment_${String(caseId).slice(0,8)}.pdf`;
   const url=URL.createObjectURL(pdf),a=document.createElement('a');a.download=name;a.href=url;document.body.append(a);a.click();a.remove(); // Keep the blob URL until re-generation/reload for a Safari-compatible manual download.
   return {name,pages:p.pages.length,size:pdf.size,url};
 }
 window.AssessmentPdf={downloadFromReport,_internal:{encodePdf}};
})();
