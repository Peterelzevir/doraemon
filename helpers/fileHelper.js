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

//file
const fs = require('fs');
const path = require('path');

// Use relative paths from the project root
const dataPath = './data/users.json';
const backupPath = './data/users_backup.json';
const dataDir = './data';

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    try {
        fs.mkdirSync(dataDir, { recursive: true });
    } catch (error) {
        console.error('Failed to create data directory:', error);
        // Create a fallback directory in the current folder if root access fails
        if (!fs.existsSync('./userdata')) {
            fs.mkdirSync('./userdata');
        }
    }
}

// Read data with backup handling
const readData = () => {
    try {
        // Try to read main file
        const data = fs.readFileSync(dataPath, 'utf8');
        return JSON.parse(data);
    } catch (mainError) {
        try {
            // If main file fails, try to read backup
            if (fs.existsSync(backupPath)) {
                const backupData = fs.readFileSync(backupPath, 'utf8');
                const parsedData = JSON.parse(backupData);
                
                // Restore main file from backup
                fs.writeFileSync(dataPath, JSON.stringify(parsedData, null, 2));
                return parsedData;
            }
        } catch (backupError) {
            console.error('Backup read failed:', backupError);
        }
        // If both fail, return empty data structure
        return { 
            users: [],
            lastBackup: new Date().toISOString()
        };
    }
};

// Write data with backup creation
const writeData = (data) => {
    try {
        // Create backup of existing data if it exists
        if (fs.existsSync(dataPath)) {
            fs.copyFileSync(dataPath, backupPath);
        }
        // Write new data
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
        // Update last backup timestamp
        data.lastBackup = new Date().toISOString();
        
        return true;
    } catch (error) {
        console.error('Write data failed:', error);
        return false;
    }
};

// Add transaction to user history
const addTransaction = (userId, type, amount, description) => {
    const data = readData();
    const user = data.users.find(u => u.id === userId);
    
    if (!user) return false;
    if (!user.transactions) {
        user.transactions = [];
    }
    user.transactions.push({
        type,           // 'deposit', 'order', 'refund', etc
        amount,         // transaction amount
        description,    // transaction description
        date: new Date().toISOString()
    });
    return writeData(data);
};

// Get user transaction history
const getTransactionHistory = (userId) => {
    const data = readData();
    const user = data.users.find(u => u.id === userId);
    
    if (!user || !user.transactions) {
        return [];
    }
    return user.transactions.sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
};

// Update user balance safely
const updateBalance = (userId, amount) => {
    const data = readData();
    const user = data.users.find(u => u.id === userId);
    
    if (!user) return false;
    const oldBalance = user.balance;
    user.balance = Math.max(0, user.balance + amount); // Prevent negative balance
    
    if (writeData(data)) {
        return user.balance - oldBalance; // Return actual change in balance
    }
    return false;
};

// Initialize empty data file if it doesn't exist
if (!fs.existsSync(dataPath)) {
    writeData({
        users: [],
        lastBackup: new Date().toISOString()
    });
}

module.exports = { 
    readData, 
    writeData,
    addTransaction,
    getTransactionHistory,
    updateBalance
};