import { logger } from '../utils/logger.js';

const SCORE_COLORS  = { high: 0x00C853, mid: 0xFF9800, low: 0xEF5350 };
const URGENCY_ICONS = { urgent: '🔥', normal: '📌', low: '·' };

export async function notifyDiscord(signal, webhookUrl) {
    if (!webhookUrl) return false;

    const color =
        signal.score >= 80 ? SCORE_COLORS.high :
        signal.score >= 60 ? SCORE_COLORS.mid  :
        SCORE_COLORS.low;

    const fields = [
        {
            name:   '📝 Signal',
            value:  (signal.text || '').substring(0, 300) + ((signal.text?.length || 0) > 300 ? '...' : ''),
            inline: false,
        },
        {
            name:   '💡 Reasoning',
            value:  signal.reasoning || 'N/A',
            inline: false,
        },
        {
            name:   '✉️ Outreach Angle',
            value:  signal.outreach_angle || 'N/A',
            inline: false,
        },
    ];

    if (signal.budget_hint) {
        fields.push({ name: '💰 Budget Hint', value: signal.budget_hint, inline: true });
    }
    if (signal.business_match) {
        fields.push({ name: '🏢 Routed To', value: signal.business_match, inline: true });
    }

    const embed = {
        title:       `${URGENCY_ICONS[signal.urgency] || '📌'} Signal #${signal.num} — Score ${signal.score}/100`,
        color,
        description: `**Source:** ${signal.source}  |  **Author:** ${signal.author}`,
        url:         signal.url,
        fields,
        footer:      { text: `Signal Hunter • ${signal.urgency || 'normal'} urgency` },
        timestamp:   new Date().toISOString(),
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
