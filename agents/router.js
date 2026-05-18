// Resolves which contact to notify for a qualified signal.
// If businesses.yml has a match, uses that business's contact.
// Falls back to the profile's notification settings.

export function resolveNotification(signal, businesses, profileNotifications) {
    const envWebhook = process.env.DISCORD_WEBHOOK_URL;

    if (businesses?.length && signal.business_match) {
        const biz = businesses.find(b => b.id === signal.business_match);
        if (biz?.contact) {
            return {
                businessName:   biz.name,
                discordWebhook: biz.contact.discord_webhook || envWebhook || profileNotifications?.discord_webhook || '',
                email:          biz.contact.email || profileNotifications?.email || '',
            };
        }
    }

    return {
        businessName:   null,
        discordWebhook: envWebhook || profileNotifications?.discord_webhook || '',
        email:          profileNotifications?.email || '',
    };
}
