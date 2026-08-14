/* ─────────────────────────────────────────────────────────
   Toandn — Control Panel JS
   © 2025 Toandn — Toandn
   Zalo: 0977.896.644 | Website: https://Toandn
───────────────────────────────────────────────────────── */

/* ═══ TAB NAVIGATION ════════════════════════════════════ */
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab)?.classList.add('active');
    });
});

/* ═══ UI ELEMENT REFS ════════════════════════════════════ */
const ui = {
    // Navbar status
    statusDot:      document.getElementById('status-dot'),
    statusTitle:    document.getElementById('status-title'),
    // Card status (tab live)
    statusCardDot:  document.getElementById('status-card-dot'),
    statusTitleCard:document.getElementById('status-title-card'),
    statusMessage:  document.getElementById('status-message'),
    // Live tab
    username:       document.getElementById('username'),
    connect:        document.getElementById('connect'),
    disconnect:     document.getElementById('disconnect'),
    // Live tab — EulerStream
    eulerUsername:  document.getElementById('euler-username'),
    eulerApiKey:    document.getElementById('euler-api-key'),
    eulerConnect:   document.getElementById('euler-connect'),
    eulerDisconnect:document.getElementById('euler-disconnect'),
    eulerHelp:      document.getElementById('euler-help'),
    // Nhân vật nền lấp sàn
    fillerCount:    document.getElementById('filler-count'),
    fillerInterval: document.getElementById('filler-interval'),
    fillerSpawn:    document.getElementById('filler-spawn'),
    fillerClear:    document.getElementById('filler-clear'),
    fillerState:    document.getElementById('filler-state'),
    // Test lab
    stopDemo:       document.getElementById('stop-demo'),
    // Session
    reset:          document.getElementById('reset'),
    // Events
    userIndex:      document.getElementById('user-index'),
    // Rules
    joinMode:       document.getElementById('join-mode'),
    giftAlwaysJoins:document.getElementById('gift-always-joins'),
    masterRules:    document.getElementById('master-rules'),
    masterRuleTemplate: document.getElementById('master-rule-template'),
    addMasterRule:  document.getElementById('add-master-rule'),
    saveMaster:     document.getElementById('save-master'),
    masterMessage:  document.getElementById('master-message'),
    recentGifts:    document.getElementById('recent-gifts'),
    metrics: {
        events:   document.getElementById('metric-events'),
        members:  document.getElementById('metric-members'),
        chats:    document.getElementById('metric-chats'),
        gifts:    document.getElementById('metric-gifts'),
        diamonds: document.getElementById('metric-diamonds'),
        likes:    document.getElementById('metric-likes'),
    },
};

/* ═══ STATE ══════════════════════════════════════════════ */
let socket;
let reconnectTimer;
let masterConfig = { joinMode: 'keyword_only', giftAlwaysJoins: true, rules: [] };
const recentGifts = new Map();

/* ═══ WEBSOCKET ══════════════════════════════════════════ */
function send(message) {
    if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
    }
}

function setStatus(data) {
    const state = data.state || '';
    ui.statusDot.className = 'status-dot ' + state;
    if (ui.statusCardDot) ui.statusCardDot.className = 'status-card-dot ' + state;

    const names = {
        idle:         'Sẵn sàng',
        connecting:   'Đang kết nối…',
        connected:    '🔴 LIVE',
        demo:         '🧪 DEMO',
        disconnected: 'Mất kết nối',
        ended:        'Live kết thúc',
        error:        'Lỗi kết nối',
    };
    const label = names[state] || state;
    ui.statusTitle.textContent = label;
    if (ui.statusTitleCard) ui.statusTitleCard.textContent = label;
    if (ui.statusMessage)   ui.statusMessage.textContent = data.message || '';
    ui.connect.disabled = state === 'connecting';
    if (ui.eulerConnect) ui.eulerConnect.disabled = state === 'connecting';

    // Badge đỏ nhấp nháy khi đang LIVE thật
    const liveBadge = document.getElementById('live-badge');
    if (liveBadge) liveBadge.classList.toggle('is-live', state === 'connected');
}

function setMetrics(data) {
    for (const [key, el] of Object.entries(ui.metrics)) {
        el.textContent = Number(data[key] || 0).toLocaleString('vi-VN');
    }
}

