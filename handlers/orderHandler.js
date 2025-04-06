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

// Helper function to escape markdown characters
const escapeMarkdown = (text) => {
    if (!text) return '';
    return text.replace(/[_*\[\]()~`>#+=|{}.!-]/g, '\\$&');
};

// Function to censor sensitive data
const censorData = (text, type) => {
    if (!text) return '';
    switch (type) {
        case 'username':
            // Hanya tampilkan huruf pertama setelah @, sisanya ganti dengan *
            return text.startsWith('@') 
                ? '@' + text[1] + '*'.repeat(text.length - 2) 
                : text[0] + '*'.repeat(text.length - 1);
        case 'orderid':
            // Replace middle digits with *
            return text.replace(/\d(?=\d{2})/g, '*');
        case 'userid':
            // Tampilkan 3 angka pertama, sensor sisanya dengan *
            return text.length > 3 
                ? text.slice(0, 3) + '*'.repeat(text.length - 3) 
                : '*'.repeat(text.length);
        default:
            return text;
    }
};

// Function to send notification to group
const sendGroupNotification = async (ctx, orderDetails, user) => {
    try {
        const now = new Date();
        const formattedDate = now.toLocaleString('id-ID', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Jakarta'
        });

        const message = 
            '╔═══════════════════╗\n' +
            '║   🔔 *ORDER BARU*     ║\n' +
            '╚═══════════════════╝\n\n' +
            `*👤 User :* ${censorData(user.username || 'Anonymous', 'username')}\n` +
            `*🔖 Order ID :* #${censorData(orderDetails.id.toString(), 'orderid')}\n` +
            `*📦 Layanan :* ${orderDetails.serviceName}\n` +
            `*📊 Jumlah :* ${orderDetails.quantity}\n` +
            `*💰 Total :* Rp.${orderDetails.price.toLocaleString()}\n` +
            `*📅 Tanggal :* ${formattedDate}\n` +
            `*💳 Sisa Saldo :* Rp.${user.balance.toLocaleString()}\n\n` +
            '🛍️ *Mau Order Juga?*';

        // Send to group
        await ctx.telegram.sendMessage(
            config.groupId, // Add groupId to your config file
            message,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.url('Order 🛒', 'https://t.me/ordersosmedbot')]
                ])
            }
        );
    } catch (error) {
        console.error('Error sending group notification:', error);
    }
};

const handleOrder = async (ctx) => {
    const data = readData();
    const user = data.users.find(u => u.id === ctx.from.id);

    if (!user) {
        return ctx.reply('⚠️ Anda belum terdaftar. Silakan gunakan /start terlebih dahulu.');
    }

    try {
        await ctx.reply(
            '╔═══════════════════╗\n' +
            '║    🛍️ *ORDER*     ║\n' +
            '╚═══════════════════╝\n\n' +
            '*Masukkan ID Layanan:*\n' +
            'Ketik /cancel untuk membatalkan',
            { parse_mode: 'Markdown' }
        );

        user.state = 'AWAITING_SERVICE_ID';
        writeData(data);
    } catch (error) {
        console.error('Error in handleOrder:', error);
        return ctx.reply('❌ Gagal memulai order. Silahkan coba lagi.');
    }
};

const handleOrderServiceId = async (ctx) => {
    if (ctx.message.text.toLowerCase() === '/cancel') {
        const data = readData();
        const user = data.users.find(u => u.id === ctx.from.id);
        delete user.state;
        delete user.orderData;
        writeData(data);
        
        return ctx.reply('✅ Order dibatalkan.', { parse_mode: 'Markdown' });
    }

    try {
        const serviceId = ctx.message.text;
        const response = await axios.post('https://api.medanpedia.co.id/services', {
            api_id: config.apiId,
            api_key: config.apiKey,
            service_fav: 1
        });

        if (!response.data || !response.data.status) {
            throw new Error((response.data && response.data.msg) || 'Failed to fetch services');
        }

        const service = response.data.data.find(s => s.id === parseInt(serviceId));
        if (!service) {
            return ctx.reply(
                '❌ *ID Layanan ga valid bro!*\n' +
                '*👀 Silahkan cek kembali ID layanan dengan perintah /list*'
            );
        }

        const markup = (100 + config.margin) / 100;
        const adjustedPrice = service.price * markup;

        const message = 
            '╔═══════════════════╗\n' +
            '║   🛍️ *LAYANAN*    ║\n' +
            '╚═══════════════════╝\n\n' +
            `*${service.name}*\n\n` +
            `💰 Harga: Rp ${adjustedPrice.toLocaleString()}/1000\n` +
            `📊 Min: ${service.min}\n` +
            `📊 Max: ${service.max}\n` +
            `♻️ Refill: ${service.refill ? '✅' : '❌'}\n\n` +
            '*Masukkan jumlah pesanan :*\n👀 *contoh : 1000*\n\n' +
            '👉 Ketik /cancel untuk membatalkan';

        const data = readData();
        const user = data.users.find(u => u.id === ctx.from.id);
        user.state = 'AWAITING_QUANTITY';
        user.orderData = { 
            serviceId, 
            serviceName: service.name,
            price: adjustedPrice,
            min: service.min,
            max: service.max
        };
        writeData(data);

        return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Error in handleOrderServiceId:', error);
        return ctx.reply('❌ Gagal memproses ID layanan. Silahkan coba lagi.');
    }
};

