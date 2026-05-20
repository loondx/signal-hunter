import { logger } from '../utils/logger.js';

const SCORE_COLORS  = { high: 0x00C853, mid: 0xFF9800, low: 0xEF5350 };
const URGENCY_ICONS = { urgent: '🔥', normal: '📌', low: '·' };

const SOURCE_ICONS = {
    'Reddit':       '🔴',
    'Hacker News':  '🟠',
    'Remote OK':    '💻',
    'Remotive':     '💼',
    'Twitter':      '🐦',
    'Custom':       '🌐',
};

function sourceIcon(source) {
    for (const [key, icon] of Object.entries(SOURCE_ICONS)) {
        if (source?.includes(key)) return icon;
    }
    return '📡';
}

function truncate(text, max) {
    if (!text) return '';
    const clean = text.replace(/\n+/g, ' ').trim();
    return clean.length > max ? clean.substring(0, max) + '…' : clean;
}

export async function notifyDiscord(signal, webhookUrl) {
    if (!webhookUrl) return false;

    const color =
        signal.score >= 80 ? SCORE_COLORS.high :
        signal.score >= 60 ? SCORE_COLORS.mid  :
        SCORE_COLORS.low;

    const urgIcon  = URGENCY_ICONS[signal.urgency] || '📌';
    const srcIcon  = sourceIcon(signal.source);
    const action   = signal.action === 'apply' ? 'Apply now' : signal.action === 'dm' ? 'Send DM' : 'Reply';

    // Description: post snippet
    const snippet = truncate(signal.text, 400);

    const fields = [
        {
            name:   `${srcIcon} ${signal.source}  ·  by ${signal.author}`,
            value:  snippet || '_(no content)_',
            inline: false,
        },
        {
            name:   '💡 Why This Signal',
            value:  signal.reasoning || 'N/A',
            inline: false,
        },
    ];

    // Outreach angle as a code block — easy to select and copy
    if (signal.outreach_angle) {
        fields.push({
            name:   `✉️ ${action} — Copy & Send`,
            value:  `\`\`\`\n${signal.outreach_angle}\n\`\`\``,
            inline: false,
        });
    }

    // Budget and urgency on same row
    if (signal.budget_hint) {
        fields.push({ name: '💰 Budget', value: signal.budget_hint, inline: true });
    }
    if (signal.urgency && signal.urgency !== 'low') {
        fields.push({ name: '⚡ Urgency', value: signal.urgency.toUpperCase(), inline: true });
    }
    if (signal.business_match) {
        fields.push({ name: '🏢 Route To', value: signal.business_match, inline: true });
    }

    // Always show the direct link as a field — not just in the embed title
    fields.push({
        name:   '🔗 Open Post',
        value:  `[${truncate(signal.url, 80)}](${signal.url})`,
        inline: false,
    });

    const embed = {
        title:     `${urgIcon} Signal #${signal.num} — Score ${signal.score}/100`,
        color,
        url:       signal.url,
        description: `**${signal.score >= 80 ? 'HOT LEAD' : signal.score >= 70 ? 'Strong Lead' : 'Lead'} →** respond ${signal.urgency === 'urgent' ? 'TODAY' : 'soon'}`,
        fields,
        footer:    { text: `Signal Hunter  ·  ${signal.urgency || 'normal'} urgency  ·  ${new Date().toLocaleDateString()}` },
        timestamp: new Date().toISOString(),
    };

    try {
        const res = await fetch(webhookUrl, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ embeds: [embed] }),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            logger.error(`Discord webhook HTTP ${res.status}: ${body.slice(0, 200)}`);
        }
        return res.ok;
    } catch (err) {
        logger.error(`Discord webhook failed: ${err.message}`);
        return false;
    }
}