/* ═══ MASTER RULES ═══════════════════════════════════════ */
function makeRuleId() {
    return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyRule(overrides = {}) {
    return {
        id: makeRuleId(), enabled: true, source: 'gift', trigger: '',
        giftId: '', match: 'exact', action: 'dance', displayDiamonds: 0,
        durationMs: 3000, label: '', variant: '', fireworkBursts: 0, ...overrides,
    };
}

function setMasterMessage(msg, error = false) {
    ui.masterMessage.textContent = msg || '';
    ui.masterMessage.classList.toggle('error', error);
}

function updateRuleSource(row) {
    const source  = row.querySelector('[data-field="source"]').value;
    const giftId  = row.querySelector('[data-field="giftId"]');
    giftId.disabled     = source !== 'gift';
    giftId.placeholder  = source === 'gift' ? 'ID (nếu có)' : 'Không dùng cho chat';

    // Cập nhật border + badge màu theo loại
    row.dataset.src = source;
    const badge = row.querySelector('[data-src-label]');
    if (badge) {
        badge.textContent = source === 'gift' ? 'GIFT' : 'CHAT';
        badge.className   = `src-badge ${source}`;
    }
}

function createRuleRow(rule) {
    const row = ui.masterRuleTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.ruleId = rule.id || makeRuleId();
    for (const input of row.querySelectorAll('[data-field]')) {
        const field = input.dataset.field;
        if (field === 'durationSeconds') input.value = (Number(rule.durationMs) || 0) / 1000;
        else if (input.type === 'checkbox') input.checked = rule[field] !== false;
        else input.value = rule[field] ?? '';
    }
    row.querySelector('[data-field="source"]').addEventListener('change', () => updateRuleSource(row));
    row.querySelector('[data-command="delete"]').addEventListener('click', () => row.remove());
    row.querySelector('[data-command="test"]').addEventListener('click', () => {
        const config = readMasterFromUi();
        send({ type: 'master_save', master: config });
        send({ type: 'master_test', ruleId: row.dataset.ruleId, diamonds: 100 });
        setMasterMessage('Đang test luật trên Unity…');
    });
    updateRuleSource(row);
    return row;
}

function renderMaster(config) {
    masterConfig = config || masterConfig;
    ui.joinMode.value        = masterConfig.joinMode || 'keyword_only';
    ui.giftAlwaysJoins.checked = masterConfig.giftAlwaysJoins !== false;
    ui.masterRules.replaceChildren(...(masterConfig.rules || []).map(createRuleRow));
}

// Đọc một ô trong dòng luật. Trả về '' khi template thiếu ô đó, thay vì để
// querySelector trả null rồi làm sập cả hàm lưu — mất luôn khả năng lưu config.
function fieldValue(row, name) {
    return row.querySelector(`[data-field="${name}"]`)?.value ?? '';
}

function fieldChecked(row, name) {
    return row.querySelector(`[data-field="${name}"]`)?.checked ?? false;
}

function readMasterFromUi() {
    const rules = [...ui.masterRules.querySelectorAll('.master-rule-row')].map(row => ({
        id:              row.dataset.ruleId,
        enabled:         fieldChecked(row, 'enabled'),
        source:          fieldValue(row, 'source'),
        trigger:         fieldValue(row, 'trigger').trim(),
        giftId:          fieldValue(row, 'giftId').trim(),
        match:           fieldValue(row, 'match'),
        action:          fieldValue(row, 'action'),
        displayDiamonds: Number(fieldValue(row, 'displayDiamonds')) || 0,
        durationMs:      Math.round((Number(fieldValue(row, 'durationSeconds')) || 0) * 1000),
        label:           fieldValue(row, 'label').trim(),
        variant:         fieldValue(row, 'variant'),
        fireworkBursts:  Number(fieldValue(row, 'fireworkBursts')) || 0,
    }));
    return { joinMode: ui.joinMode.value, giftAlwaysJoins: ui.giftAlwaysJoins.checked, rules };
}

/* ═══ GIFT CATALOG ═══════════════════════════════════════ */
function observeGift(data) {
    const key = String(data.giftId || data.giftName || 'gift');
    recentGifts.set(key, data);
    while (recentGifts.size > 60) recentGifts.delete(recentGifts.keys().next().value);
    renderGiftCatalog();
}

function renderGiftCatalog() {
    ui.recentGifts.replaceChildren(
        ...[...recentGifts.values()].reverse().map(gift => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'gift-catalog-item';
            if (gift.giftPictureUrl) {
                const img = document.createElement('img');
                img.src = gift.giftPictureUrl;
                img.alt = '';
                img.loading = 'lazy';
                btn.append(img);
            }
            const span = document.createElement('span');
            span.textContent = `${gift.giftName || 'Gift'} · ID ${gift.giftId || '?'} · ${gift.diamondCount || 0}💎`;
            btn.append(span);
            btn.addEventListener('click', () => {
                ui.masterRules.append(createRuleRow(emptyRule({
                    source: 'gift', trigger: gift.giftName || '',
                    giftId: String(gift.giftId || ''),
                    displayDiamonds: Number(gift.diamondCount) || 0, action: 'dance',
                })));
                setMasterMessage('Đã thêm gift vào cuối bảng. Chọn hành động rồi bấm Lưu & áp dụng.');
            });
            return btn;
        })
    );
}