const handleOrderQuantity = async (ctx) => {
    if (ctx.message.text.toLowerCase() === '/cancel') {
        const data = readData();
        const user = data.users.find(u => u.id === ctx.from.id);
        delete user.state;
        delete user.orderData;
        writeData(data);
        
        return ctx.reply('✅ Order dibatalkan.', { parse_mode: 'Markdown' });
    }

    const quantity = parseInt(ctx.message.text);
    const data = readData();
    const user = data.users.find(u => u.id === ctx.from.id);
    
    if (!user.orderData) {
        return ctx.reply(
            '❌ Sesi order telah kedaluwarsa.\n' +
            'Silahkan mulai ulang dengan perintah /order',
            { parse_mode: 'Markdown' }
        );
    }

    if (isNaN(quantity)) {
        return ctx.reply('❌ Jumlah harus berupa angka!');
    }

    if (quantity < user.orderData.min || quantity > user.orderData.max) {
        return ctx.reply(
            '❌ Jumlah tidak valid!\n' +
            `Minimum: ${user.orderData.min}\n` +
            `Maksimum: ${user.orderData.max}`
        );
    }

    user.orderData.quantity = quantity;
    user.state = 'AWAITING_TARGET';
    writeData(data);

    return ctx.reply(
        '╔═══════════════════╗\n' +
        '║   🎯 *TARGET ORDER*     ║\n' +
        '╚═══════════════════╝\n\n' +
        '*✅ Masukkan target :*\n\n' +
        '📎 Contoh : username/link\n👉 _ketentuan tentang target bisa cek di channel_ :\nhttps://t.me/jasasosmedhiyaok/9\n\n' +
        'Ketik /cancel untuk membatalkan',
        { parse_mode: 'Markdown' }
    );
};

const handleOrderTarget = async (ctx) => {
    if (ctx.message.text.toLowerCase() === '/cancel') {
        const data = readData();
        const user = data.users.find(u => u.id === ctx.from.id);
        delete user.state;
        delete user.orderData;
        writeData(data);
        
        return ctx.reply('✅ Order dibatalkan.', { parse_mode: 'Markdown' });
    }

    const target = ctx.message.text;
    const data = readData();
    const user = data.users.find(u => u.id === ctx.from.id);

    if (!user.orderData) {
        return ctx.reply(
            '❌ Sesi order telah kedaluwarsa.\n' +
            'Silahkan mulai ulang dengan perintah /order'
        );
    }

    const pricePerK = user.orderData.price / 1000;
    const totalPrice = pricePerK * user.orderData.quantity;

    user.orderData.target = target;
    user.state = 'AWAITING_CONFIRMATION';
    writeData(data);

    return ctx.reply(
        '╔═══════════════════╗\n' +
        '║   📋 *KONFIRMASI ORDER*   ║\n' +
        '╚═══════════════════╝\n\n' +
        '*Detail Pesanan:*\n' +
        `📦 Layanan: ${escapeMarkdown(user.orderData.serviceName)}\n` +
        `🎯 Target: ${target}\n` +
        `📊 Jumlah: ${user.orderData.quantity}\n` +
        `💰 Total: Rp ${totalPrice.toLocaleString()}\n` +
        `💳 Saldo: Rp ${user.balance.toLocaleString()}\n\n` +
        '*Silahkan konfirmasi pesanan Anda:*',
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback('✅ Konfirmasi', 'confirm_order'),
                    Markup.button.callback('❌ Batal', 'cancel_order')
                ]
            ])
        }
    );
};

