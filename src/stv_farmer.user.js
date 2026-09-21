// ==UserScript==
// @name         STV Auto Farmer - Server Error Fix (No False Positive)
// @namespace    http://tampermonkey.net/
// @version      v3.8.0
// @description  Tự động nhặt đồ, cắn đan, đo Vận Khí, fix lỗi bắt nhầm Chương 502/504 làm reload liên tục.
// @author       Gemini and Soappp
// @match        *://sangtacviet.com/truyen/*
// @match        *://sangtacviet.app/truyen/*
// @run-at       document-start
// @grant        unsafeWindow
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    const win = unsafeWindow;
    const CONFIG = {
        minWait: 15000,
        maxWait: 20000,
        pendingTTLms: 20000,
        reloadDelay: 3000,
        maxHistoryItems: 500
    };

    // --- OVERRIDE ALERT TRÁNH KẸT LUỒNG ---
    let lastAlertMsg = "";
    win.alert = function(msg) {
        console.log("[STV-Farm Alert Captured]:", msg);
        lastAlertMsg = String(msg || "");
    };

    const State = {
        isAuto: () => localStorage.getItem('stv_auto_farm') === 'true',
        setAuto: (val) => localStorage.setItem('stv_auto_farm', val ? 'true' : 'false'),
        isPending: () => parseInt(localStorage.getItem('stv_pending_until') || '0') > Date.now(),
        setPending: (status) => localStorage.setItem('stv_pending_until', status ? String(Date.now() + CONFIG.pendingTTLms) : '0')
    };

    // --- QUẢN LÝ THỐNG KÊ VÀ LOCALSTORAGE ---
    const Stats = {
        getHistory: () => {
            try { return JSON.parse(localStorage.getItem('stv_history_log') || '[]'); }
            catch(e) { return []; }
        },
        addHistory: (itemName, luckCost = 0) => {
            let logs = Stats.getHistory();
            let nowStr = new Date().toLocaleString('vi-VN');
            logs.unshift({ name: itemName, time: nowStr, cost: luckCost });
            if (logs.length > CONFIG.maxHistoryItems) logs = logs.slice(0, CONFIG.maxHistoryItems);
            localStorage.setItem('stv_history_log', JSON.stringify(logs));
            localStorage.setItem('stv_stats_items', logs.length);
            return logs.length;
        },
        getItemsCount: () => Stats.getHistory().length,
        getElapsedMs: () => parseInt(localStorage.getItem('stv_stats_elapsed') || '0'),
        addElapsedMs: (ms) => {
            let total = Stats.getElapsedMs() + ms;
            localStorage.setItem('stv_stats_elapsed', total);
            return total;
        },
        getLuck: () => parseInt(localStorage.getItem('stv_user_luck') || '0'),
        setLuck: (val) => localStorage.setItem('stv_user_luck', val),
        clearAllStorage: () => {
            localStorage.removeItem('stv_history_log');
            localStorage.setItem('stv_stats_items', '0');
            localStorage.setItem('stv_stats_elapsed', '0');
            localStorage.removeItem('stv_user_luck');
        }
    };

    let sessionStartTime = null;

    function clearTimer() {
        if (win.__stv_timer) { clearTimeout(win.__stv_timer); win.__stv_timer = null; }
        if (win.__stv_scroll_interval) { clearInterval(win.__stv_scroll_interval); win.__stv_scroll_interval = null; }
        if (win.__stv_clock_interval) { clearInterval(win.__stv_clock_interval); win.__stv_clock_interval = null; }
    }

    // --- CSS GIAO DIỆN ---
    function injectStyles() {
        if (document.getElementById('stv-custom-css')) return;
        const style = document.createElement('style');
        style.id = 'stv-custom-css';
        style.innerHTML = `
            #stv-panel, #stv-toast, #stv-modal-overlay {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                user-select: none;
            }

            #stv-panel {
                position: fixed; bottom: 25px; right: 25px; z-index: 999998;
                display: flex; align-items: center; gap: 10px; padding: 6px 14px;
                background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(14px);
                border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 50px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
            }

            #stv-auto-btn {
                padding: 8px 16px; border-radius: 30px; border: none; cursor: pointer;
                font-size: 13px; font-weight: 700; color: #ffffff;
                background: linear-gradient(135deg, #10b981, #059669);
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35); transition: all 0.2s;
            }
            #stv-auto-btn.off {
                background: linear-gradient(135deg, #ef4444, #dc2626);
                box-shadow: 0 4px 12px rgba(239, 68, 68, 0.35);
            }

            .stv-stats-box {
                display: flex; align-items: center; gap: 10px; font-size: 12px;
                font-weight: 600; color: #e2e8f0; cursor: pointer;
            }
            .stv-stat-val { color: #38bdf8; font-weight: 700; font-family: monospace; font-size: 13px; }

            #stv-toast {
                position: fixed; bottom: 85px; right: 25px; z-index: 999998;
                width: max-content; min-width: 240px; max-width: 380px; padding: 14px 18px;
                border-radius: 16px; background: linear-gradient(135deg, rgba(30, 27, 75, 0.95), rgba(49, 46, 129, 0.95));
                backdrop-filter: blur(16px); border: 1px solid rgba(139, 92, 246, 0.4);
                box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45); color: #f3f4f6;
                display: flex; align-items: flex-start; justify-content: space-between;
                animation: stvSlideUp 0.4s ease-out;
            }
            .stv-toast-content { display: flex; flex-direction: column; gap: 4px; word-break: break-word; white-space: pre-wrap; }
            .stv-toast-title { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #a78bfa; }
            .stv-toast-item { font-size: 14px; font-weight: 700; color: #ffffff; }
            .stv-toast-cost { font-size: 12px; font-weight: 600; color: #f43f5e; margin-left: 4px; }
            .stv-toast-close {
                background: rgba(255, 255, 255, 0.1); border: none; color: #9ca3af;
                width: 22px; height: 22px; border-radius: 50%; cursor: pointer;
                display: flex; align-items: center; justify-content: center; font-size: 13px;
                flex-shrink: 0; margin-left: 10px;
            }
            .stv-toast-close:hover { background: rgba(239, 68, 68, 0.8); color: #fff; }

            #stv-modal-overlay {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(8px); z-index: 999999;
                display: flex; align-items: center; justify-content: center; animation: stvFadeIn 0.2s ease-out;
            }
            #stv-modal {
                width: 90%; max-width: 480px; max-height: 80vh; background: #0f172a;
                border: 1px solid rgba(255,255,255,0.15); border-radius: 20px;
                box-shadow: 0 20px 50px rgba(0,0,0,0.6); display: flex; flex-direction: column; overflow: hidden; color: #f8fafc;
            }
            .stv-modal-header {
                padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.1);
                display: flex; align-items: center; justify-content: space-between; background: rgba(30, 41, 59, 0.5);
            }
            .stv-modal-title { font-size: 16px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 8px; }
            .stv-modal-close { background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; }
            .stv-modal-close:hover { color: #f43f5e; }

            .stv-modal-body { padding: 16px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
            .stv-luck-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .stv-luck-card {
                padding: 12px; border-radius: 12px; background: rgba(30, 41, 59, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.08); display: flex; flex-direction: column; gap: 4px;
            }
            .stv-luck-label { font-size: 11px; color: #94a3b8; font-weight: 600; }
            .stv-luck-value { font-size: 16px; font-weight: 800; color: #fbbf24; }

            .stv-log-list { display: flex; flex-direction: column; gap: 8px; max-height: 260px; overflow-y: auto; padding-right: 4px; }
            .stv-log-item {
                padding: 10px 14px; border-radius: 10px; background: rgba(30, 41, 59, 0.6);
                border: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between; font-size: 13px;
            }
            .stv-log-name { font-weight: 700; color: #f1f5f9; }
            .stv-log-cost-badge { font-size: 11px; font-weight: 700; color: #f43f5e; background: rgba(244, 63, 94, 0.15); padding: 2px 6px; border-radius: 4px; margin-left: 6px; }
            .stv-log-time { font-size: 11px; color: #64748b; }

            .stv-modal-footer {
                padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.1);
                display: flex; justify-content: space-between; align-items: center; background: rgba(30, 41, 59, 0.3);
            }
            .stv-btn-danger {
                padding: 8px 14px; border-radius: 8px; border: none; background: #dc2626; color: white; font-weight: 600; font-size: 12px; cursor: pointer; transition: background 0.2s;
            }
            .stv-btn-danger:hover { background: #b91c1c; }

            @keyframes stvSlideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes stvFadeIn { from { opacity: 0; } to { opacity: 1; } }
        `;
        document.head.appendChild(style);
    }

    function showItemToast(itemName, luckCost = 0) {
        let oldToast = document.getElementById('stv-toast');
        if (oldToast) oldToast.remove();

        let toast = document.createElement('div');
        toast.id = 'stv-toast';
        toast.innerHTML = `
            <div class="stv-toast-content">
                <span class="stv-toast-title">✨ Bảo vật vừa nhặt</span>
                <span class="stv-toast-item">🎁 ${itemName} ${luckCost > 0 ? `<span class="stv-toast-cost">(-${luckCost} Vận khí)</span>` : ''}</span>
            </div>
            <button class="stv-toast-close" title="Đóng">✕</button>
        `;
        toast.querySelector('.stv-toast-close').onclick = () => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 200);
        };
        document.body.appendChild(toast);
    }

    function showStatsModal() {
        let oldModal = document.getElementById('stv-modal-overlay');
        if (oldModal) oldModal.remove();

        let logs = Stats.getHistory();
        let luck = Stats.getLuck();
        let totalCost = logs.reduce((sum, l) => sum + (l.cost || 0), 0);

        let overlay = document.createElement('div');
        overlay.id = 'stv-modal-overlay';

        let logsHtml = logs.length > 0
            ? logs.map(l => `
                <div class="stv-log-item">
                    <div>
                        <span class="stv-log-name">🎁 ${l.name}</span>
                        ${l.cost > 0 ? `<span class="stv-log-cost-badge">-${l.cost} Vận khí</span>` : ''}
                    </div>
                    <span class="stv-log-time">🕒 ${l.time}</span>
                </div>
              `).join('')
            : `<div style="text-align:center; padding: 20px; color:#64748b; font-size:13px;">Chưa có lịch sử nhặt đồ nào</div>`;

        overlay.innerHTML = `
            <div id="stv-modal">
                <div class="stv-modal-header">
                    <span class="stv-modal-title">📊 Bảng Thống Kê Auto Farm</span>
                    <button class="stv-modal-close" id="stv-modal-close-btn">✕</button>
                </div>
                <div class="stv-modal-body">
                    <div class="stv-luck-grid">
                        <div class="stv-luck-card">
                            <span class="stv-luck-label">Vận Khí Hiện Tại</span>
                            <span class="stv-luck-value">🍀 ${luck || 'Chưa rõ'}</span>
                        </div>
                        <div class="stv-luck-card">
                            <span class="stv-luck-label">Tổng Vận Khí Đã Tốn</span>
                            <span class="stv-luck-value" style="color:#f43f5e;">🔥 -${totalCost}</span>
                        </div>
                    </div>
                    <div style="font-size:13px; font-weight:700; color:#e2e8f0;">Lịch sử nhặt đồ gần đây (${logs.length} món):</div>
                    <div class="stv-log-list">${logsHtml}</div>
                </div>
                <div class="stv-modal-footer">
                    <button class="stv-btn-danger" id="stv-clear-storage-btn">🗑️ Xóa Sạch Dữ Liệu LocalStorage</button>
                    <span style="font-size:11px; color:#64748b;">STV Auto Farmer v3.8</span>
                </div>
            </div>
        `;

        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        document.body.appendChild(overlay);

        document.getElementById('stv-modal-close-btn').onclick = () => overlay.remove();

        document.getElementById('stv-clear-storage-btn').onclick = () => {
            if (confirm("⚠️ Bạn có chắc chắn muốn XÓA SẠCH toàn bộ lịch sử nhặt đồ & thời gian tích lũy khỏi LocalStorage?")) {
                Stats.clearAllStorage();
                sessionStartTime = Date.now();
                document.getElementById('stv-time-val').innerText = "00:00:00";
                document.getElementById('stv-count-val').innerText = "0";
                overlay.remove();
                alert("Đã dọn dẹp sạch sẽ bộ nhớ LocalStorage!");
            }
        };
    }

    // --- ĐỒNG HỒ BẤM GIỜ ---
    function formatTime(ms) {
        let totalSecs = Math.floor(ms / 1000);
        let h = Math.floor(totalSecs / 3600);
        let m = Math.floor((totalSecs % 3600) / 60);
        let s = totalSecs % 60;
        return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
    }

    function startLiveClock() {
        if (win.__stv_clock_interval) clearInterval(win.__stv_clock_interval);
        sessionStartTime = Date.now();

        win.__stv_clock_interval = setInterval(() => {
            if (!State.isAuto()) return;
            let currentSessionMs = Date.now() - sessionStartTime;
            let totalMs = Stats.getElapsedMs() + currentSessionMs;

            let clockEl = document.getElementById('stv-time-val');
            if (clockEl) clockEl.innerText = formatTime(totalMs);
        }, 1000);
    }

    function saveActiveSessionTime() {
        if (sessionStartTime) {
            let ms = Date.now() - sessionStartTime;
            Stats.addElapsedMs(ms);
            sessionStartTime = null;
        }
    }

    // --- TỰ ĐỘNG CUỘN TRANG ---
    function startAutoScroll(durationMs) {
        if (!State.isAuto()) return;
        const scrollStepMs = 100;
        const totalSteps = durationMs / scrollStepMs;
        let currentStep = 0;

        win.__stv_scroll_interval = setInterval(() => {
            if (!State.isAuto()) { clearInterval(win.__stv_scroll_interval); return; }
            const scrollHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
            const maxScrollTop = scrollHeight - window.innerHeight;

            if (maxScrollTop > 0 && currentStep < totalSteps) {
                currentStep++;
                const targetScroll = (currentStep / totalSteps) * maxScrollTop;
                window.scrollTo({ top: targetScroll, behavior: 'smooth' });
            } else {
                clearInterval(win.__stv_scroll_interval);
            }
        }, scrollStepMs);
    }

    // --- CẮN ĐAN TỰ ĐỘNG ---
    function getBestPillChoice(current, availablePills) {
        if (current >= 10000 || availablePills.length === 0) return null;
        let counts = { 400: [], 500: [], 600: [] };
        availablePills.forEach((p, idx) => { if (counts[p.v]) counts[p.v].push({ idx, id: p.i }); });

        let memo = {};
        function getMaxResult(curValue, c400, c500, c600) {
            if (curValue >= 10000 || (c400 === 0 && c500 === 0 && c600 === 0)) return curValue;
            let key = `${curValue}_${c400}_${c500}_${c600}`;
            if (memo[key] !== undefined) return memo[key];

            let maxRes = curValue;
            if (c400 > 0) maxRes = Math.max(maxRes, getMaxResult(curValue + 400, c400 - 1, c500, c600));
            if (c500 > 0) maxRes = Math.max(maxRes, getMaxResult(curValue + 500, c400, c500 - 1, c600));
            if (c600 > 0) maxRes = Math.max(maxRes, getMaxResult(curValue + 600, c400, c500, c600 - 1));

            memo[key] = maxRes;
            return maxRes;
        }

        let choices = [];
        if (counts[400].length > 0) choices.push({ pill: counts[400][0], score: getMaxResult(current + 400, counts[400].length - 1, counts[500].length, counts[600].length) });
        if (counts[500].length > 0) choices.push({ pill: counts[500][0], score: getMaxResult(current + 500, counts[400].length, counts[500].length - 1, counts[600].length) });
        if (counts[600].length > 0) choices.push({ pill: counts[600][0], score: getMaxResult(current + 600, counts[400].length, counts[500].length, counts[600].length - 1) });

        let optimal = choices.reduce((best, item) => (item.score > best.score ? item : best), { pill: null, score: -1 });
        return optimal.pill ? availablePills[optimal.pill.idx] : null;
    }

    function processCultivation(onComplete) {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', '/user/0/', true);
            xhr.timeout = 5000;
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        const luckMatch = xhr.responseText.match(/<span>Vận khí<\/span>\s*<span>(\d+)<\/span>/);
                        if (luckMatch) {
                            Stats.setLuck(parseInt(luckMatch[1]));
                        }

                        const match = xhr.responseText.match(/(\d+)\s*\/\s*10000/);
                        if (match && parseInt(match[1]) < 10000) {
                            fetchAndConsumePills(parseInt(match[1]), onComplete);
                            return;
                        }
                    }
                    onComplete();
                }
            };
            xhr.onerror = () => onComplete();
            xhr.ontimeout = () => onComplete();
            xhr.send();
        } catch (e) { onComplete(); }
    }

    function fetchAndConsumePills(currentPoints, onComplete) {
        const uidMatch = document.cookie.match(/useri2=(\d+)/);
        const uid = uidMatch ? uidMatch[1] : null;
        if (!uid) { onComplete(); return; }

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/io/userinfo/getuseritems?uid=${uid}`, true);
        xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        xhr.timeout = 5000;
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(xhr.responseText, 'text/html');
                        const items = doc.querySelectorAll('a.item');
                        let pills = [];
                        items.forEach(item => {
                            const id = item.getAttribute('i');
                            const info = item.querySelector('.iinfo')?.innerHTML || '';
                            const valMatch = info.match(/<b>(\d+)<\/b>\s*căn cơ/);
                            if (id && valMatch && [400, 500, 600].includes(parseInt(valMatch[1]))) {
                                pills.push({ i: id, v: parseInt(valMatch[1]) });
                            }
                        });
                        if (pills.length > 0) {
                            const bestPill = getBestPillChoice(currentPoints, pills);
                            if (bestPill) { executeConsumePill(bestPill.i, onComplete); return; }
                        }
                    } catch (e) {}
                }
                onComplete();
            }
        };
        xhr.onerror = () => onComplete();
        xhr.ontimeout = () => onComplete();
        xhr.send();
    }

    function executeConsumePill(pillId, onComplete) {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/index.php?ngmar=dungnhie', true);
        xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        xhr.timeout = 5000;
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200 && xhr.responseText.trim() === 'success') {
                    processCultivation(onComplete);
                } else { onComplete(); }
            }
        };
        xhr.onerror = () => onComplete();
        xhr.ontimeout = () => onComplete();
        xhr.send(`ajax=dungnhieu&consume=${pillId}`);
    }

    // --- XỬ LÝ POPUP BẢO VẬT ---
    function readAndClosePopup(onSuccess, onFail) {
        lastAlertMsg = "";
        let attempts = 0;

        let reader = setInterval(() => {
            attempts++;

            if (lastAlertMsg.length > 0) {
                clearInterval(reader);
                let captured = lastAlertMsg;
                lastAlertMsg = "";

                if (captured.includes("không tìm thấy") || captured.includes("không nhặt được") || captured.includes("không cánh mà bay")) {
                    if (onFail) onFail();
                } else {
                    if (onSuccess) onSuccess("Bảo vật", 0);
                }
                return;
            }

            let cModal = document.getElementById('cModal');
            let isCModalVisible = cModal && (cModal.offsetWidth > 0 || cModal.offsetHeight > 0 || cModal.classList.contains('show'));

            if (isCModalVisible) {
                clearInterval(reader);

                let rawName = document.getElementById('cName')?.innerText?.trim() || "Bảo vật";

                let okBtn = cModal.querySelector('button.btn-danger, .modal-footer .btn');
                if (okBtn) {
                    okBtn.click();
                } else if (typeof win.nMMap2 === 'function') {
                    try { win.nMMap2(); } catch(e) {}
                }

                setTimeout(() => {
                    document.querySelectorAll('.bootbox, .modal, .modal-backdrop').forEach(e => e.remove());
                    document.body.classList.remove('modal-open');

                    if (lastAlertMsg.includes("không nhặt được") || lastAlertMsg.includes("không cánh mà bay")) {
                        if (onFail) onFail();
                    } else {
                        let oldLuck = Stats.getLuck();

                        fetch('/user/0/').then(r => r.text()).then(html => {
                            let luckMatch = html.match(/<span>Vận khí<\/span>\s*<span>(\d+)<\/span>/);
                            let newLuck = luckMatch ? parseInt(luckMatch[1]) : oldLuck;
                            let luckCost = (oldLuck > 0 && oldLuck > newLuck) ? (oldLuck - newLuck) : 0;

                            Stats.setLuck(newLuck);
                            let total = Stats.addHistory(rawName, luckCost);

                            let countEl = document.getElementById('stv-count-val');
                            if (countEl) countEl.innerText = total;

                            if (onSuccess) onSuccess(rawName, luckCost);
                        }).catch(() => {
                            let total = Stats.addHistory(rawName, 0);
                            let countEl = document.getElementById('stv-count-val');
                            if (countEl) countEl.innerText = total;
                            if (onSuccess) onSuccess(rawName, 0);
                        });
                    }
                }, 600);
                return;
            }

            if (attempts > 30) {
                clearInterval(reader);
                if (onFail) onFail();
            }
        }, 100);
    }

    // --- QUÉT VÀ NHẶT ĐỒ GỠ BẪY ---
    function executeDirectCall() {
        let attempts = 0;
        let timer = setInterval(() => {
            attempts++;

            let btn = document.getElementById('nMMap');
            if (!btn) {
                let allBtns = document.querySelectorAll('i.btn.btn-info, button.btn.btn-info, a.btn.btn-info');
                for (let b of allBtns) {
                    if ((b.innerText || "").includes("Nhặt")) { btn = b; break; }
                }
            }

            if (btn) {
                clearInterval(timer);
                try {
                    btn.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
                    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    btn.click();
                } catch (e) {
                    console.log(e);
                }

                readAndClosePopup(
                    (itemName, luckCost) => {
                        State.setPending(false);
                        showItemToast(itemName, luckCost);
                        startCountdown("🎁 Có bảo vật!");
                    },
                    () => {
                        State.setPending(false);
                        startCountdown("❌ Nhặt xịt");
                    }
                );
                return;
            }

            if (attempts >= 12) {
                clearInterval(timer);
                State.setPending(false);
                startCountdown("❌ Không có đồ");
            }
        }, 250);
    }

    // --- ĐẾM NGƯỢC VÀ CHUYỂN CHƯƠNG ---
    function startCountdown(statusMsg = "❌ Không có đồ") {
        if (!State.isAuto()) return;
        clearTimer();
        startLiveClock();

        let time = Math.floor(Math.random() * (CONFIG.maxWait - CONFIG.minWait) + CONFIG.minWait);
        let seconds = Math.floor(time / 1000);

        startAutoScroll(time);

        const tick = () => {
            if (!State.isAuto()) return;
            const btn = document.getElementById('stv-auto-btn');
            if (btn) btn.innerText = `${statusMsg} | ⏳ ${seconds}s`;
            if (seconds <= 0) {
                saveActiveSessionTime();
                goToNextChapter();
            } else {
                seconds--;
                win.__stv_timer = setTimeout(tick, 1000);
            }
        };
        tick();
    }

    // --- RETRY CHUYỂN CHƯƠNG ---
    let chapterRetryCount = 0;
    function goToNextChapter() {
        let currentUrl = window.location.href;
        let nextUrl = null;

        let navNext = document.getElementById('navnexttop') || document.getElementById('navnextbot');
        if (navNext && navNext.href && navNext.href !== currentUrl && !navNext.href.endsWith('/0/')) {
            nextUrl = navNext.href;
        }

        if (!nextUrl) {
            let links = Array.from(document.querySelectorAll('a'));
            for (let link of links) {
                let t = (link.innerText || "").trim().toLowerCase();
                if (t === "chương sau" && link.href && link.href !== currentUrl) {
                    nextUrl = link.href; break;
                }
            }
        }

        if (nextUrl && nextUrl !== currentUrl) {
            location.href = nextUrl;
        } else {
            chapterRetryCount++;
            console.log(`[STV-Farm] Chưa tìm thấy link chương sau (Lần ${chapterRetryCount}). Chờ thử lại...`);
            if (chapterRetryCount >= 5) {
                console.log("[STV-Farm] Reloading...");
                location.reload();
            } else {
                setTimeout(goToNextChapter, 2000);
            }
        }
    }

    function runFarmingLogic() {
        if (State.isPending()) { executeDirectCall(); return; }

        setTimeout(() => {
            if (typeof win.tryCollect === 'function') {
                try { win.tryCollect(true); } catch(e) {}
            }
            executeDirectCall();
        }, 1200);
    }

    // --- SỬA TRIỆT ĐỂ BẮT NHẦM CỤM "502/504" TỪ TIÊU ĐỀ CHƯƠNG TRUYỆN ---
    function startVisualMonitor() {
        if (!State.isAuto()) return;
        let bodyText = document.body?.innerText || "";
        let titleText = (document.title || "").trim();

        // CHỈ COI LÀ LỖI SERVER KHI NỘI DUNG RẤT NGẮN (< 500 KÝ TỰ) VÀ TRÙNG CHÍNH XÁC CỤM LỖI NGINX
        const isNginxError = (bodyText.length < 500) && (
            titleText === "504 Gateway Time-out" ||
            titleText === "502 Bad Gateway" ||
            titleText === "500 Internal Server Error" ||
            bodyText.includes("504 Gateway Time-out") ||
            bodyText.includes("502 Bad Gateway") ||
            bodyText.includes("500 Internal Server Error")
        );

        if (isNginxError) {
            console.log("[STV-Farm] Phát hiện lỗi Server Nginx thực sự (504/502). Reloading sau 3s...");
            const btn = document.getElementById('stv-auto-btn');
            if (btn) btn.innerText = "⚠️ Lỗi Server 504 | 🔄 Reloading...";

            setTimeout(() => location.reload(), CONFIG.reloadDelay);
            return;
        }

        if (bodyText.length < 500 && (bodyText.includes("Đang tải nội dung") || bodyText.includes("Loading"))) {
            setTimeout(startVisualMonitor, 800); return;
        }

        if (bodyText.includes('tự khắc phục') || bodyText.includes('Tải chương thất bại')) {
            setTimeout(() => location.reload(), CONFIG.reloadDelay);
            return;
        }

        startLiveClock();
        processCultivation(() => {
            runFarmingLogic();
        });
    }

    function createUI() {
        injectStyles();
        if (document.getElementById('stv-panel')) return;

        let panel = document.createElement('div');
        panel.id = 'stv-panel';

        let active = State.isAuto();

        panel.innerHTML = `
            <button id="stv-auto-btn" class="${active ? '' : 'off'}">
                ${active ? '🔍 Checking...' : '😴 PAUSED'}
            </button>
            <div class="stv-stats-box" id="stv-stats-box-trigger" title="Nhấn để mở Bảng Thống Kê">
                <div class="stv-stat-item">
                    ⏱️ <span id="stv-time-val" class="stv-stat-val">${formatTime(Stats.getElapsedMs())}</span>
                </div>
                <span>|</span>
                <div class="stv-stat-item">
                    🎁 <span id="stv-count-val" class="stv-stat-val">${Stats.getItemsCount()}</span>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        document.getElementById('stv-stats-box-trigger').onclick = showStatsModal;

        let btn = document.getElementById('stv-auto-btn');
        btn.onclick = () => {
            let nextState = !State.isAuto();
            State.setAuto(nextState);

            if (nextState) {
                btn.classList.remove('off');
                btn.innerText = "🔍 Checking...";
                startVisualMonitor();
            } else {
                btn.classList.add('off');
                btn.innerText = "😴 PAUSED";
                saveActiveSessionTime();
                clearTimer();
            }
        };
    }

    window.addEventListener('load', () => {
        createUI();
        if (State.isAuto()) setTimeout(startVisualMonitor, 1000);
    });
})();