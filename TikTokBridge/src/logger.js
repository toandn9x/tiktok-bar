'use strict';

const fs = require('node:fs');
const path = require('node:path');

const LEVELS = new Set(['info', 'warn', 'error']);
const MAX_BUFFER = 300;
const MAX_MESSAGE = 2000;

// Vòng đệm trong RAM để Control Panel đọc nhanh mà không phải chạm đĩa.
const buffer = [];
let logDir = null;
let currentDay = null;
let stream = null;
let diskDisabled = false;

function today(now) {
    // Theo giờ máy, không phải UTC, để tên file khớp với ngày người dùng thấy.
    const offsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function configure(directory) {
    logDir = directory;
    diskDisabled = false;
    try {
        fs.mkdirSync(logDir, { recursive: true });
    } catch (error) {
        diskDisabled = true;
        console.warn(`Không tạo được thư mục log (${directory}): ${error.message}. Chỉ log ra màn hình.`);
    }
}

function streamFor(now) {
    if (diskDisabled || !logDir) return null;
    const day = today(now);
    if (stream && day === currentDay) return stream;
    if (stream) stream.end();
    currentDay = day;
    try {
        stream = fs.createWriteStream(path.join(logDir, `${day}.log`), { flags: 'a' });
        // Đĩa đầy hay mất quyền ghi cũng không được phép làm sập bridge.
        stream.on('error', error => {
            diskDisabled = true;
            console.warn(`Ngừng ghi log ra file: ${error.message}`);
        });
    } catch (error) {
        diskDisabled = true;
        console.warn(`Không mở được file log: ${error.message}`);
        stream = null;
    }
    return stream;
}

function write(level, scope, message, detail) {
    const now = new Date();
    const entry = {
        at: now.toISOString(),
        level: LEVELS.has(level) ? level : 'info',
        scope: String(scope || 'bridge').slice(0, 40),
        message: String(message ?? '').slice(0, MAX_MESSAGE),
        detail: detail === undefined ? undefined : String(detail).slice(0, MAX_MESSAGE)
    };

    buffer.push(entry);
    while (buffer.length > MAX_BUFFER) buffer.shift();

    const line = `${entry.at} [${entry.level.toUpperCase()}] [${entry.scope}] ${entry.message}` +
        (entry.detail ? ` | ${entry.detail}` : '');
    streamFor(now)?.write(`${line}\n`);
    return entry;
}

/**
 * Dịch lỗi kỹ thuật của EulerStream sang câu tiếng Việt nói rõ phải làm gì.
 * Đây là nhóm lỗi hay gặp nhất khi dùng API key nên đáng để nêu đích danh.
 */
function explainEulerError(rawMessage) {
    const text = String(rawMessage || '').toLowerCase();
    if (/401|unauthor|invalid.*(api.?key|token)|forbidden|403/.test(text)) {
        return 'API key EulerStream sai hoặc đã bị thu hồi. Kiểm tra lại key tại eulerstream.com.';
    }
    if (/429|rate.?limit|quota|too many requests/.test(text)) {
        return 'Đã hết lượt gọi EulerStream (quota). Chờ hạn mức reset hoặc nâng gói.';
    }
    if (/sign|signature/.test(text)) {
        return 'Máy chủ ký EulerStream từ chối yêu cầu. Thường do key hết hạn hoặc hết quota.';
    }
    if (/not.*live|offline|user.*not.*found|roomid/.test(text)) {
        return 'Tài khoản không ở trạng thái LIVE, hoặc sai username.';
    }
    if (/enotfound|econnrefused|etimedout|network|socket hang up/.test(text)) {
        return 'Không nối được tới EulerStream. Kiểm tra mạng hoặc tường lửa.';
    }
    return '';
}

/** Chờ các dòng log đang nằm trong bộ đệm được đẩy hết xuống đĩa. */
function flush() {
    return new Promise(resolve => {
        if (!stream || stream.destroyed || stream.writableEnded) return resolve();
        stream.write('', () => resolve());
    });
}

module.exports = {
    configure,
    flush,
    info: (scope, message, detail) => write('info', scope, message, detail),
    warn: (scope, message, detail) => write('warn', scope, message, detail),
    error: (scope, message, detail) => write('error', scope, message, detail),
    recent: (limit = 120) => buffer.slice(-Math.max(1, Math.min(MAX_BUFFER, limit))),
    explainEulerError
};
