// ==UserScript==
// @name         STV Auto Farmer
// @namespace    http://tampermonkey.net/
// @version      v1.2.0
// @description  Fix monitor freeze + pending stuck + xhr fail fallback + app/com root + no stacked countdown + pending TTL + safer next
// @author       Gemini v3.0 Pro + ChatGPT 5.2 + Soap
// @match        *://sangtacviet.com/truyen/*
// @match        *://sangtacviet.app/truyen/*
// @icon         https://sangtacviet.app/favicon.ico
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      api.telegram.org
// ==/UserScript==

(function() {
    'use strict';

    // 1. CẤU HÌNH
    const TELEGRAM_TOKEN = 'ĐIỀN_TOKEN_CỦA_BẠN_VÀO_ĐÂY';
    const TELEGRAM_CHAT_ID = 'ĐIỀN_CHAT_ID_CỦA_BẠN_VÀO_ĐÂY';

    const CONFIG = {
        minWait: 12000,
        maxWait: 15000,
        sleepTimeOnError: 1,

        // NEW: pending TTL để chống kẹt/multi-tab
        pendingTTLms: 20000, // 20s là đủ cho 1 vòng reload+spawn nút
    };

    const win = unsafeWindow;

    // ---------- Helpers (NEW) ----------
    function now() { return Date.now(); }

    // NEW: pending theo TTL để tránh kẹt/multi-tab
    function setPendingCollect(status) {
        localStorage.setItem('stv_pending_collect', status ? 'true' : 'false');
        if (status) {
            localStorage.setItem('stv_pending_collect_until', String(now() + CONFIG.pendingTTLms));
        } else {
            localStorage.setItem('stv_pending_collect_until', '0');
        }
    }

    function isPendingCollect() {
        const flag = localStorage.getItem('stv_pending_collect') === 'true';
        if (!flag) return false;

        const until = parseInt(localStorage.getItem('stv_pending_collect_until') || '0');
        if (until > 0 && now() > until) {
            // hết hạn -> auto clear để không kẹt vĩnh viễn
            localStorage.setItem('stv_pending_collect', 'false');
            localStorage.setItem('stv_pending_collect_until', '0');
            return false;
        }
        return true;
    }

    //  Lấy truyện gốc từ URL (FIX: support .com + .app)
    function getStoryRoot(url) {
        // dạng: https://sangtacviet.(com|app)/truyen/nguon/loai/id_truyen/...
        let match = url.match(/(https:\/\/sangtacviet\.(?:com|app)\/truyen\/[^\/]+\/\d+\/\d+)/);
        if (match) return match[1] + '/';
        return url;
    }

    // --- Cập nhật tiến độ ---
    function updateCurrentChapterToStorage() {
        let list = getStoryList();
        let currentUrl = location.href;
        let currentRoot = getStoryRoot(currentUrl);

        for (let i = 0; i < list.length; i++) {
            if (getStoryRoot(list[i]) === currentRoot) {
                if (list[i] !== currentUrl) {
                    list[i] = currentUrl;
                    saveStoryList(list);
                    console.log("🔖 Đã cập nhật Bookmark:", currentUrl);
                }
                setCurrentStoryIndex(i);
                return;
            }
        }
    }

    // 2. QUẢN LÝ DỮ LIỆU & TRẠNG THÁI
    function getStoryList() { return JSON.parse(localStorage.getItem('stv_story_list') || '[]'); }
    function saveStoryList(list) { localStorage.setItem('stv_story_list', JSON.stringify(list)); }

    function getCurrentStoryIndex() { return parseInt(localStorage.getItem('stv_current_story_index') || '0'); }
    function setCurrentStoryIndex(index) { localStorage.setItem('stv_current_story_index', index); }

    function isAutoRunning() { return localStorage.getItem('stv_auto_farm') === 'true'; }

    function getErrorStreak() { return parseInt(localStorage.getItem('stv_error_streak') || '0'); }
    function increaseErrorStreak() { localStorage.setItem('stv_error_streak', getErrorStreak() + 1); }
    function resetErrorStreak() { localStorage.setItem('stv_error_streak', '0'); }

    function getSleepUntil() { return parseInt(localStorage.getItem('stv_sleep_until') || '0'); }
    function setSleepUntil(timestamp) { localStorage.setItem('stv_sleep_until', timestamp); }

    // 3. HỆ THỐNG TELEGRAM
    function sendTele(msg, type = 'info', callback = null) {
        if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID || TELEGRAM_TOKEN.includes('ĐIỀN_')) {
            if(callback) callback(); return;
        }
        let icon = type === 'success' ? '🎁' : (type === 'error' ? '🚨' : 'ℹ️');
        let time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
        let title = document.title.split('-')[0].trim() || "STV";
        let finalMsg = `${icon} <b>[${time}]</b>\n${msg}\n📖 <i>${title}</i>`;

        GM_xmlhttpRequest({
            method: "POST",
            url: `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
            data: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: finalMsg, parse_mode: "HTML", disable_web_page_preview: true }),
            headers: { "Content-Type": "application/json" },
            onload: function() { if(callback) callback(); },
            onerror: function() { if(callback) callback(); }
        });
    }

    function checkRemoteCommands() {
        if (!TELEGRAM_TOKEN) return;

        setTimeout(() => {
            let lastProcessedId = parseInt(localStorage.getItem('stv_last_processed_id') || '0');

            GM_xmlhttpRequest({
                method: "GET",
                url: `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastProcessedId + 1}&limit=1`,
                onload: function(response) {
                    try {
                        let res = JSON.parse(response.responseText);
                        if (res.ok && res.result.length > 0) {
                            let update = res.result[0];
                            let updateId = update.update_id;

                            let currentProcessedId = parseInt(localStorage.getItem('stv_last_processed_id') || '0');
                            if (updateId <= currentProcessedId) return;

                            localStorage.setItem('stv_last_processed_id', updateId);

                            let message = update.message ? update.message.text : "";
                            if (update.message && update.message.chat.id.toString() === TELEGRAM_CHAT_ID && message) {
                                processCommand(message.trim());
                            }
                        }
                    } catch (e) {}
                }
            });
        }, Math.random() * 2000);
    }

    function processCommand(cmd) {
        console.log("Cmd:", cmd);
        let parts = cmd.split(' ');
        let command = parts[0].toLowerCase();

        // /add (FIX: accept .com + .app, dedupe bằng root)
        if (command === '/add') {
            let urlToAdd = parts[1];
            if (!urlToAdd) {
                if (location.href.includes("/truyen/")) urlToAdd = location.href;
                else { sendTele("❌ Lỗi link.", 'error'); return; }
            }

            // FIX: accept both domains
            if (urlToAdd && (urlToAdd.includes('sangtacviet.com') || urlToAdd.includes('sangtacviet.app'))) {
                let list = getStoryList();
                let rootNew = getStoryRoot(urlToAdd);

                let exists = list.some(savedUrl => getStoryRoot(savedUrl) === rootNew);
                if (!exists) {
                    addStory(urlToAdd);
                    sendTele(`✅ Đã thêm truyện vào list.`, 'info');
                } else {
                    sendTele("⚠️ Truyện này đã có rồi.", 'info');
                }
            } else {
                sendTele("❌ Link sai.", 'error');
            }
        }

        else if (command === '/status') {
            let st = isAutoRunning() ? "ON 🟢" : "OFF 🔴";
            let list = getStoryList();
            let currentRoot = getStoryRoot(location.href);
            let listIndex = list.findIndex(savedUrl => getStoryRoot(savedUrl) === currentRoot);

            let statusStr = "";
            if (list.length === 0) statusStr = "0/0 (Trống)";
            else if (listIndex !== -1) statusStr = `${listIndex + 1}/${list.length}`;
            else statusStr = "Ngoại lai (Chưa lưu)";

            sendTele(`📊 <b>STATUS:</b> ${st}\nTruyện: ${statusStr}\nLỗi liên tiếp: ${getErrorStreak()}`, 'info');
        }

        // /list (FIX: mũi tên so bằng root, không dùng includes)
        else if (command === '/list') {
            let list = getStoryList();
            let currentUrl = location.href;
            let currentRoot = getStoryRoot(currentUrl);

            let msg = "📋 <b>List Truyện:</b>\n";
            list.forEach((l, i) => {
                let isCurrent = getStoryRoot(l) === currentRoot;
                msg += `${isCurrent ? '👉 ' : ''}#${i + 1}: ${l}\n`;
            });
            if(list.length===0) msg += "(Trống)";
            sendTele(msg, 'info');
        }

        else if (command === '/help') {
            sendTele("📜 <b>MENU:</b>\n/status, /start, /stop, /f5\n/add [link], /list, /del [số], /swap [số]\n/sleep [phút], /wake", 'info');
        }
        else if (command === '/f5') location.reload();
        else if (command === '/stop') { localStorage.setItem('stv_auto_farm', 'false'); sendTele("🛑 STOP", 'info', ()=>location.reload()); }
        else if (command === '/start') { localStorage.setItem('stv_auto_farm', 'true'); sendTele("✅ START", 'info', ()=>location.reload()); }
        else if (command === '/swap') { swapToSpecificStory(parseInt(parts[1]) - 1); }
        else if (command === '/del') {
            if(removeStory(parseInt(parts[1]) - 1)) sendTele("🗑️ Đã xóa.", 'info');
            else sendTele("❌ Số sai.", 'error');
        }
        else if (command === '/sleep') { activateSleep(parseInt(parts[1])||30, "Lệnh User"); }
        else if (command === '/wake') { setSleepUntil(0); localStorage.setItem('stv_auto_farm', 'true'); sendTele("☀️ Dậy!", 'info', ()=>location.reload()); }
    }

    // --- 4. QUẢN LÝ LIST & LỖI ---
    function addStory(url) {
        let list = getStoryList();
        if (list.some(u => u === url)) return false;
        list.push(url); saveStoryList(list); return true;
    }
    function removeStory(index) {
        let list = getStoryList();
        if (index >= 0 && index < list.length) {
            list.splice(index, 1); saveStoryList(list);
            if (getCurrentStoryIndex() >= list.length) setCurrentStoryIndex(0);
            return true;
        } return false;
    }
    function swapToNextStory(reason) {
        let list = getStoryList();
        if (list.length === 0) { sendTele(`⚠️ ${reason} -> List trống!`, 'error'); return; }
        let nextIndex = getCurrentStoryIndex() + 1;
        if (nextIndex >= list.length) nextIndex = 0;
        setCurrentStoryIndex(nextIndex);
        sendTele(`🔄 <b>${reason}</b>\nQua #${nextIndex + 1}`, 'info', ()=> location.href = list[nextIndex]);
    }
    function swapToSpecificStory(index) {
        let list = getStoryList();
        if (index >= 0 && index < list.length) {
            setCurrentStoryIndex(index); resetErrorStreak();
            sendTele(`🔀 Swap #${index + 1}`, 'info', ()=> location.href = list[index]);
        } else { sendTele("❌ Index sai.", 'error'); }
    }
    function activateSleep(minutes, reason) {
        let wakeTime = now() + (minutes * 60 * 1000);
        setSleepUntil(wakeTime); resetErrorStreak();
        let wakeDate = new Date(wakeTime).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
        sendTele(`💤 <b>NGỦ (${minutes}p)</b>\nLý do: ${reason}\nDậy: ${wakeDate}`, 'error', ()=>location.reload());
    }
    function handleStoryError(reason) {
        let list = getStoryList(); increaseErrorStreak(); let streak = getErrorStreak();
        if (list.length > 0 && streak >= list.length) activateSleep(CONFIG.sleepTimeOnError, "Toàn bộ list lỗi.");
        else swapToNextStory(`${reason} (Lỗi ${streak})`);
    }

    // --- 5. LOGIC GIAO DIỆN & LỖI ---
    const handleAlert = (msg) => {
        // FIX: chỉ xử lý khi msg là string, tránh crash/match bậy
        if (typeof msg !== 'string') return false;

        if (msg.includes("thất bại") || msg.includes("rescan")) { location.reload(); return true; }
        if (msg.includes("tự khắc phục") || msg.includes("không cần báo lỗi")) { handleStoryError("Lỗi Server"); return true; }
        return false;
    };
    const originalAlert = win.alert;
    win.alert = function(msg) { if (handleAlert(msg)) return; return originalAlert(msg); };
    const originalConfirm = win.confirm;
    win.confirm = function(msg) { if (handleAlert(msg)) return true; return originalConfirm(msg); };

    function checkSleepMode() {
        let sleepUntil = getSleepUntil();
        if (now() < sleepUntil) {
            document.body.innerHTML = ""; document.body.style.background = "#222"; document.body.style.color = "#fff";
            document.body.style.display = "flex"; document.body.style.flexDirection = "column";
            document.body.style.justifyContent = "center"; document.body.style.alignItems = "center"; document.body.style.height = "100vh";
            let h1 = document.createElement("h1"); h1.innerText = "💤 NGỦ ĐÔNG";
            let h2 = document.createElement("h2"); h2.id = "sleep-timer";
            let p = document.createElement("p"); p.innerText = "Chat /wake để gọi dậy.";
            document.body.appendChild(h1); document.body.appendChild(h2); document.body.appendChild(p);

            setInterval(() => {
                let left = Math.ceil((sleepUntil - now())/1000);
                if(left <= 0) { setSleepUntil(0); location.reload(); }
                else {
                    let m = Math.floor(left/60); let s = left%60;
                    document.getElementById('sleep-timer').innerText = `${m}p ${s}s`;
                }
                checkRemoteCommands();
            }, 2000);
            return true;
        }
        return false;
    }

    function tryClickManualLoad() {
        let candidates = document.querySelectorAll('div, span, a, p, b, i, button');
        for (let el of candidates) {
            let text = (el.innerText || "").toLowerCase();
            if (text.includes("nhấp vào để tải") || text.includes("bấm để tải") || text.includes("click để tải")) {
                console.log("STV: Tìm thấy nút tải -> Click!");
                showToast("🖱️ Auto Click tải lại...", "#2196F3");
                el.click();
                if (el.onclick) el.onclick();
                return true;
            }
        }
        return false;
    }

    function startVisualMonitor() {
        if (!isAutoRunning()) return;

        if (location.href.endsWith('/0/') || location.href.includes('/0/')) {
            resetErrorStreak();
            swapToNextStory("Hết chương (Về mục lục)");
            return;
        }

        showToast("👁️", "#999");

        let monitor = setInterval(() => {
            try {
                let bodyText = document.body?.innerText || "";

                if (bodyText.includes("tự khắc phục") || bodyText.includes("không cần báo lỗi")) {
                    clearInterval(monitor);
                    handleStoryError("Lỗi Server (Text)");
                    return;
                }

                if (bodyText.includes("Tải chương thất bại")) {
                    clearInterval(monitor);
                    location.reload();
                    return;
                }

                if (bodyText.includes("nhấp vào để tải") || bodyText.includes("bấm để tải")) {
                    tryClickManualLoad();
                }

                // FIX: tránh kẹt vì chữ "Loading" nằm trong DOM dù trang đã load xong
                if (bodyText.length < 800 && (bodyText.includes("Đang tải nội dung") || bodyText.includes("Loading"))) {
                    return;
                }

                let hasContent = bodyText.length > 500;

                let hasNextBtn =
                    document.querySelectorAll('.fa-arrow-right').length > 0
                    || Array.from(document.querySelectorAll('a'))
                        .some(a => (a.innerText || "").includes("Chương sau"));

                if (hasContent || hasNextBtn) {
                    clearInterval(monitor);
                    resetErrorStreak();
                    runFarmingLogic();
                }
            } catch (e) {
                console.log("STV monitor crash:", e);
            }
        }, 500);
    }

    // --- 6. LOGIC CÀY ĐỒ ---
    function readAndClosePopup() {
        let attempts = 0;
        let reader = setInterval(() => {
            attempts++;
            let allPopups = document.querySelectorAll('.bootbox-body, .modal-body');
            let targetPopup = null;
            for (let popup of allPopups) {
                if (popup.offsetParent === null) continue;
                let txt = popup.innerText || "";
                if (txt.includes("Thêm name") || txt.includes("Tiếng Trung") || txt.includes("Hán Việt")) continue;
                targetPopup = popup; break;
            }
            if (targetPopup) {
                clearInterval(reader);
                let itemName = targetPopup.innerText.split('\n')[0].trim();
                sendTele(`<b>${itemName}</b>\n---\n${targetPopup.innerText}`, 'success', ()=>destroyPopup());
                return;
            }
            if (attempts > 40) { clearInterval(reader); destroyPopup(); }
        }, 100);
    }

    function destroyPopup() {
        let buttons = document.querySelectorAll('.bootbox .btn, .modal-footer .btn, button.btn-danger');
        for (let b of buttons) b.click();
        setTimeout(() => {
             document.querySelectorAll('.bootbox, .modal, .modal-backdrop').forEach(e => e.remove());
             document.body.classList.remove('modal-open');
        }, 500);
    }

    function executeDirectCall() {
        showToast("🚀...", "#FF9800");

        if (typeof win.tryCollect === 'function') win.tryCollect(true);

        let start = now();
        let maxWait = 8000;
        let tick = 250;

        let timer = setInterval(() => {
            if (now() - start > maxWait) {
                clearInterval(timer);
                showToast("⏱️ timeout", "#f44336");
                setPendingCollect(false);
                startCountdown();
                return;
            }

            let btn = null;
            let allBtns = document.querySelectorAll('i.btn.btn-info, button.btn.btn-info, a.btn.btn-info');
            for (let b of allBtns) {
                if ((b.innerText || "").includes("Nhặt")) { btn = b; break; }
            }
            if (!btn) return;

            clearInterval(timer);

            try {
                let funcName = btn.id;
                if (funcName && typeof win[funcName] === 'function') {
                    win[funcName]();
                } else {
                    btn.click();
                    if (btn.onclick) btn.onclick();
                }
                showToast("✅...", "#4CAF50");
                readAndClosePopup();
            } catch (e) {
                console.log("executeDirectCall error:", e);
            } finally {
                setPendingCollect(false);
                startCountdown();
            }
        }, tick);
    }

    function runFarmingLogic() {
        createControlPanel();

        if (isPendingCollect()) { executeDirectCall(); return; }

        let xhr = new XMLHttpRequest();
        xhr.open('POST', '/index.php?ngmar=iscollectable', true);
        xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        xhr.timeout = 8000;

        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    try {
                        let res = JSON.parse(xhr.responseText);
                        if (res.code == 1) {
                            // NOTE: trước đây dùng reload để spawn nút "Nhặt" (phase 2).
                            // Hiện tại có thể nhặt trực tiếp: gọi tryCollect(true) + gọi function theo id random của nút.
                            //showToast("⚡ NHẶT...", "#FF9800");
                            setPendingCollect(true);

                            // Nhặt luôn, không reload nữa
                            executeDirectCall();
                            return;
                        } else {
                            showToast("😢", "#555");
                        }

                    } catch(e) {}
                } else {
                    console.log("iscollectable status:", xhr.status);
                }
                startCountdown();
            }
        };

        xhr.onerror = function() { console.log("iscollectable xhr.onerror"); startCountdown(); };
        xhr.ontimeout = function() { console.log("iscollectable xhr.timeout"); startCountdown(); };

        xhr.send("ngmar=tcollect&sajax=trycollect");
    }

    // FIX: siết điều kiện next để tránh bắt nhầm "tiếp"
    function goToNextChapter() {
        let nextUrl = null;

        // 1) Ưu tiên link có text đúng "Chương sau"
        let links = Array.from(document.querySelectorAll('a'));
        for (let link of links) {
            let t = (link.innerText || "").trim().toLowerCase();
            if (t === "chương sau") { nextUrl = link.href; break; }
        }

        // 2) Fallback icon
        if (!nextUrl) {
            let icons = document.querySelectorAll('.fa-arrow-right');
            if (icons.length > 0) {
                let icon = icons[0];
                if (icon && icon.parentNode && icon.parentNode.tagName === 'A') nextUrl = icon.parentNode.href;
            }
        }

        // 3) Fallback chặt hơn: chứa "chương sau" (không match "tiếp" nữa)
        if (!nextUrl) {
            for (let link of links) {
                let t = (link.innerText || "").trim().toLowerCase();
                if (t.includes("chương sau")) { nextUrl = link.href; break; }
            }
        }

        if (nextUrl) { showToast("🚀", "#2196F3"); location.href = nextUrl; }
        else { swapToNextStory("Không tìm thấy Next"); }
    }

    // FIX: chống countdown chồng
    function startCountdown() {
        if (!isAutoRunning()) return;

        if (window.__stv_countdown) {
            clearInterval(window.__stv_countdown);
            window.__stv_countdown = null;
        }

        let time = Math.floor(Math.random() * (CONFIG.maxWait - CONFIG.minWait) + CONFIG.minWait);
        let seconds = Math.floor(time / 1000);
        let btn = document.getElementById('stv-auto-btn');

        window.__stv_countdown = setInterval(() => {
            if(btn) btn.innerText = `⏳ ${seconds}s`;
            seconds--;
            if (seconds < 0) {
                clearInterval(window.__stv_countdown);
                window.__stv_countdown = null;
                goToNextChapter();
            }
        }, 1000);
    }

    function createControlPanel() {
        if(document.getElementById('stv-panel')) return;
        let panel = document.createElement('div'); panel.id = 'stv-panel';
        panel.style.cssText = `position: fixed; bottom: 80px; right: 20px; z-index: 999999; display: flex; gap: 5px;`;
        let testBtn = document.createElement('div'); testBtn.innerText = "TEST";
        testBtn.style.cssText = `padding: 10px; border-radius: 8px; font-family: Arial; font-size: 12px; font-weight: bold; cursor: pointer; background: #2196F3; color: white; box-shadow: 0 4px 8px rgba(0,0,0,0.3);`;
        testBtn.onclick = function() { sendTele("🔔 OK!", 'info'); };
        let autoBtn = document.createElement('div'); autoBtn.id = 'stv-auto-btn';
        autoBtn.style.cssText = `padding: 10px; border-radius: 8px; font-family: Arial; font-size: 14px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.5);`;
        if (isAutoRunning()) { autoBtn.innerText = "🤖 ON"; autoBtn.style.background = "#28a745"; autoBtn.style.color = "white"; }
        else { autoBtn.innerText = "😴 OFF"; autoBtn.style.background = "#333"; autoBtn.style.color = "#bbb"; }
        autoBtn.onclick = function() {
            let s = !isAutoRunning(); localStorage.setItem('stv_auto_farm', s ? 'true' : 'false');
            sendTele(s?"🤖 ON":"😴 OFF", 'info', ()=>location.reload());
        };
        panel.appendChild(testBtn); panel.appendChild(autoBtn); document.body.appendChild(panel);
    }

    function showToast(msg, color) {
        if(!document.body) return;
        let c = document.getElementById('stv-toast');
        if (!c) {
            c = document.createElement('div');
            c.id = 'stv-toast';
            c.style.cssText = "position:fixed; bottom:20px; right:20px; z-index:99999; display:flex; flex-direction:column-reverse; gap:5px; pointer-events:none;";
            document.body.appendChild(c);
        }
        let t = document.createElement('div'); t.innerText = msg;
        t.style.cssText = `background:rgba(0,0,0,0.85); color:#fff; padding:8px 12px; border-radius:5px; border-left:4px solid ${color}; font-family:Arial; font-size:12px; animation:fadeIn 0.3s;`;
        c.appendChild(t); setTimeout(() => t.remove(), 3000);
    }

    let css = document.createElement('style');
    css.textContent = "@keyframes fadeIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }";
    (document.head || document.documentElement).appendChild(css);

    window.addEventListener('load', () => {
        if (checkSleepMode()) return;
        createControlPanel();
        startVisualMonitor();
        updateCurrentChapterToStorage();
        setInterval(checkRemoteCommands, 2000);
    });
})();
