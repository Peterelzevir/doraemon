// handlers/adminHandler.js

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
const { readData, writeData, addTransaction } = require('../helpers/fileHelper');

const handleServerBalance = async (ctx) => {
    if (!config.adminIds.includes(String(ctx.from.id))) {
        return ctx.reply('⛔ Akses ditolak');
    }

    try {
        const response = await axios.post('https://api.medanpedia.co.id/profile', {
            api_id: config.apiId,
            api_key: config.apiKey
        });

        if (response.data.status) {
            const { username, full_name, balance } = response.data.data;
            return ctx.reply(
                '╔═══════════════════╗\n' +
                '║   💳 *SERVER INFO*  ║\n' +
                '╚═══════════════════╝\n\n' +
                `*Username :* ${username}\n` +
                `*Name :* ${full_name}\n` +
                `*Balance :* Rp ${balance.toLocaleString()}\n\n` +
                'Jika saldo server hampir habis,\n' +
                'Silahkan hubungi provider untuk isi ulang.',
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
        return ctx.reply('❌ Gagal mengambil info server');
    }
};

const handleTotalUsers = async (ctx) => {
    if (!config.adminIds.includes(String(ctx.from.id))) {
        return ctx.reply('⛔ Akses ditolak');
    }

    const data = readData();
    const today = new Date();
    const todayStart = new Date(today.setHours(0,0,0,0));

    // Count users registered today
    const newToday = data.users.filter(u => 
        new Date(u.registeredAt) >= todayStart
    ).length;

    // Calculate total balance with validation
    const totalBalance = data.users.reduce((sum, user) => {
        // Make sure balance exists and is a number
        const userBalance = Number(user.balance) || 0;
        return sum + userBalance;
    }, 0);

    return ctx.reply(
        '╔═══════════════════╗\n' +
        '║   👥 INFO USER   ║\n' +
        '╚═══════════════════╝\n\n' +
        `Total User : ${data.users.length}\n` +
        `User Baru Hari Ini : ${newToday}\n` +
        `Total Saldo User : Rp ${totalBalance.toLocaleString()}\n\n` +
        '📊 Statistik diperbarui secara real-time',
        { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[
                Markup.button.callback('🔙 Kembali', 'back')
            ]])
        }
    );
};

const handleBroadcast = async (ctx) => {
    // Validate admin access
    if (!config.adminIds.includes(String(ctx.from.id))) {
        return ctx.reply('⛔ Akses ditolak');
    }

    try {
        const data = readData();
        let admin = data.users.find(u => u.id === ctx.from.id);
        
        // If admin is not in users list, add them
        if (!admin) {
            admin = {
                id: ctx.from.id,
                name: ctx.from.first_name,
                username: ctx.from.username,
                balance: 0,
                registeredAt: new Date().toISOString(),
                orders: []
            };
            data.users.push(admin);
        }

        // Update admin state
        admin.state = 'AWAITING_BROADCAST';
        writeData(data);

        // Send formatted broadcast prompt
        return ctx.reply(
            '╔═══════════════════╗\n' +
            '║     📢 *BROADCAST*     ║\n' +
            '╚═══════════════════╝\n\n' +
            '*Kirim pesan broadcast:*\n' +
            'Ketik /cancel untuk membatalkan',
            { 
                parse_mode: 'Markdown',
                reply_markup: {
                    force_reply: true
                }
            }
        );
    } catch (error) {
        console.error('Error in handleBroadcast:', error);
        return ctx.reply('❌ Terjadi kesalahan sistem. Silakan coba lagi nanti.');
    }
};

const handleBroadcastMessage = async (ctx) => {
    if (!config.adminIds.includes(String(ctx.from.id))) {
        return ctx.reply('⛔ Akses ditolak');
    }

    try {
        const data = readData();
        const message = ctx.message;

        // Handle cancel command
        if (message.text && message.text.toLowerCase() === '/cancel') {
            const admin = data.users.find(u => u.id === ctx.from.id);
            if (admin) {
                delete admin.state;
                writeData(data);
            }
            return ctx.reply('✅ Broadcast dibatalkan');
        }

        let successCount = 0;
        let failCount = 0;

        const statusMsg = await ctx.reply('📢 Mengirim broadcast...');

        for (const user of data.users) {
            try {
                await ctx.telegram.copyMessage(user.id, ctx.chat.id, message.message_id);
                successCount++;
                
                if (successCount % 10 === 0) {
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        statusMsg.message_id,
                        null,
                        `📢 Mengirim...\nBerhasil: ${successCount}\nGagal: ${failCount}`
                    );
                }
            } catch (error) {
                console.error(`Failed to send broadcast to user ${user.id}:`, error);
                failCount++;
            }
        }

        // Clear admin state
        const admin = data.users.find(u => u.id === ctx.from.id);
        if (admin) {
            delete admin.state;
            writeData(data);
        }

        return ctx.telegram.editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            null,
            '╔═══════════════════╗\n' +
            '║   📢 *BROADCAST*   ║\n' +
            '╚═══════════════════╝\n\n' +
            `✅ Berhasil: ${successCount}\n` +
            `❌ Gagal: ${failCount}\n` +
            `📊 Total: ${data.users.length}`,
            { 
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([[
                    Markup.button.callback('🔙 Kembali', 'back')
                ]])
            }
        );
    } catch (error) {
        console.error('Error in handleBroadcastMessage:', error);
        // Clear admin state in case of error
        const data = readData();
        const admin = data.users.find(u => u.id === ctx.from.id);
        if (admin) {
            delete admin.state;
            writeData(data);
        }
        return ctx.reply('❌ Terjadi kesalahan saat mengirim broadcast');
    }
};

