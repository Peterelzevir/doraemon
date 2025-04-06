//START
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
const { readData, writeData } = require('../helpers/fileHelper');

const mainMenu = Markup.inlineKeyboard([
  [
    Markup.button.callback('💎 Topup', 'deposit'),
    Markup.button.callback('🛍️ Order', 'order')
  ],
  [
    Markup.button.callback('💡 List Sosmed', 'list'),
    Markup.button.callback('📜 Riwayat Transaksi', 'riwayat')
  ],
  [
    Markup.button.callback('♻️ Refill', 'refill'),
    Markup.button.callback('👨‍💻 Customer Service', 'cs')
  ],
  [Markup.button.callback('💰 Saldo', 'saldo')]
]);

const adminMenu = Markup.inlineKeyboard([
  [
    Markup.button.callback('📊 Bot Activity', 'aktifitas'),
    Markup.button.callback('📢 Broadcast', 'broadcast')
  ],
  [
    Markup.button.callback('💳 Server Balance', 'saldoserver'),
    Markup.button.callback('👥 Total Users', 'totaluser')
  ]
]);

const handleStart = async (ctx) => {
  const userId = ctx.from.id;
  const data = readData();
  
  // Check if user is admin
  if (config.adminIds.includes(String(userId))) {
    return handleAdminStart(ctx);
  }

  const user = data.users.find(u => u.id === userId);
  
  // If not admin and not registered, show registration prompt
  if (!user) {
    const welcomeMessage = 
      `*🌟 WELCOME*\n\n` +
      `*${config.botName}*\n\n` +
      '```• Status: Tidak Terdaftar```\n' +
      '```• Action: Wajib Registrasi```\n\n' +
      '_Please klik button dibawah ini untuk mendaftar_\n\n' +
      '*INFORMATION*\n' +
      '• Kualitas Bagus\n' +
      '• 24/7 Customer Support\n' +
      '• Proses Secara Otomatis Oleh Bot';

    return ctx.reply(
      welcomeMessage,
      { 
        ...Markup.inlineKeyboard([[Markup.button.callback('📝 Register Now', 'register')]]), 
        parse_mode: 'Markdown' 
      }
    );
  }

  return sendMainMenu(ctx, user);
};

const handleRegister = async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    // Block admin registration
    if (config.adminIds.includes(String(userId))) {
      await ctx.answerCbQuery('⚠️ Admin accounts do not need registration');
      return handleAdminStart(ctx);
    }

    const data = readData();

    // Check if user already exists
    if (data.users.some(u => u.id === userId)) {
      await ctx.answerCbQuery('⚠️ You are already registered!');
      try {
        await ctx.deleteMessage();
      } catch (err) {
        await ctx.reply('⚠️ You are already registered! Use /start to access the menu.');
      }
      return;
    }

    // Create new user object
    const newUser = {
      id: userId,
      username: ctx.from.username ? `@${ctx.from.username.replace(/_/g, '\\_')}` : '_NoUsername_',
      name: (ctx.from.first_name || 'User').replace(/_/g, '\\_'),
      registeredAt: new Date().toISOString(),
      balance: 0,
      state: null,
      orders: [],
      banned: false
    };

    // Add user to database
    data.users.push(newUser);
    writeData(data);

    // Build success message
    const successMessage = 
      `✅ *REGISTRATION BERHASIL!!*\n\n` +
      `*👤 Name:* _${newUser.name}_\n` +
      `*🔰 Username:* _${newUser.username}_\n` +
      `*📅 Date:* _${new Date(newUser.registeredAt).toLocaleString()}_\n\n` +
      '```Send /start to continue```';

    // Try to delete the registration message
    try {
      await ctx.deleteMessage();
    } catch (err) {
      console.log('Could not delete registration message:', err.message);
    }

    // Send success message
    await ctx.reply(successMessage, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });

    // Log registration
    console.log(`New user registered: ${userId} (${newUser.username})`);

  } catch (error) {
    console.error('Registration error:', error);
    
    await ctx.reply(
      '❌ Registration failed. Please try again later or contact support.',
      { parse_mode: 'Markdown' }
    );

    try {
      await ctx.answerCbQuery('❌ Registration failed');
    } catch (err) {
      // Ignore callback query errors
    }
  }
};

const handleAdminStart = async (ctx) => {
  const data = readData();
  
  const stats = {
    totalUsers: data.users.length,
    todayOrders: 0, // Implement order tracking
    totalBalance: data.users.reduce((sum, user) => sum + user.balance, 0)
  };

  const adminMessage = 
    `👑 *ADMIN PANEL*\n\n` +
    '*📊 Today Statistics*\n\n' +
    '```📦 Orders Information```\n' +
    `*• Total Orders:* _${stats.todayOrders}_\n` +
    `*• Total Users:* _${stats.totalUsers}_\n` +
    `*• Total Balance:* _Rp ${stats.totalBalance.toLocaleString()}_\n\n` +
    '```Select option below```';

  return ctx.replyWithPhoto(
    { source: config.welcomeImage },
    { caption: adminMessage, ...adminMenu, parse_mode: 'Markdown' }
  );
};

const sendMainMenu = async (ctx, user) => {
  const caption = 
    `*${config.botName}*\n\n` +
    `*Welcome Back, ${user.name}* 👋\n\n` +
    '```📱 Account Information```\n\n' +
    `*👤 Name:* _${user.name}_\n` +
    `*🔰 Username:* _${user.username}_\n` +
    `*💰 Balance:* _Rp ${user.balance.toLocaleString()}_\n` +
    `*📅 Registered:* _${new Date(user.registeredAt).toLocaleString()}_\n\n` +
    '```Select option below```';

  return ctx.replyWithPhoto(
    { source: config.welcomeImage },
    { caption, ...mainMenu, parse_mode: 'Markdown' }
  );
};

module.exports = {
  handleStart,
  handleRegister,
  mainMenu,
  adminMenu,
  sendMainMenu  // Add this line
};