/* ═══ BÁO CÁO PHIÊN LIVE ═════════════════════════════════ */
const METRIC_LABELS = {
    diamonds: 'Diamond', events: 'Sự kiện', gifts: 'Gift',
    chats: 'Bình luận', members: 'Người vào', likes: 'Like',
};

function formatNumber(value) {
    return Number(value || 0).toLocaleString('vi-VN');
}

function formatDuration(ms) {
    const total = Math.max(0, Math.round(Number(ms) || 0) / 1000);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours) return `${hours}h${String(minutes).padStart(2, '0')}`;
    return `${minutes}m${String(Math.floor(total % 60)).padStart(2, '0')}s`;
}

function svgEl(name, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    return el;
}

// Vẽ biểu đồ cột bằng SVG dựng tay: CSP chặn thư viện ngoài, và một biểu đồ
// cột đơn giản không đáng để kéo thêm phụ thuộc.
function renderReportChart(daily, metric) {
    const host = document.getElementById('report-chart');
    if (!host) return;
    host.replaceChildren();

    const W = 900;
    const H = 190;
    const padLeft = 46;
    const padBottom = 22;
    const padTop = 10;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none' });

    if (!daily.length) {
        svg.append(Object.assign(svgEl('text', {
            x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'empty',
        }), { textContent: 'Chưa có phiên nào được lưu.' }));
        host.append(svg);
        return;
    }

    const peak = Math.max(1, ...daily.map(d => Number(d[metric]) || 0));
    const plotH = H - padBottom - padTop;
    const plotW = W - padLeft - 8;

    // Ba đường lưới ngang kèm nhãn giá trị
    for (let step = 0; step <= 2; step += 1) {
        const value = Math.round((peak / 2) * step);
        const y = padTop + plotH - (plotH * step) / 2;
        svg.append(svgEl('line', { x1: padLeft, y1: y, x2: W - 8, y2: y, class: 'grid' }));
        svg.append(Object.assign(svgEl('text', {
            x: padLeft - 6, y: y + 3, 'text-anchor': 'end', class: 'axis',
        }), { textContent: formatNumber(value) }));
    }

    const slot = plotW / daily.length;
    const barW = Math.max(2, Math.min(34, slot * 0.68));
    // Chỉ ghi nhãn ngày thưa ra để không chồng chữ khi khoảng thời gian dài.
    const labelEvery = Math.ceil(daily.length / 12);

    daily.forEach((day, index) => {
        const value = Number(day[metric]) || 0;
        const barH = Math.max(value > 0 ? 2 : 0, (value / peak) * plotH);
        const x = padLeft + slot * index + (slot - barW) / 2;
        const bar = svgEl('rect', {
            x, y: padTop + plotH - barH, width: barW, height: barH, rx: 2, class: 'bar',
        });
        bar.append(Object.assign(svgEl('title'), {
            textContent: `${day.day} · ${formatNumber(value)} ${METRIC_LABELS[metric]} · ${day.sessions} phiên`,
        }));
        svg.append(bar);

        if (index % labelEvery === 0 || index === daily.length - 1) {
            svg.append(Object.assign(svgEl('text', {
                x: x + barW / 2, y: H - 7, 'text-anchor': 'middle', class: 'axis',
            }), { textContent: day.day.slice(5) }));
        }
    });

    host.append(svg);
}

