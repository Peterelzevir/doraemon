//module by @hiyaok
/*
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                                                              ║
 * ║                    ORDER BOT SERVICE                         ║
 * ║                                                             ║
 * ║  ░█████╗░██████╗░██████╗░███████╗██████╗░  ██████╗░░█████╗░████████╗ ║
 * ║  ██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔══██╗  ██╔══██╗██╔══██╗╚══██╔══╝ ║
 * ║  ██║░░██║██████╔╝██║░░██║█████╗░░██████╔╝  ██████╦╝██║░░██║░░░██║░░░ ║
 * ║  ██║░░██║██╔══██╗██║░░██║██╔══╝░░██╔══██╗  ██╔══██╗██║░░██║░░░██║░░░ ║
 * ║  ╚█████╔╝██║░░██║██████╔╝███████╗██║░░██║  ██████╦╝╚█████╔╝░░░██║░░░ ║
 * ║  ░╚════╝░╚═╝░░╚═╝╚═════╝░╚══════╝╚═╝░░╚═╝  ╚═════╝░░╚════╝░░░░╚═╝░░░ ║
 * ║                                                              ║
 * ║  Author  : @hiyaok (Telegram)                               ║
 * ║  Version : V1                                            ║
 * ║  Telegram  : @hiyaok                                          ║
 * ║                                                             ║
 * ║  Features:                                                  ║
 * ║  • Order Management System                                  ║
 * ║  • Service Catalog Integration                              ║
 * ║  • Real-time Status Updates                                 ║
 * ║  • User Registration & Authentication                       ║
 * ║  • Admin Dashboard & Controls                              ║
 * ║  • Order History Tracking                                  ║
 * ║                                                             ║
 * ║  © 2025 Source Code by @hiyaok                             ║
 * ║  @hiyaok open pembuatan jasa bot telegram lainnya         ║
 * ║                                                             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
 
//modules
const { Telegraf } = require('telegraf');
const config = require('./config/config.json');
const { handleStart, handleRegister, adminMenu, mainMenu, sendMainMenu } = require('./handlers/startHandler');
const { handleButton } = require('./handlers/buttonHandler');
const { handleDeposit } = require('./handlers/depositHandler');
const { handleList, handleClose, handleCategoryProducts, fetchServices, cleanServiceName, encodeForCallback, decodeFromCallback, handlePageNavigation } = require('./handlers/listHandler');
const { handleOrder, handleOrderServiceId, handleOrderConfirmation, handleOrderTarget, handleOrderQuantity, handleOrderCancel, sendGroupNotification, censorData } = require('./handlers/orderHandler');
const { handleRiwayat, handleRefill, handleBalance, handleRefillId, handleCS, handleRiwayatAction, handleRiwayatClose } = require('./handlers/userManagement');
const { handleServerBalance, handleTotalUsers, handleBroadcast, handleBroadcastMessage, handleAddBalance, handleActivity } = require('./handlers/adminHandler');
const { handleBan, handleBanId, handleUnban, handleUnbanId, checkBanned, logBannedAction } = require('./handlers/adminBanHandler');
const { readData, writeData, updateBalance, getTransactionHistory, addTransaction } = require('./helpers/fileHelper');

const bot = new Telegraf(config.botToken);

// Store user sessions globally
const userSessions = new Map();

// Middleware
bot.use(checkBanned);

// User commands
bot.command('start', handleStart);
bot.command('deposit', handleDeposit);
bot.command('list', handleList);
bot.command('order', handleOrder);
bot.command('riwayat', handleRiwayat);
bot.command('refill', handleRefill);
bot.command('cs', handleCS);
bot.command('saldo', handleBalance);

// Admin commands
bot.command('totaluser', (ctx) => {
  if (config.adminIds.includes(String(ctx.from.id))) {
    return handleTotalUsers(ctx);
  }
});

bot.command('saldoserver', (ctx) => {
  if (config.adminIds.includes(String(ctx.from.id))) {
    return handleServerBalance(ctx);
  }
});

bot.command('bc', (ctx) => {
  if (config.adminIds.includes(String(ctx.from.id))) {
    return handleBroadcast(ctx);
  }
});

bot.command('tambahsaldo', (ctx) => {
  if (config.adminIds.includes(String(ctx.from.id))) {
    return handleAddBalance(ctx);
  }
});

bot.command('aktifitas', (ctx) => {
  if (config.adminIds.includes(String(ctx.from.id))) {
    return handleActivity(ctx);
  }
});

bot.command('ban', (ctx) => {
  if (config.adminIds.includes(String(ctx.from.id))) {
    return handleBan(ctx);
  }
});

bot.command('unban', (ctx) => {
  if (config.adminIds.includes(String(ctx.from.id))) {
    return handleUnban(ctx);
  }
});

// Handle regular messages for state management
bot.on('message', async (ctx) => {
  try {
    const data = readData();
    let user;

    // Check if the user is an admin
    if (config.adminIds.includes(String(ctx.from.id))) {
      user = data.users.find(u => u.id === ctx.from.id);
    } else {
      user = data.users.find(u => u.id === ctx.from.id);
    }
    
    if (!user || !user.state) return;
    
    switch(user.state) {
      // User states
      case 'AWAITING_SERVICE_ID':
        return handleOrderServiceId(ctx);
      case 'AWAITING_QUANTITY':
        return handleOrderQuantity(ctx);
      case 'AWAITING_TARGET':
        return handleOrderTarget(ctx);
      case 'AWAITING_REFILL_ID':
        return handleRefillId(ctx);
        
      // Admin states
      case 'AWAITING_BROADCAST':
        if (config.adminIds.includes(String(ctx.from.id))) {
          return handleBroadcastMessage(ctx);
        }
        break;
      case 'AWAITING_BAN_ID':
        if (config.adminIds.includes(String(ctx.from.id))) {
          return handleBanId(ctx);
        }
        break;
      case 'AWAITING_UNBAN_ID':
        if (config.adminIds.includes(String(ctx.from.id))) {
          return handleUnbanId(ctx);
        }
        break;
      default:
        delete user.state;
        writeData(data);
        break;
    }
  } catch (error) {
    console.error('Error in message handler:', error);
    return ctx.reply('❌ Terjadi kesalahan pada sistem. Silakan coba lagi nanti.');
  }
});

// List Handlers
bot.command('list', handleList);
bot.action(/^c:(.+):(\d+)$/, handleCategoryProducts);  // Updated for category with page number
bot.action('close', handleClose);
bot.action(/^list:\d+$/, handlePageNavigation);

// Register Action
bot.action('register', async (ctx) => {
  console.log('Register action triggered by user:', ctx.from.id);
  await handleRegister(ctx);
});

// Update the riwayat navigation handler
bot.action(/^riwayat_(\d+)$/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    return handleRiwayatAction(ctx, page);
});

// Update the riwayat close handler
bot.action('riwayat_tutup', handleRiwayatClose);

// Confirm Order Action
bot.action('confirm_order', async (ctx) => {
  const data = readData();
  const user = data.users.find(u => u.id === ctx.from.id);

  if (!user) {
    console.log('User  not found, sending not registered message.');
    return ctx.answerCbQuery('⚠️ Anda belum terdaftar.');
  }

  await ctx.answerCbQuery();
  return handleOrderConfirmation(ctx);
});

// Cancel Order Action
bot.action('cancel_order', async (ctx) => {
  const data = readData();
  const user = data.users.find(u => u.id === ctx.from.id);

  if (user) {
    delete user.state;
    delete user.orderData;
    writeData(data);
    await ctx.answerCbQuery('✅ Order dibatalkan.');
    return ctx.editMessageText('✅ Order telah dibatalkan.', {
      parse_mode: 'Markdown'
    });
  } else {
    await ctx.answerCbQuery('⚠️ Anda belum terdaftar.');
  }
});

// Back Action
bot.action('back', async (ctx) => {
  const data = readData();
  const user = data.users.find(u => u.id === ctx.from.id);
  
  // Check if user is admin
  if (config.adminIds.includes(String(ctx.from.id))) {
    await ctx.answerCbQuery();
    return handleStart(ctx); // This will show admin menu for admins
  }

  if (user) {
    delete user.state;
    writeData(data);
    await ctx.answerCbQuery();
    return sendMainMenu(ctx, user);
  } else {
    await ctx.answerCbQuery('⚠️ Anda belum terdaftar.');
    return handleStart(ctx); // This will show registration prompt for unregistered users
  }
});

// Common button handler for information display
bot.action(['deposit', 'order', 'list', 'riwayat', 'refill', 'cs', 'saldo', 
            'aktifitas', 'broadcast', 'saldoserver', 'totaluser'], 
  async (ctx) => {
    // Check admin access for admin actions
    if (['aktifitas', 'broadcast', 'saldoserver', 'totaluser'].includes(ctx.callbackQuery.data)) {
      if (!config.adminIds.includes(String(ctx.from.id))) {
        return ctx.answerCbQuery('⛔ Akses ditolak');
      }
    }
    return handleButton(ctx);
  }
);

// Launch bot
bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));