import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import { getUser, saveUser, pool } from './services/database.js';

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

// --- 💊 Мої ліки ---
bot.hears('💊 Мої ліки', async (ctx) => {
    try {
      const user = await getUser(ctx.from.id);
      const meds = user.medicines || [];
      const list = meds.length ? meds.join('\n- ') : 'Список пустий 🕊️';
  
      ctx.reply(`💊 Твої ліки:\n- ${list}`, Markup.keyboard([
        ['Додати ліки', 'Видалити ліки'],
        ['⬅️ Назад']
      ]).resize());
    } catch (error) {
      console.error('Помилка отримання списку ліків:', error);
      ctx.reply('❌ Помилка при отриманні списку ліків. Спробуй пізніше.');
    }
  });

bot.hears('Додати ліки', (ctx) => {
  userStates[ctx.from.id] = 'adding';
  ctx.reply('Напиши назву ліків, які хочеш додати:');
});

bot.hears('Видалити ліки', (ctx) => {
  userStates[ctx.from.id] = 'removing';
  ctx.reply('Напиши назву ліків, які хочеш видалити:');
});

bot.hears('⬅️ Назад', (ctx) => {
  userStates[ctx.from.id] = null;
  ctx.reply('Головне меню', mainKeyboard());
});

// --- ✅ Відмітити прийом ---
bot.hears('✅ Відмітити прийом', async (ctx) => {
    try {
      const user = await getUser(ctx.from.id);
      const todayStr = new Date().toISOString().slice(0, 10);
  
      if (user.dates.includes(todayStr)) {
        return ctx.reply('Ти вже відмітив сьогодні 🌿');
      }
  
      user.dates.push(todayStr);
      await saveUser(user);
      ctx.reply('✅ Прийом зафіксовано. Молодець! ✨');
    } catch (error) {
      console.error('Помилка відмітки прийому:', error);
      ctx.reply('❌ Помилка при відмітці прийому. Спробуй пізніше.');
    }
  });

// --- 📅 Прогрес ---
bot.hears('📅 Прогрес', async (ctx) => {
    try {
      const user = await getUser(ctx.from.id);
      if (!user.dates.length) {
        return ctx.reply('Поки що немає відміток. Натисни "✅ Відмітити прийом"');
      }
  
      const datesSet = new Set(user.dates);
      let count = 0, offset = 0;
      while (datesSet.has(new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10))) {
        count++; offset++;
      }
  
      ctx.reply(`📊 Твій прогрес:\n- Серія днів поспіль: ${count}\n- Всього днів: ${user.dates.length}`);
    } catch (error) {
      console.error('Помилка отримання прогресу:', error);
      ctx.reply('❌ Помилка при отриманні прогресу. Спробуй пізніше.');
    }
  });
  
  // --- Інші кнопки ---
  bot.hears('⏰ Нагадування', (ctx) => ctx.reply('⏰ Нагадування поки не налаштовані.'));
  bot.hears('⚙️ Налаштування', (ctx) => ctx.reply('⚙️ Тут будуть налаштування.'));
  

// --- Обробка тексту (додавання/видалення ліків) ---
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const state = userStates[userId];
    if (!state) return;
  
    try {
      const user = await getUser(userId);
      const medName = ctx.message.text.trim();
  
      if (state === 'adding') {
        if (!user.medicines.includes(medName)) {
          user.medicines.push(medName);
          await saveUser(user);
          ctx.reply(`✅ ${medName} додано до списку.`);
        } else {
          ctx.reply('Ці ліки вже є у списку.');
        }
      } else if (state === 'removing') {
        const index = user.medicines.indexOf(medName);
        if (index > -1) {
          user.medicines.splice(index, 1);
          await saveUser(user);
          ctx.reply(`❌ ${medName} видалено зі списку.`);
        } else {
          ctx.reply('Такого ліку у списку немає.');
        }
      }
  
      userStates[userId] = null;
    } catch (error) {
      console.error('Помилка обробки тексту:', error);
      ctx.reply('❌ Помилка при обробці запиту. Спробуй пізніше.');
      userStates[userId] = null;
    }
  });
  
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
  
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);