function renderSessionRows(list) {
    const body = document.getElementById('report-rows');
    if (!body) return;

    if (!list.length) {
        const row = document.createElement('tr');
        row.className = 'empty-row';
        const cell = document.createElement('td');
        cell.colSpan = 8;
        cell.textContent = 'Chưa có phiên nào. Phiên sẽ tự lưu khi ngắt kết nối hoặc live kết thúc.';
        row.append(cell);
        body.replaceChildren(row);
        return;
    }

    body.replaceChildren(...list.map(item => {
        const row = document.createElement('tr');
        const started = new Date(item.startedAt);
        const top = (item.topGifters || [])
            .map(g => `${g.nickname || g.uniqueId} (${formatNumber(g.diamonds)}💎)`)
            .join(', ');

        const cells = [
            [started.toLocaleString('vi-VN'), ''],
            [item.username ? '@' + item.username : '—', ''],
            [item.provider, 'tag'],
            [formatDuration(item.durationMs), 'num'],
            [formatNumber(item.events), 'num'],
            [formatNumber(item.gifts), 'num'],
            [formatNumber(item.diamonds), 'num gold'],
            [top || '—', ''],
        ];
        for (const [text, cls] of cells) {
            const cell = document.createElement('td');
            if (cls === 'tag') {
                const tag = document.createElement('span');
                tag.className = 'src-tag';
                tag.textContent = text;
                cell.append(tag);
            } else {
                cell.className = cls;
                cell.textContent = text;
            }
            row.append(cell);
        }
        return row;
    }));
}

async function loadReport() {
    const metric = document.getElementById('report-metric')?.value || 'diamonds';
    const days = Number(document.getElementById('report-range')?.value) || 30;
    const summary = document.getElementById('report-summary');
    try {
        const response = await fetch(`/api/sessions?days=${days}`);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        renderReportChart(data.daily || [], metric);
        renderSessionRows(data.sessions || []);

        const totals = (data.daily || []).reduce((sum, day) => sum + (Number(day[metric]) || 0), 0);
        summary.textContent = data.total
            ? `${data.total} phiên đã lưu · tổng ${formatNumber(totals)} ${METRIC_LABELS[metric]} trong ${days} ngày gần nhất.`
            : 'Chưa có phiên nào được lưu.';
    } catch (error) {
        if (summary) summary.textContent = 'Không tải được lịch sử: ' + error.message;
    }
}

async function loadLogs() {
    const host = document.getElementById('log-view');
    if (!host) return;
    const errorsOnly = document.getElementById('log-errors-only')?.checked;
    try {
        const response = await fetch(`/api/logs?limit=150${errorsOnly ? '&level=error' : ''}`);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const { entries = [] } = await response.json();

        if (!entries.length) {
            const empty = document.createElement('div');
            empty.className = 'log-empty';
            empty.textContent = errorsOnly ? 'Không có lỗi nào. 👍' : 'Chưa có log.';
            host.replaceChildren(empty);
            return;
        }

        host.replaceChildren(...entries.map(entry => {
            const line = document.createElement('div');
            line.className = 'log-line ' + entry.level;
            const time = document.createElement('span');
            time.className = 'log-time';
            time.textContent = new Date(entry.at).toLocaleTimeString('vi-VN');
            const scope = document.createElement('span');
            scope.className = 'log-scope';
            scope.textContent = '[' + entry.scope + ']';
            const text = document.createElement('span');
            text.className = 'log-text';
            text.textContent = entry.message + (entry.detail ? ' — ' + entry.detail : '');
            line.append(time, scope, text);
            return line;
        }));
        host.scrollTop = host.scrollHeight;
    } catch (error) {
        host.textContent = 'Không tải được log: ' + error.message;
    }
}

/* ═══ NHÂN VẬT NỀN ═══════════════════════════════════════ */
function setFillerState(data) {
    if (!ui.fillerState) return;
    const running = data.running && data.count > 0;
    ui.fillerState.textContent = running
        ? `${data.count} nhân vật · ${(data.intervalMs / 1000).toFixed(1)}s`
        : 'Đang tắt';
    ui.fillerState.className = 'src-badge ' + (running ? 'on' : 'off');
}

/* ═══ SERVER CONFIG ══════════════════════════════════════ */
function applyServerConfig(data) {
    // Server chi bao da co key hay chua, khong gui key that ra ngoai.
    if (!ui.eulerHelp || !data.hasEulerKey) return;
    ui.eulerHelp.textContent = 'Server đã có sẵn API key. Chỉ cần nhập username rồi bấm Kết nối.';
    if (ui.eulerApiKey) ui.eulerApiKey.placeholder = 'Đã có key — để trống nếu không đổi';
}

