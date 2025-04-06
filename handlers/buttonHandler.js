const { Markup } = require('telegraf');
const { readData, writeData } = require('../helpers/fileHelper');
const config = require('../config/config.json');

const commands = {
  deposit: '```💎 Format: /deposit <jumlah>```\n\n_Contoh: /deposit 50000_',
  order: '```🛍️ Format: /order```\n\n_Pilih layanan dari daftar_',
  list: '```📋 Format: /list```\n\n_Lihat layanan yang tersedia_',
  riwayat: '```📜 Format: /riwayat```\n\n_Cek riwayat pesanan Anda_',
  refill: '```♻️ Format: /refill```\n\n_Request refill untuk pesanan_',
  cs: '```👨‍💻 Format: /cs```\n\n_Hubungi customer service_',
  saldo: '```💰 Format: /saldo```\n\n_Cek saldo Anda_',
  aktifitas: '```📊 Format: /aktifitas```\n\n_Lihat aktivitas bot_',
  broadcast: '```📢 Format: /bc```\n\n_Kirim pesan broadcast_',
  saldoserver: '```💳 Format: /saldoserver```\n\n_Cek saldo server_',
  totaluser: '```👥 Format: /totaluser```\n\n_Lihat total pengguna_'
};

const handleButton = async (ctx) => {
  try {
    const userId = ctx.from.id;
    const action = ctx.callbackQuery.data;
    
    // Special handling for admin commands
    if (['aktifitas', 'broadcast', 'saldoserver', 'totaluser'].includes(action)) {
      if (!config.adminIds.includes(String(userId))) {
        return ctx.answerCbQuery('⚠️ Akses ditolak');
      }
      // Admin commands don't need registration check
    } else {
      // For regular user commands, check registration
      const data = readData();
      const user = data.users.find(u => u.id === userId);
      
      if (!user && !config.adminIds.includes(String(userId))) {
        return ctx.answerCbQuery('⚠️ Anda belum terdaftar. Silakan gunakan /start');
      }
    }

    // Clear any existing state for regular users
    if (!config.adminIds.includes(String(userId))) {
      const data = readData();
      const user = data.users.find(u => u.id === userId);
      if (user && user.state) {
        user.state = null;
        writeData(data);
      }
    }

    if (commands[action]) {
      const message = 
        '╔═══════════════════╗\n' +
        '║   ℹ️ INFORMASI    ║\n' +
        '╚═══════════════════╝\n\n' +
        commands[action];

      await ctx.answerCbQuery();

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Kembali ke Menu', 'back')]
      ]);

      return ctx.editMessageCaption(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    }

    return ctx.answerCbQuery('⚠️ Perintah tidak valid');
    
  } catch (error) {
    console.error('Error in button handler:', error);
    
    try {
      await ctx.answerCbQuery('❌ Terjadi kesalahan. Silakan coba lagi');
    } catch (err) {
      // Ignore callback query errors
    }
    
    try {
      await ctx.reply('❌ Terjadi kesalahan. Silakan gunakan /start untuk memulai ulang');
    } catch (err) {
      console.error('Failed to send error message:', err);
    }
  }
};

module.exports = { handleButton };