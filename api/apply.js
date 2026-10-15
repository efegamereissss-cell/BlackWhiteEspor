// BWE Esports - Secure Serverless Application Handler
// Runs entirely on Vercel Backend - Webhook URL is NEVER exposed to the browser

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "https://discord.com/api/webhooks/1560302789173846121/mJ8BIRkL6gZIbls02gis5a9MmjCZMuTCcnaSYITD-D80bYOjSl3O3W-Qrl8rcjHheTJF";

// In-memory IP rate limiter (Server-side)
const cooldownMap = new Map();

module.exports = async (req, res) => {
    // Security Headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');

    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    try {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const now = Date.now();

        // 30 seconds rate limit per client IP
        if (cooldownMap.has(clientIp) && (now - cooldownMap.get(clientIp)) < 30000) {
            const remaining = Math.ceil((30000 - (now - cooldownMap.get(clientIp))) / 1000);
            return res.status(429).json({ ok: false, error: `Spam koruması: Lütfen ${remaining} saniye bekleyin.` });
        }

        const data = req.body || {};

        // Bot Honeypot trap check
        if (data.trap) {
            // Fake 200 response to confuse spam bots without executing any webhook
            return res.status(200).json({ ok: true });
        }

        // Required fields verification
        if (!data.fullName || !data.discordUsername || !data.riotId) {
            return res.status(400).json({ ok: false, error: 'Zorunlu alanlar eksik.' });
        }

        // Sanitization & String length limiting
        const clean = (val, max = 500) => {
            if (!val) return 'Belirtilmedi';
            return String(val)
                .replace(/@everyone/g, '@\u200beveryone')
                .replace(/@here/g, '@\u200bhere')
                .trim()
                .slice(0, max);
        };

        const fullName = clean(data.fullName, 100);
        const age = clean(data.age, 10);
        const discordUsername = clean(data.discordUsername, 80);
        const city = clean(data.city, 80);
        const riotId = clean(data.riotId, 80);
        const trackerLink = String(data.trackerLink || '').trim();
        const currentRank = clean(data.currentRank, 50);
        const peakRank = clean(data.peakRank, 50);
        const primaryRole = clean(data.primaryRole, 50);
        const agentsText = clean(data.agentsText, 300);
        const otherAgents = clean(data.otherAgents, 300);
        const scrimHours = clean(data.scrimHours, 200);
        const experience = clean(data.experience, 1000);

        // Structured Discord Embed
        const embedPayload = {
            username: "BWE Premier Başvuru Sistemi",
            avatar_url: "https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png",
            embeds: [
                {
                    title: `🏆 YENİ PREMIER BAŞVURUSU: [${primaryRole}]`,
                    description: `**${fullName}** Valorant Premier takımına katılmak için başvurdu.`,
                    color: 16729685, // Valorant Red #FF4655
                    fields: [
                        { name: "👤 Aday", value: `**Ad:** ${fullName}\n**Yaş:** ${age}\n**Şehir:** ${city}`, inline: true },
                        { name: "💬 Discord", value: `\`${discordUsername}\``, inline: true },
                        { name: "🎯 Premier Rolü", value: `**${primaryRole}**`, inline: true },
                        { name: "🎮 Riot ID", value: `\`${riotId}\``, inline: true },
                        { name: "🏆 Rank", value: `**Mevcut:** ${currentRank}\n**Peak:** ${peakRank}`, inline: true },
                        { name: "🔗 Tracker", value: trackerLink.startsWith('http') ? `[Tracker Profili](${trackerLink})` : 'Belirtilmedi', inline: true },
                        { name: "🦅 Seçilen Ajanlar", value: agentsText, inline: false },
                        { name: "⚡ Diğer Ajanlar", value: otherAgents, inline: false },
                        { name: "⏰ Premier Maç Uygunluğu", value: scrimHours, inline: false },
                        { name: "📜 Deneyim & Geçmiş", value: experience, inline: false }
                    ],
                    footer: { 
                        text: "Black White Esports • Güvenli Sunucu İletimi", 
                        icon_url: "https://media.valorant-api.com/agents/320b2a48-4d9b-a075-30f1-1f93a9b638fa/displayicon.png" 
                    },
                    timestamp: new Date().toISOString()
                }
            ]
        };

        const discordRes = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(embedPayload)
        });

        if (discordRes.ok) {
            cooldownMap.set(clientIp, now);
            return res.status(200).json({ ok: true, message: 'Başvurunuz başarıyla iletildi.' });
        } else {
            console.error('Discord API response status:', discordRes.status);
            return res.status(502).json({ ok: false, error: 'İletim hatası oluştu.' });
        }
    } catch (err) {
        console.error('API Error:', err);
        return res.status(500).json({ ok: false, error: 'Sunucu tarafında bir hata oluştu.' });
    }
};