const handleAddBalance = async (ctx) => {
    if (!config.adminIds.includes(String(ctx.from.id))) {
        return ctx.reply('⛔ Akses ditolak');
    }

    const args = ctx.message.text.split(' ');
    if (args.length !== 3) {
        return ctx.reply(
            '╔═══════════════════╗\n' +
            '║   💰 *ADD BALANCE*  ║\n' +
            '╚═══════════════════╝\n\n' +
            '*Format:*\n' +
            '```/tambahsaldo <user_id> <jumlah>```\n\n' +
            '*Contoh:*\n' +
            '```/tambahsaldo 123456789 50000```',
            { parse_mode: 'Markdown' }
        );
    }

    const userId = parseInt(args[1]);
    const amount = parseInt(args[2]);

    if (isNaN(userId) || isNaN(amount)) {
        return ctx.reply('❌ User ID dan jumlah harus berupa angka');
    }

    const data = readData();
    const user = data.users.find(u => u.id === userId);

    if (!user) {
        return ctx.reply('❌ User tidak ditemukan');
    }

    user.balance += amount;
    addTransaction(userId, 'deposit', amount, 'Deposit via Admin');
    writeData(data);

    // Notify user
    try {
        await ctx.telegram.sendMessage(
            userId,
            '╔═══════════════════╗\n' +
            '║   💰 *TOPUP BERHASIL*    ║\n' +
            '╚═══════════════════╝\n\n' +
            `💸 *Saldo Ditambahkan:* Rp ${amount.toLocaleString()}\n` +
            `💰 *Saldo Sekarang:* Rp ${user.balance.toLocaleString()}`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        // Ignore notification error
    }

    return ctx.reply(
        '╔═══════════════════╗\n' +
        '║   ✅ *BERHASIL*    ║\n' +
        '╚═══════════════════╝\n\n' +
        `*User:* ${user.name}\n` +
        `*ID:* ${user.id}\n` +
        `*Ditambahkan:* Rp ${amount.toLocaleString()}\n` +
        `*Saldo Sekarang:* Rp ${user.balance.toLocaleString()}`,
        { parse_mode: 'Markdown' }
    );
};

const handleActivity = async (ctx) => {
    if (!config.adminIds.includes(String(ctx.from.id))) {
        return ctx.reply('⛔ Akses ditolak');
    }

    const data = readData();
    const today = new Date();
    const todayStart = new Date(today.setHours(0,0,0,0));
    const monthStart = new Date(today.setDate(1));

    // Get today's orders
    const todayOrders = data.users.flatMap(u => 
        (u.orders || []).filter(o => 
            new Date(o.date) >= todayStart
        )
    );

    // Get month's orders
    const monthOrders = data.users.flatMap(u => 
        (u.orders || []).filter(o => 
            new Date(o.date) >= monthStart
        )
    );

    // Calculate totals
    const todayTotal = todayOrders.reduce((sum, order) => sum + order.price, 0);
    const monthTotal = monthOrders.reduce((sum, order) => sum + order.price, 0);

    const message = 
        '╔═══════════════════╗\n' +
        '║   📊 *AKTIVITAS*   ║\n' +
        '╚═══════════════════╝\n\n' +
        '*Statistik Hari Ini:*\n' +
        `Order: ${todayOrders.length}\n` +
        `Total: Rp ${todayTotal.toLocaleString()}\n\n` +
        '*Statistik Bulan Ini:*\n' +
        `Order: ${monthOrders.length}\n` +
        `Total: Rp ${monthTotal.toLocaleString()}\n\n` +
        '*Info User:*\n' +
        `Total User: ${data.users.length}\n` +
        `User Baru Hari Ini: ${data.users.filter(u => new Date(u.registeredAt) >= todayStart).length}`;

    return ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[
            Markup.button.callback('🔙 Kembali', 'back')
        ]])
    });
};

module.exports = {
    handleServerBalance,
    handleTotalUsers,
    handleBroadcast,
    handleBroadcastMessage,
    handleAddBalance,
    handleActivity
};