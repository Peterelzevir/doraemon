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

const encodeForCallback = (str) => {
    let encoded = Buffer.from(str)
        .toString('base64')
        .replace(/=/g, '')  // Hapus padding `=`
        .replace(/\+/g, '-') // Ubah `+` menjadi `-`
        .replace(/\//g, '_'); // Ubah `/` menjadi `_`

    // Batasi panjang maksimal 64 karakter dengan aman
    return encoded.length > 64 ? encoded.slice(0, 61) + "..." : encoded;
};

const decodeFromCallback = (str) => {
    // Jika callback dipotong dengan "..." saat encoding, hapus itu dulu
    if (str.endsWith("...")) {
        str = str.slice(0, -3); // Hapus tiga karakter terakhir ("...")
    }

    // Kembalikan karakter yang diubah saat encoding
    str = str.replace(/-/g, '+').replace(/_/g, '/');

    // Tambahkan padding jika perlu
    const pad = str.length % 4;
    if (pad) {
        str += '='.repeat(4 - pad);
    }

    // Decode dari base64 ke string asli
    return Buffer.from(str, 'base64').toString('utf-8');
};

const cleanServiceName = (name) => {
    const maxLength = 30;
    let cleanName = name.trim()
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/server \d+/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    
    return cleanName.length > maxLength 
        ? cleanName.substring(0, maxLength - 3) + '...'
        : cleanName;
};

const escapeMarkdown = (text) => {
    if (!text) return '';
    
    // Daftar karakter yang perlu di-escape untuk MarkdownV2
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')
               // Escape backslash yang tidak digunakan untuk escape karakter lain
               .replace(/\\([^_*[\]()~`>#+=|{}.!-])/g, '\\\\$1');
};

const fetchServices = async () => {
    try {
        const response = await axios.post('https://api.medanpedia.co.id/services', {
            api_id: config.apiId,
            api_key: config.apiKey,
            service_fav: 1
        });

        if (!response.data.status) {
            throw new Error(response.data.msg);
        }

        const uniqueServices = [];
        const seenNames = new Set();

        response.data.data.forEach(service => {
            const cleanedName = cleanServiceName(service.name);
            if (!seenNames.has(cleanedName)) {
                seenNames.add(cleanedName);
                service.name = cleanedName;
                uniqueServices.push(service);
            }
        });

        return uniqueServices;
    } catch (error) {
        console.error('Error fetching services:', error);
        return [];
    }
};

const handleList = async (ctx) => {
    try {
        const services = await fetchServices();
        
        if (!services || services.length === 0) {
            return ctx.reply('❌ Gagal mengambil data layanan.');
        }

        const categories = Array.from(new Set(services.map(service => service.category)));
        const itemsPerPage = 8;
        const currentPage = 0;
        const startIndex = currentPage * itemsPerPage;
        const currentCategories = categories.slice(startIndex, startIndex + itemsPerPage);
        const totalPages = Math.ceil(categories.length / itemsPerPage);

        const keyboard = [];
        
        // Button kategori
        currentCategories.forEach(category => {
            keyboard.push([
                Markup.button.callback(`✅ ${category}`, `c:${encodeForCallback(category)}:0`)
            ]);
        });

        // Halaman pertama hanya tampilkan button Selanjutnya
        keyboard.push([
            Markup.button.callback('Selanjutnya ➡️', `list:${currentPage + 1}`)
        ]);
        
        keyboard.push([Markup.button.callback('❌ Tutup', 'close')]);

        const message = `👀 ʜᴀʟᴏ ᴋᴀᴍᴜ ʙᴇʀᴀᴅᴀ ᴅɪ ʜᴀʟᴀᴍᴀɴ ʟɪꜱᴛ\n\n👇 ʟɪʜᴀᴛ ᴅᴜʟᴜ ʏᴜᴜᴜ ᴅɪꜱɪɴɪ\n\n📋 ᴘɪʟɪʜ ᴋᴀᴛᴇɢᴏʀɪ ɴʏᴀ :\n\nʜᴀʟᴀᴍᴀɴ : ${currentPage + 1}/${totalPages}`;

        if (ctx.callbackQuery) {
            await ctx.answerCbQuery();
            return ctx.editMessageText(message, {
                reply_markup: { inline_keyboard: keyboard }
            });
        } else {
            return ctx.reply(message, {
                reply_markup: { inline_keyboard: keyboard }
            });
        }
    } catch (error) {
        console.error('Error in handleList:', error);
        const errorMsg = '❌ Terjadi kesalahan saat memuat kategori.';
        if (ctx.callbackQuery) {
            await ctx.answerCbQuery();
            return ctx.editMessageText(errorMsg);
        } else {
            return ctx.reply(errorMsg);
        }
    }
};

const handlePageNavigation = async (ctx) => {
    try {
        const [command, pageStr] = ctx.callbackQuery.data.split(':');
        let page = parseInt(pageStr);
        
        const services = await fetchServices();
        const categories = Array.from(new Set(services.map(service => service.category)));
        const itemsPerPage = 8;
        const totalPages = Math.ceil(categories.length / itemsPerPage);
        
        // Cek batas halaman
        if (page >= totalPages) page = 0;
        if (page < 0) page = 0; // Kembali ke halaman pertama jika negatif
        
        const startIndex = page * itemsPerPage;
        const currentCategories = categories.slice(startIndex, startIndex + itemsPerPage);
        
        const keyboard = [];
        
        // Button kategori
        currentCategories.forEach(category => {
            keyboard.push([
                Markup.button.callback(`✅ ${category}`, `c:${encodeForCallback(category)}:0`)
            ]);
        });

        // Navigation buttons
        const navigationButtons = [];
        
        // Tampilkan button Sebelumnya hanya jika bukan di halaman pertama
        if (page > 0) {
            navigationButtons.push(
                Markup.button.callback('⬅️ Sebelumnya', `list:${page - 1}`)
            );
        }
        
        // Tampilkan button Selanjutnya jika bukan di halaman terakhir
        if (page < totalPages - 1) {
            navigationButtons.push(
                Markup.button.callback('Selanjutnya ➡️', `list:${page + 1}`)
            );
        }
        
        if (navigationButtons.length > 0) {
            keyboard.push(navigationButtons);
        }
        
        keyboard.push([Markup.button.callback('❌ Tutup', 'close')]);

        const message = `👀 ʜᴀʟᴏ ᴋᴀᴍᴜ ʙᴇʀᴀᴅᴀ ᴅɪ ʜᴀʟᴀᴍᴀɴ ʟɪꜱᴛ\n\n👇 ʟɪʜᴀᴛ ᴅᴜʟᴜ ʏᴜᴜᴜ ᴅɪꜱɪɴɪ\n\n📋 ᴘɪʟɪʜ ᴋᴀᴛᴇɢᴏʀɪ ɴʏᴀ :\n\nʜᴀʟᴀᴍᴀɴ : ${page + 1}/${totalPages}`;

        await ctx.answerCbQuery();
        return ctx.editMessageText(message, {
            reply_markup: { inline_keyboard: keyboard }
        });
    } catch (error) {
        console.error('Error in handlePageNavigation:', error);
        await ctx.answerCbQuery();
        return ctx.editMessageText('❌ Terjadi kesalahan saat navigasi halaman.');
    }
};

const handleCategoryProducts = async (ctx) => {
    try {
        const [command, encodedCategory, pageStr] = ctx.callbackQuery.data.split(':');
        const category = decodeFromCallback(encodedCategory);
        const page = parseInt(pageStr) || 0;
        
        const services = await fetchServices();
        if (!services || services.length === 0) {
            throw new Error('Failed to fetch services');
        }

        const categoryServices = services.filter(service => service.category === category);
        
        // Membuat pesan yang berisi semua detail layanan dalam kategori
        const serviceDetails = categoryServices.map(service => {
            const markup = (100 + config.margin) / 100;
            const adjustedPrice = service.price * markup;

            return [
                `📌 *Detail Layanan :*`,
                `📍 *ID Layanan :* \`${service.id}\``,
                `💡 *Nama :* *${service.name}*`,
                `💰 *Harga :* Rp.${adjustedPrice.toLocaleString()}/1000`,
                `📊 *Min/Max :* ${service.min}/${service.max}`,
                `♻️ *Refill :* ${service.refill ? '✅' : '❌'}`,
                `⏱ *Estimasi :* ${service.average_time}`,
                `\n${'─'.repeat(23)}`
            ].join('\n');
        });

        const message = [
            `👀 ʜᴀʟᴏ ᴋᴀᴍᴜ ʙᴇʀᴀᴅᴀ ᴅɪ ʜᴀʟᴀᴍᴀɴ ʟɪꜱᴛ\n`,
            `📋 *ʜᴀʟᴀᴍᴀɴ : ${escapeMarkdown(category)}*\n`,
            ...serviceDetails
        ].join('\n');

        const keyboard = [
            [Markup.button.callback('❌ Tutup', 'close')]
        ];

        await ctx.answerCbQuery();
        return ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
        });
    } catch (error) {
        console.error('Error in handleCategoryProducts:', error);
        await ctx.answerCbQuery();
        return ctx.editMessageText('❌ Terjadi kesalahan saat memuat layanan.');
    }
};

const handleClose = async (ctx) => {
    try {
        await ctx.answerCbQuery();
        await ctx.deleteMessage();
    } catch (error) {
        console.error('Error in handleClose:', error);
    }
};

module.exports = {
    handleList,
    handleCategoryProducts,
    handleClose,
    fetchServices,
    cleanServiceName,
    handlePageNavigation,
    encodeForCallback,
    decodeFromCallback
};