/* ═══ SOCKET ═════════════════════════════════════════════ */
function connectSocket() {
    clearTimeout(reconnectTimer);
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${location.host}`);

    socket.addEventListener('open', () => {
        send({ type: 'register', role: 'control' });
    });

    socket.addEventListener('message', event => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === 'config')         applyServerConfig(data);
        if (data.type === 'filler_state')   setFillerState(data);
        if (data.type === 'status' || data.type === 'error') setStatus(data);
        if (data.type === 'metrics')        setMetrics(data);
        if (data.type === 'master_config')  renderMaster(data.master);
        if (data.type === 'master_saved')   setMasterMessage(data.message || 'Đã lưu Master.');
        if (data.type === 'gift_observed')  observeGift(data);
        if (data.type === 'gift_catalog') {
            recentGifts.clear();
            for (const g of data.gifts || [])
                recentGifts.set(String(g.giftId || g.giftName || 'gift'), g);
            renderGiftCatalog();
        }
        if (data.type === 'error') setMasterMessage(data.message || 'Có lỗi.', true);
        // Vừa có phiên được chốt -> làm tươi báo cáo ngay.
        if (data.type === 'session_saved') { loadReport(); loadLogs(); }
    });

    socket.addEventListener('close', () => {
        setStatus({ state: 'disconnected', message: 'Đang kết nối lại máy chủ…' });
        reconnectTimer = setTimeout(connectSocket, 2000);
    });

    socket.addEventListener('error', () => socket.close());
}

/* ═══ EVENT LISTENERS ════════════════════════════════════ */
ui.connect.addEventListener('click', () => {
    const username = ui.username.value.trim();
    // Gui provider ro rang de con doi nguoc lai duoc sau khi da dung EulerStream.
    if (username) send({ type: 'set_username', username, provider: 'tikfinity' });
});
ui.username.addEventListener('keydown', e => { if (e.key === 'Enter') ui.connect.click(); });
ui.disconnect.addEventListener('click', () => send({ type: 'disconnect_tiktok' }));

/* ═══ EULERSTREAM ════════════════════════════════════════ */
function connectEulerStream() {
    const username = ui.eulerUsername.value.trim();
    if (!username) return;
    send({
        type: 'set_username',
        username,
        provider: 'eulerstream',
        // Bo trong khi server da co san key tu .env hoac tu lan nhap truoc.
        apiKey: ui.eulerApiKey.value.trim(),
    });
}

if (ui.eulerConnect) {
    ui.eulerConnect.addEventListener('click', connectEulerStream);
    for (const input of [ui.eulerUsername, ui.eulerApiKey]) {
        input?.addEventListener('keydown', e => { if (e.key === 'Enter') connectEulerStream(); });
    }
}
ui.eulerDisconnect?.addEventListener('click', () => send({ type: 'disconnect_tiktok' }));

/* ═══ NHÂN VẬT NỀN ═══════════════════════════════════════ */
ui.fillerSpawn?.addEventListener('click', () => send({
    type: 'filler_spawn',
    count: Number(ui.fillerCount.value) || 0,
    intervalMs: Math.round((Number(ui.fillerInterval.value) || 4) * 1000),
}));
ui.fillerClear?.addEventListener('click', () => send({ type: 'filler_clear' }));

/* ═══ BÁO CÁO ════════════════════════════════════════════ */
document.getElementById('report-refresh')?.addEventListener('click', loadReport);
document.getElementById('report-metric')?.addEventListener('change', loadReport);
document.getElementById('report-range')?.addEventListener('change', loadReport);
document.getElementById('log-refresh')?.addEventListener('click', loadLogs);
document.getElementById('log-errors-only')?.addEventListener('change', loadLogs);

// Mở tab Session thì tải lại số liệu cho tươi.
document.querySelector('.tab-btn[data-tab="session"]')?.addEventListener('click', () => {
    loadReport();
    loadLogs();
});
ui.stopDemo.addEventListener('click',   () => send({ type: 'demo_stop' }));
ui.reset.addEventListener('click',     () => send({ type: 'reset_game' }));
ui.addMasterRule.addEventListener('click', () => ui.masterRules.append(createRuleRow(emptyRule())));
ui.saveMaster.addEventListener('click', () => {
    send({ type: 'master_save', master: readMasterFromUi() });
    setMasterMessage('Đang lưu và áp dụng…');
});

document.querySelectorAll('[data-demo-count]').forEach(btn => {
    btn.addEventListener('click', () =>
        send({ type: 'demo_start', count: Number(btn.dataset.demoCount) })
    );
});

document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () =>
        send({
            type:      'demo_event',
            action:    btn.dataset.action,
            value:     Number(btn.dataset.value) || 1,
            giftName:  btn.dataset.giftName || '',
            userIndex: Number(ui.userIndex.value) || 1,
        })
    );
});

/* ═══ INIT ═══════════════════════════════════════════════ */
connectSocket();
loadReport();
loadLogs();
