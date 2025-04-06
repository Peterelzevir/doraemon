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
const axios = require('axios');
const config = require('../config/config.json');
const { readData, writeData, getTransactionHistory } = require('../helpers/fileHelper');
// Store user sessions globally
const userSessions = new Map();

const handleRiwayat = async (ctx, page = 0) => {
    try {
        const data = readData();
        const user = data.users.find(u => u.id === ctx.from.id);

        // Check if user has no orders
        if (!user || !user.orders || user.orders.length === 0) {
            return ctx.reply(
                '╔═══════════════════╗\n' +
                '║   📜 *RIWAYAT*      ║\n' +
                '╚═══════════════════╝\n\n' +
                '👀 *Belum ada riwayat pesanan*\n' +
                '👉 *Kirim pesan /order buat order*',
                { parse_mode: 'Markdown' }
            );
        }

        // Pagination logic
        const ordersPerPage = 10;
        const totalOrders = user.orders.length;
        const totalPages = Math.max(1, Math.ceil(totalOrders / ordersPerPage));
        const currentPage = Math.max(0, Math.min(parseInt(page) || 0, totalPages - 1));
        
        const startIdx = currentPage * ordersPerPage;
        const endIdx = Math.min(startIdx + ordersPerPage, totalOrders);
        const recentOrders = user.orders.slice().reverse().slice(startIdx, endIdx);

        // Build message header
        let message = [
            '╔═══════════════════╗',
            '║   📜 *RIWAYAT*      ║',
            '╚═══════════════════╝\n'
        ].join('\n');

        // Process orders
        try {
            let orderStatuses = {};
            const orderIds = recentOrders.map(order => order.id);

            // Check if single order
            if (orderIds.length === 1) {
                try {
                    const response = await axios.post('https://api.medanpedia.co.id/status', {
                        api_id: config.apiId,
                        api_key: config.apiKey,
                        id: orderIds[0]
                    });

                    if (response.data.status && response.data.data) {
                        orderStatuses[orderIds[0]] = {
                            msg: response.data.msg,
                            status: response.data.data.status,
                            charge: response.data.data.charge,
                            start_count: response.data.data.start_count,
                            remains: response.data.data.remains
                        };
                    } else {
                        orderStatuses[orderIds[0]] = {
                            msg: response.data.msg || "Pesanan tidak ditemukan."
                        };
                    }
                } catch (error) {
                    console.error('Error fetching single order:', error);
                    orderStatuses[orderIds[0]] = {
                        msg: "Terjadi kesalahan saat mengecek pesanan."
                    };
                }
            } else {
                // Process multiple orders in batches of 50
                for (let i = 0; i < orderIds.length; i += 50) {
                    const batchIds = orderIds.slice(i, i + 50);
                    try {
                        const response = await axios.post('https://api.medanpedia.co.id/status', {
                            api_id: config.apiId,
                            api_key: config.apiKey,
                            id: batchIds.join(',')
                        });

                        if (response.data.status && response.data.orders) {
                            orderStatuses = { ...orderStatuses, ...response.data.orders };
                        }

                        // Add small delay between batches to prevent rate limiting
                        if (i + 50 < orderIds.length) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    } catch (error) {
                        console.error(`Error fetching batch ${i/50 + 1}:`, error);
                        // Set error status for failed batch orders
                        batchIds.forEach(id => {
                            if (!orderStatuses[id]) {
                                orderStatuses[id] = {
                                    msg: "Terjadi kesalahan saat mengecek pesanan."
                                };
                            }
                        });
                        continue;
                    }
                }
            }

            // Build order messages
            for (const order of recentOrders) {
                const status = orderStatuses[order.id];
                message += '\n───────────────────\n';
                message += [
                    `🔔 *Order #${order.id}*`,
                    `💡 Layanan: ${order.serviceName}`,
                    `✅ Status: ${status ? `${getStatusEmoji(status.status)} ${status.status}` : '👀'}`,
                    `👁‍🗨 Jumlah: ${order.quantity}`,
                    `💳 Harga: Rp ${order.price.toLocaleString()}`,
                    status ? `❕ Progress : ${status.remains}/${status.start_count}` : '',
                    `👀 Tanggal: ${formatDate(order.date)}`
                ].filter(Boolean).join('\n');
            }

            message += '\n───────────────────\n';
            // Add pagination info
            message += `\n📜 Halaman ${currentPage + 1} dari ${totalPages}`;

            // Create navigation buttons
            const buttons = [];
            const row1 = [];
            const row2 = [];

            if (currentPage > 0) {
                row1.push(Markup.button.callback('⬅️ Sebelumnya', `riwayat_${currentPage - 1}`));
            }
            if (currentPage < totalPages - 1) {
                row1.push(Markup.button.callback('Selanjutnya ➡️', `riwayat_${currentPage + 1}`));
            }
            row2.push(Markup.button.callback('❌ Tutup', 'riwayat_tutup'));

            // Send message with buttons
            const keyboard = [];
            if (row1.length > 0) keyboard.push(row1);
            keyboard.push(row2);

            const msgOptions = {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard(keyboard)
            };

            const sentMessage = await ctx.reply(message, msgOptions);
            userSessions.set(ctx.from.id, sentMessage.message_id);
            return sentMessage;

        } catch (err) {
            console.error('Failed to fetch order statuses:', err);
            throw new Error('Failed to fetch order statuses');
        }

    } catch (error) {
        console.error('Error in handleRiwayat:', error);
        return ctx.reply('❌ Terjadi kesalahan saat memuat riwayat. Silakan coba lagi.');
    }
};

