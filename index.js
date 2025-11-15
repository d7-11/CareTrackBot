import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import { pool } from './services/database.js';
import { setupMedicinesHandlers } from './handlers/medicines.js';
import { setupProgressHandlers } from './handlers/progress.js';

// --- Валідація змінних середовища ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

if (!BOT_TOKEN) {
    console.error('❌ Помилка: BOT_TOKEN не встановлено в .env файлі');
    process.exit(1);
}
  
if (!DATABASE_URL) {
    console.error('❌ Помилка: DATABASE_URL не встановлено в .env файлі');
    process.exit(1);
}
  
// --- Ініціалізація бота ---
const bot = new Telegraf(BOT_TOKEN);
const userStates = {}; // { userId: 'adding' | 'removing' | null }

// --- Головне меню ---
function mainKeyboard() {
  return Markup.keyboard([
    ['💊 Мої ліки', '⏰ Нагадування'],
    ['✅ Відмітити прийом', '📅 Прогрес'],
    ['⚙️ Налаштування']
  ]).resize();
}

// --- /start ---
bot.start((ctx) => {
  const name = ctx.from.first_name || 'друг';
  userStates[ctx.from.id] = null;
  ctx.reply(
    `Привіт ${name}! 👋\nЯ — CareTrack. Допоможу пам’ятати про ліки.\nОбери дію нижче 👇`,
    mainKeyboard()
  );
});

// --- Налаштування handlers ---
setupMedicinesHandlers(bot, userStates);
setupProgressHandlers(bot);

// --- Кнопка "Назад" ---
bot.hears('⬅️ Назад', (ctx) => {
  userStates[ctx.from.id] = null;
  ctx.reply('Головне меню', mainKeyboard());
});

// --- Інші кнопки ---
bot.hears('⏰ Нагадування', (ctx) => ctx.reply('⏰ Нагадування поки не налаштовані.'));
bot.hears('⚙️ Налаштування', (ctx) => ctx.reply('⚙️ Тут будуть налаштування.'));
  
  
// --- Обробка помилок бота ---
bot.catch((err, ctx) => {
    console.error('Помилка в боті:', err);
    ctx.reply('❌ Виникла помилка. Спробуй пізніше.');
  });
  
  // --- Graceful shutdown ---
  async function shutdown() {
    console.log('🛑 Зупинка бота...');
    await bot.stop('SIGTERM');
    await pool.end();
    console.log('✅ Бот зупинено, підключення до БД закрито');
    process.exit(0);
  }
  
  // --- Запуск ---
  bot.launch()
    .then(() => console.log('✅ CareTrack бот запущений'))
    .catch((error) => {
      console.error('❌ Помилка запуску бота:', error);
      process.exit(1);
    });
    (async () => {
        try {
          // Видаляємо webhook, якщо він був встановлений (для уникнення конфлікту 409)
          await bot.telegram.deleteWebhook({ drop_pending_updates: true });
          console.log('✅ Webhook видалено');
          
          await bot.launch();
          console.log('✅ CareTrack бот запущений');
        } catch (error) {
          console.error('❌ Помилка запуску бота:', error);
          process.exit(1);
        }
      })();
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);