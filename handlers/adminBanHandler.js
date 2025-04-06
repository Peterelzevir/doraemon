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
const fs = require('fs');
const config = require('../config/config.json');
const { readData, writeData } = require('../helpers/fileHelper');

const handleBan = async (ctx) => {
    try {
        // Convert admin ID to string for consistent comparison
        const adminId = String(ctx.from.id);
        
        if (!config.adminIds.includes(adminId)) {
            return ctx.reply('⛔ Akses ditolak');
        }

        const data = readData();
        
        // Initialize users array if it doesn't exist
        if (!data.users) {
            data.users = [];
        }

        // Try to find admin user
        let admin = data.users.find(u => String(u.id) === adminId);
        
        // If admin doesn't exist in users, create entry
        if (!admin) {
            admin = {
                id: parseInt(adminId),
                name: ctx.from.first_name,
                username: ctx.from.username || '',
                isAdmin: true
            };
            data.users.push(admin);
        }

        admin.state = 'AWAITING_BAN_ID';
        writeData(data);

        return ctx.reply(
            '╔═══════════════════╗\n' +
            '║    🚫 *BAN USER*   ║\n' +
            '╚═══════════════════╝\n\n' +
            '*Masukkan User ID yang akan di-ban:*\n' +
            'Ketik /cancel untuk membatalkan',
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('Error in handleBan:', error);
        return ctx.reply('❌ Terjadi kesalahan saat memproses permintaan');
    }
};

const handleBanId = async (ctx) => {
    try {
        if (!config.adminIds.includes(String(ctx.from.id))) {
            return ctx.reply('⛔ Akses ditolak');
        }

        const userId = ctx.message.text;
        const data = readData();
        const admin = data.users.find(u => u.id === ctx.from.id);
        
        // Clear admin state first
        if (admin) {
            delete admin.state;
            writeData(data);
        }
        
        if (userId.toLowerCase() === '/cancel') {
            return ctx.reply('✅ Proses ban dibatalkan.');
        }

        const targetUser = data.users.find(u => u.id === parseInt(userId));

        if (!targetUser) {
            return ctx.reply('❌ User tidak ditemukan');
        }

        if (config.adminIds.includes(String(userId))) {
            return ctx.reply('❌ Tidak dapat mem-ban admin');
        }

        // Initialize bannedUsers array if it doesn't exist
        if (!config.bannedUsers) {
            config.bannedUsers = [];
        }

        if (config.bannedUsers.includes(userId)) {
            return ctx.reply('❌ User sudah dalam status banned');
        }

        config.bannedUsers.push(userId);
        fs.writeFileSync('./config/config.json', JSON.stringify(config, null, 2));

        // Log the ban action
        logBannedAction(userId, 'ban', ctx.from.id);

        // Notify banned user
        try {
            await ctx.telegram.sendMessage(
                parseInt(userId),
                '🚫 Akun Anda telah di-ban dari menggunakan bot.\n' +
                `Hubungi admin @${config.csUsername} untuk informasi lebih lanjut.`
            );
        } catch (error) {
            console.error('Error sending ban notification:', error);
        }

        return ctx.reply(
            '╔═══════════════════╗\n' +
            '║   ✅ *BERHASIL*   ║\n' +
            '╚═══════════════════╝\n\n' +
            '🚫 *User Berhasil Di-ban*\n\n' +
            `*ID:* ${userId}\n` +
            `*Nama:* ${targetUser.name}\n` +
            `*Username:* @${targetUser.username}`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('Error in handleBanId:', error);
        return ctx.reply('❌ Terjadi kesalahan saat memproses ban');
    }
};

// Similar changes for handleUnban
const handleUnban = async (ctx) => {
    try {
        const adminId = String(ctx.from.id);
        
        if (!config.adminIds.includes(adminId)) {
            return ctx.reply('⛔ Akses ditolak');
        }

        const data = readData();
        
        if (!data.users) {
            data.users = [];
        }

        let admin = data.users.find(u => String(u.id) === adminId);
        
        if (!admin) {
            admin = {
                id: parseInt(adminId),
                name: ctx.from.first_name,
                username: ctx.from.username || '',
                isAdmin: true
            };
            data.users.push(admin);
        }

        admin.state = 'AWAITING_UNBAN_ID';
        writeData(data);

        return ctx.reply(
            '╔═══════════════════╗\n' +
            '║   🔓 *UNBAN USER*  ║\n' +
            '╚═══════════════════╝\n\n' +
            '*Masukkan User ID yang akan di-unban:*\n' +
            'Ketik /cancel untuk membatalkan',
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('Error in handleUnban:', error);
        return ctx.reply('❌ Terjadi kesalahan saat memproses permintaan');
    }
};

const handleUnbanId = async (ctx) => {
    try {
        if (!config.adminIds.includes(String(ctx.from.id))) {
            return ctx.reply('⛔ Akses ditolak');
        }

        const userId = ctx.message.text;
        const data = readData();
        const admin = data.users.find(u => u.id === ctx.from.id);
        
        // Clear admin state first
        if (admin) {
            delete admin.state;
            writeData(data);
        }

        if (userId.toLowerCase() === '/cancel') {
            return ctx.reply('✅ Proses unban dibatalkan.');
        }

        if (!config.bannedUsers || !config.bannedUsers.includes(userId)) {
            return ctx.reply('❌ User tidak dalam status banned');
        }

        config.bannedUsers = config.bannedUsers.filter(id => id !== userId);
        fs.writeFileSync('./config/config.json', JSON.stringify(config, null, 2));

        const targetUser = data.users.find(u => u.id === parseInt(userId));

        // Log the unban action
        logBannedAction(userId, 'unban', ctx.from.id);

        // Notify unbanned user
        try {
            await ctx.telegram.sendMessage(
                parseInt(userId),
                '✅ Akun Anda telah di-unban.\n' +
                'Sekarang Anda dapat menggunakan bot kembali.'
            );
        } catch (error) {
            console.error('Error sending unban notification:', error);
        }

        return ctx.reply(
            '╔═══════════════════╗\n' +
            '║   ✅ *BERHASIL*   ║\n' +
            '╚═══════════════════╝\n\n' +
            '🔓 *User Berhasil Di-unban*\n\n' +
            `*ID:* ${userId}\n` +
            `*Nama:* ${targetUser && targetUser.name ? targetUser.name : 'Unknown'}\n` +
            `*Username:* @${targetUser && targetUser.username ? targetUser.username : 'Unknown'}`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('Error in handleUnbanId:', error);
        return ctx.reply('❌ Terjadi kesalahan saat memproses unban');
    }
};

const checkBanned = async (ctx, next) => {
    try {
        // Skip check for admin commands
        if (ctx.message && ctx.message.text && ctx.message.text.startsWith('/') && 
            ['ban', 'unban', 'broadcast', 'totaluser', 'saldoserver', 'tambahsaldo', 'aktifitas']
            .some(cmd => ctx.message.text.startsWith('/' + cmd))) {
            return next();
        }

        // Skip for admins
        if (config.adminIds.includes(String(ctx.from.id))) {
            return next();
        }

        if (config.bannedUsers && config.bannedUsers.includes(String(ctx.from.id))) {
            return ctx.reply(
                '╔═══════════════════╗\n' +
                '║    🚫 *BANNED*    ║\n' +
                '╚═══════════════════╝\n\n' +
                'Maaf, akun Anda telah di-ban dari menggunakan bot.\n' +
                `Silahkan hubungi admin @${config.csUsername}\n` +
                'untuk informasi lebih lanjut.',
                { parse_mode: 'Markdown' }
            );
        }

        return next();
    } catch (error) {
        console.error('Error in checkBanned:', error);
        return next();
    }
};

// Helper function untuk log banned action
const logBannedAction = (userId, action, adminId) => {
    try {
        const data = readData();
        if (!data.bannedLog) {
            data.bannedLog = [];
        }

        data.bannedLog.push({
            userId,
            action, // 'ban' atau 'unban'
            adminId,
            timestamp: new Date().toISOString()
        });

        writeData(data);
    } catch (error) {
        console.error('Error in logBannedAction:', error);
    }
};

module.exports = {
    handleBan,
    handleBanId,
    handleUnban,
    handleUnbanId,
    checkBanned,
    logBannedAction
};