const handleOrderConfirmation = async (ctx) => {
    let orderResponse = null;
    let orderDetails = null;
    let data = null;
    let user = null;

    try {
        // Try to delete the previous message first
        try {
            await ctx.deleteMessage();
        } catch (deleteError) {
            console.log('Could not delete message:', deleteError);
        }

        data = readData();
        user = data.users.find(u => u.id === ctx.from.id);

        if (!user || !user.orderData) {
            return ctx.reply(
                '❌ Sesi order telah kedaluwarsa.\n' +
                'Silahkan mulai ulang dengan perintah /order',
                { parse_mode: 'Markdown' }
            );
        }

        const pricePerK = user.orderData.price / 1000;
        const totalPrice = pricePerK * user.orderData.quantity;

        if (user.balance < totalPrice) {
            return ctx.reply(
                '╔═══════════════════╗\n' +
                '║    ❌ *GAGAL NIH!*      ║\n' +
                '╚═══════════════════╝\n\n' +
                '📛 *Saldo Tidak Cukup*\n\n' +
                `💸 Harga: Rp ${totalPrice.toLocaleString()}\n` +
                `💳 Saldo: Rp ${user.balance.toLocaleString()}\n\n` +
                '*💰 *Silahkan deposit terlebih dahulu dengan perintah* /deposit',
                { parse_mode: 'Markdown' }
            );
        }

        // Simpan orderData sebelum membuat pesanan
        const orderData = { ...user.orderData };

        orderResponse = await axios.post('https://api.medanpedia.co.id/order', {
            api_id: config.apiId,
            api_key: config.apiKey,
            service: orderData.serviceId,
            target: orderData.target,
            quantity: orderData.quantity
        });

        if (!orderResponse.data || !orderResponse.data.status) {
            throw new Error((orderResponse.data && orderResponse.data.msg) || 'Order failed');
        }

        // Update user balance
        user.balance -= totalPrice;
        
        // Add to transaction history
        addTransaction(user.id, 'order', -totalPrice, 
            `Order ${orderData.serviceName} (${orderData.quantity})`);
        
        // Store order history
        if (!user.orders) {
            user.orders = [];
        }
        
        orderDetails = {
            id: orderResponse.data.data.id,
            serviceId: orderData.serviceId,
            serviceName: orderData.serviceName,
            target: orderData.target,
            quantity: orderData.quantity,
            price: totalPrice,
            date: new Date().toISOString()
        };
        
        user.orders.push(orderDetails);

        // Clear order state and data
        delete user.state;
        delete user.orderData;
        writeData(data);
        
        // After successful order and updating user data
        await sendGroupNotification(ctx, orderDetails, user);

        // Send success message
        return ctx.reply(
            '╔═══════════════════╗\n' +
            '║   ✅ *ORDER BERHASIL*    ║\n' +
            '╚═══════════════════╝\n\n' +
            `*🔔 Order ID:* #${orderResponse.data.data.id}\n` +
            `*💡 Layanan:* ${orderDetails.serviceName}\n` +
            `*📎 Target:* ${orderDetails.target}\n` +
            `*👀 Jumlah:* ${orderDetails.quantity}\n` +
            `*💸 Total:* Rp ${totalPrice.toLocaleString()}\n` +
            `*💳 Sisa Saldo:* Rp ${user.balance.toLocaleString()}\n\n` +
            '🔍 *Cek status pesanan dengan perintah* /riwayat',
            { parse_mode: 'Markdown' }
        );

    } catch (error) {
        console.error('Error in handleOrderConfirmation:', error);
        
        let errorMessage = '❌ Gagal memproses pesanan\n';
        
        if (error.response && error.response.data && error.response.data.msg) {
            errorMessage = `❌ ${error.response.data.msg}\n`;
        } else if (error.message) {
            errorMessage = `❌ ${error.message}\n`;
        }
        
        // Pastikan kita bersihkan state order jika terjadi error
        try {
            data = readData();
            user = data.users.find(u => u.id === ctx.from.id);
            if (user) {
                delete user.state;
                delete user.orderData;
                writeData(data);
            }
        } catch (cleanupError) {
            console.error('Error cleaning up order state:', cleanupError);
        }
        
        return ctx.reply(
            errorMessage + '*👀 Silahkan coba lagi dengan perintah /order*',
            { parse_mode: 'Markdown' }
        );
    }
};

const handleOrderCancel = async (ctx) => {
    try {
        await ctx.deleteMessage();
        
        const data = readData();
        const user = data.users.find(u => u.id === ctx.from.id);
        
        if (user) {
            delete user.state;
            delete user.orderData;
            writeData(data);
        }
        
        return ctx.reply('✅ Order dibatalkan.', { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Error in handleOrderCancel:', error);
        return ctx.reply('❌ Gagal membatalkan order.');
    }
};

module.exports = {
    handleOrder,
    handleOrderServiceId,
    handleOrderQuantity,
    handleOrderTarget,
    handleOrderConfirmation,
    handleOrderCancel,
    sendGroupNotification,
    censorData
};