// Helper function to get status emoji
const getStatusEmoji = (status) => {
    const statusEmojis = {
        'Pending': '⏳',
        'Processing': '⚙️',
        'Success': '✅',
        'Error': '❌',
        'Partial': '⚠️'
    };
    return statusEmojis[status] || '❓';
};

const handleRiwayatAction = async (ctx) => {
    try {
        const page = parseInt(ctx.callbackQuery.data.split('_')[1]);
        const messageId = userSessions.get(ctx.from.id);
        
        if (messageId) {
            await ctx.deleteMessage(messageId).catch(() => {});
        }
        
        await handleRiwayat(ctx, page);
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('Error in handleRiwayatAction:', error);
        await ctx.answerCbQuery('❌ Terjadi kesalahan');
    }
};

const handleRiwayatClose = async (ctx) => {
    try {
        const messageId = userSessions.get(ctx.from.id);
        if (messageId) {
            await ctx.deleteMessage(messageId);
            userSessions.delete(ctx.from.id);
        }
        await ctx.answerCbQuery('✅ Riwayat ditutup');
    } catch (error) {
        console.error('Error in handleRiwayatClose:', error);
        await ctx.answerCbQuery('❌ Terjadi kesalahan');
    }
};

const formatDate = (date) => {
    return new Date(date).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta', // WIB timezone
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false // Format 24 jam
    });
};

const handleRefill = async (ctx) => {
    await ctx.reply(
        '╔═══════════════════╗\n' +
        '║    ♻️ *REFILL*    ║\n' +
        '╚═══════════════════╝\n\n' +
        '*Masukkan ID pesanan:*\n' +
        'Ketik /cancel untuk membatalkan',
        { parse_mode: 'Markdown' }
    );

    const data = readData();
    const user = data.users.find(u => u.id === ctx.from.id);
    user.state = 'AWAITING_REFILL_ID';
    writeData(data);
};

const handleRefillId = async (ctx) => {
    const orderId = ctx.message.text;
    const data = readData();
    const user = data.users.find(u => u.id === ctx.from.id);

    // Clear user state
    delete user.state;
    writeData(data);
    
    if (orderId.toLowerCase() === '/cancel') {
        return ctx.reply(
            '✅ Permintaan refill dibatalkan.',
            Markup.inlineKeyboard([[
                Markup.button.callback('🔙 Kembali ke Menu', 'back')
            ]])
        );
    }

    try {
        const response = await axios.post('https://api.medanpedia.co.id/refill', {
            api_id: config.apiId,
            api_key: config.apiKey,
            id_order: orderId
        });

        if (response.data.status) {
            return ctx.reply(
                '╔═══════════════════╗\n' +
                '║   ✅ *BERHASIL*    ║\n' +
                '╚═══════════════════╝\n\n' +
                `*Refill ID:* #${response.data.data.id_refill}\n\n` +
                '*Permintaan refill berhasil dibuat*\n' +
                '*Mohon tunggu proses refill selesai*',
                { 
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([[
                        Markup.button.callback('🔙 Kembali', 'back')
                    ]])
                }
            );
        } else {
            throw new Error(response.data.msg);
        }
    } catch (error) {
        let errorMessage = 'Gagal memproses refill';
        if (error.response && error.response.data && error.response.data.msg) {
            errorMessage = error.response.data.msg;
        }
        return ctx.reply(
            '❌ ' + errorMessage + '\nSilahkan coba lagi atau hubungi admin'
        );
    }
};

const handleBalance = async (ctx) => {
    const data = readData();
    const user = data.users.find(u => u.id === ctx.from.id);

    // Get recent transactions
    const transactions = getTransactionHistory(ctx.from.id).slice(0, 5);
    let transactionText = '';
    
    if (transactions.length > 0) {
        transactionText = '\n\n*Transaksi Terakhir:*\n';
        transactions.forEach(trx => {
            const emoji = trx.type === 'deposit' ? '💎' : 
                         trx.type === 'order' ? '🛍️' : '💰';
            transactionText += `${emoji} ${trx.description}: Rp ${Math.abs(trx.amount).toLocaleString()}\n`;
        });
    }

    return ctx.reply(
        '╔═══════════════════╗\n' +
        '║   💰 *SALDO*      ║\n' +
        '╚═══════════════════╝\n\n' +
        `*Saldo Anda:* Rp ${user.balance.toLocaleString()}` +
        transactionText + '\n\n' +
        'Deposit saldo dengan perintah /deposit',
        { parse_mode: 'Markdown' }
    );
};

const handleCS = async (ctx) => {
    return ctx.reply(
        '╔═══════════════════╗\n' +
        '║   👨‍💻 *BANTUAN*    ║\n' +
        '╚═══════════════════╝\n\n' +
        '*Butuh bantuan? Hubungi customer service kami:*\n\n' +
        `Admin: @${config.csUsername}\n` +
        'Waktu Layanan: 09:00 - 21:00 WIB\n\n' +
        '✅ Fast Response\n' +
        '✅ Proses Cepat\n' +
        '✅ Trusted Admin',
        { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.url('💬 Chat Admin', `https://t.me/${config.csUsername}`)]
            ])
        }
    );
};

// Export semua handler
module.exports = {
    handleRiwayat,
    handleRefill,
    handleRefillId,
    handleBalance,
    handleCS,
    handleRiwayatClose,
    handleRiwayatAction
};