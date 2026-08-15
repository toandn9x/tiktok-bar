'use strict';

const fs = require('node:fs');

function parseEnv(content) {
    const values = {};
    for (const rawLine of String(content || '').split(/\r?\n/)) {
        let line = rawLine.replace(/^\uFEFF/, '').trim();
        if (!line || line.startsWith('#')) continue;
        if (line.startsWith('export ')) line = line.slice(7).trimStart();
        const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
        if (!match) continue;

        const key = match[1];
        let value = match[2].trim();
        const quote = value[0];
        if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
            value = value.slice(1, -1);
            if (quote === '"') {
                value = value
                    .replace(/\\n/g, '\n')
                    .replace(/\\r/g, '\r')
                    .replace(/\\t/g, '\t')
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\');
            }
        } else {
            value = value.replace(/\s+#.*$/, '').trimEnd();
        }
        values[key] = value;
    }
    return values;
}

function loadEnvFile(filePath, environment = process.env) {
    let content;
    try {
        content = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') return false;
        throw error;
    }
    for (const [key, value] of Object.entries(parseEnv(content))) {
        if (environment[key] === undefined) environment[key] = value;
    }
    return true;
}

module.exports = { parseEnv, loadEnvFile };
