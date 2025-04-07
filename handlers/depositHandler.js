//deposit
/**
 * =============================================
 *             ORDER BOT SERVICE 
 * =============================================
 * 
 * A Telegram bot for managing orders and services
 * Built with Node.js and Telegraf
 * 
 * Author: @hiyaok (Telegram)
 * Version: V1
 * Source Code by @hiyaok on Telegram
 * 
 * Features:
 * - Order management 
 * - Service catalog
 * - Real-time status updates
 * - User registration
 * - Admin dashboard
 * - Order history tracking
 * 
 * =============================================
 * Created by @hiyaok
 * =============================================
 */

//module
const { Markup } = require('telegraf');
const config = require('../config/config.json');
const { readData } = require('../helpers/fileHelper');

const handleDeposit = async (ctx) => {
    // Check if user is registered (except for admins)
    if (!config.adminIds.includes(String(ctx.from.id))) {
        const data = readData();
        const user = data.users.find(u => u.id === ctx.from.id);
        
        if (!user) {
            return ctx.reply(
                '⚠️ Anda belum terdaftar, sila gunakan /start terlebih dahulu',
                { parse_mode: 'Markdown' }
            );
        }
    }

    const text = ctx.message.text;
    const amount = text.split(' ')[1];

    if (!amount || isNaN(amount)) {
        return ctx.reply(
            '╔═══════════════════╗\n' +
            '║    💎 *TOPUP SALDO*    ║\n' +
            '╚═══════════════════╝\n\n' +
            '*Format Deposit:*\n' +
            '```/deposit <jumlah>```\n\n' +
            '*Contoh:*\n' +
            '```/deposit 5```',
            { 
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([[
                    Markup.button.callback('🔙 Kembali', 'back')
                ]])
            }
        );
    }

    // Validate minimum deposit
    if (parseInt(amount) < config.minimumDeposit) {
        return ctx.reply(
            '╔═══════════════════╗\n' +
            '║    ⚠️ *GAGAL*    ║\n' +
            '╚═══════════════════╝\n\n' +
            `*Minimum Deposit: RM${config.minimumDeposit.toLocaleString()}*\n\n` +
            '*Format yang benar:*\n' +
            '```/deposit <jumlah>```\n\n' +
            '*Contoh:*\n' +
            `\`\`\`/deposit ${config.minimumDeposit}\`\`\``,
            { parse_mode: 'Markdown' }
        );
    }

    const message = 
        '╔═══════════════════╗\n' +
        '║    💎 *TOPUP SALDO*   ║\n' +
        '╚═══════════════════╝\n\n' +
        `*Jumlah Deposit:* Rm ${parseInt(amount).toLocaleString()}\n\n` +
        '👉 *Silahkan Transfer Ke Qris Kami*\n👀 *Jika sudah silahkan klik tombol Done dibawah* 💡\n\n' +
        `*👨‍💻 Admin:* @DORAEMONBOOSTEROWNER`;

    // First send the QRIS image with caption
    await ctx.replyWithPhoto(
        { source: './assets/qris.jpg' },
        { caption: message, parse_mode: 'Markdown' }
    );

    // Then send the Done button
    return ctx.reply(
        '💡 *Klik tombol ini setelah melakukan pembayaran* :',
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[
                Markup.button.url('✅ Done Payment', `https://t.me/DORAEMONBOOSTEROWNER?text=halo%20kakak%20aku%20sudah%20membayar%20sebesar%20${parseInt(amount).toLocaleString()}%20mohon%20konfirmasinya%20ya`)
            ]])
        }
    );
};

module.exports = { handleDeposit };
