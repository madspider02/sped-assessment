# 特殊教育鑑定資料整合系統 v7.0

**系統研發者：國家教育研究院黃彥融副研究員**

系統網址：<https://madspider02.github.io/sped-assessment/>

使用架構：**GitHub Pages → Google Apps Script → 私人 Google Sheets → 瀏覽器下載 PDF**。不需要 Firebase，也沒有寄送電子郵件功能。

## 這次調整

1. 按下「確認資料並形成PDF」後，移除「正在傳送至 Google Sheets。請保持此頁面開啟，等待後台確認。」的訊息。送出期間僅在按鈕顯示「資料儲存中…」，收到後台回覆後才顯示儲存結果並下載 PDF。
2. **完全移除寄信功能**：第 07 步沒有 Email 欄位、寄送選項或重試寄送按鈕；Apps Script 不再使用 `MailApp`、Google Docs、Drive 生成信件附件，也不需要收件白名單和郵件授權。
3. 其餘七步驟、五類鑑定資料、符合條件自動顯示智能障礙學生組、既有七個 Sheets 分頁、PDF 下載與重試儲存流程不變。

## 更新方式（先 Apps Script、再 GitHub）

### 1. Google Apps Script

1. 開啟原本已部署、使用同一 Google Sheets 的 Apps Script 專案。
2. **先備份舊的 `Code.gs`**，再用本壓縮檔的 `Code.gs` 全文取代。新版已保留此前使用的試算表 ID；如曾換 Sheet，請先核對 `SPREADSHEET_ID`。
3. 按「儲存」。選 **部署 → 管理部署作業 → 編輯（鉛筆圖示） → 版本：新增版本 → 部署**。請編輯既有部署，網址才能保持原來的 `/exec`。
4. 舊有 Google Sheets 的七個分頁及資料可以沿用，**不需刪除資料或重新執行 `setupSheets()`**。
5. **不必執行 `authorizeEmailReport`**，新版沒有這項功能。

### 2. GitHub

1. 解壓縮 `sped-assessment-github-upload-v7.zip`。
2. 將 `index.html`（小寫 i）與 `assessment-pdf.js` 上傳到 <https://github.com/madspider02/sped-assessment> 根目錄，直接取代同名檔。
3. 按 **Commit changes**，等待 Pages 部署。程式已填入原先提供的 Apps Script `/exec` 網址，不用重新貼。
4. 開啟 <https://madspider02.github.io/sped-assessment/>。若仍顯示舊版，請強制重新整理或開啟無痕視窗。

### 3. 使用虛構個案驗收

1. 第 07 步不應有 Email 欄位；送出後也不應看到被刪除的長句。
2. 提交後，按鈕會暫時顯示「資料儲存中…」；後台確定成功才出現個案編號及 PDF 下載。
3. 在 Google Sheets 確認同一 `case_id` 出現在既有資料分頁；`Audit_Log` 新增 `CREATE_CASE` 紀錄。
4. 不應產生寄信要求、寄信狀態或附檔郵件。舊版本曾經寄出的信件和歷史 `EMAIL_*` 紀錄，不會被新程式刪除。

## 檔案位置

| 檔案 | 位置 |
| --- | --- |
| `index.html` | GitHub 儲存庫根目錄 |
| `assessment-pdf.js` | GitHub 儲存庫根目錄 |
| `Code.gs` | Google Apps Script 專案（不要放在公開 GitHub） |

## 資料安全

此版本仍是公開 GitHub Pages 搭配 Apps Script 接收資料，**未提供登入驗證或實際寫入存取限制**。即使 Sheet 本身沒有公開分享，公開可呼叫的 Apps Script 端點仍可能遭他人提交資料。請先以虛構資料測試；若要收集可識別學生的評量及測驗分數，應先符合機構個資與資訊安全規定。
