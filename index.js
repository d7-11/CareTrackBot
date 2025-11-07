import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import pkg from 'pg';

const { Pool } = pkg;

// --- Підключення до бази даних ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY,
      medicines TEXT[],
      dates TEXT[]
    )
  `);
  console.log("✅ Таблиця users готова");
})();

// --- Ініціалізація бота ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);
const userStates = {}; // { userId: 'adding' | 'removing' | null }

// --- Функції роботи з базою ---
async function getUser(userId) {
  const res = await pool.query('SELECT * FROM users WHERE id=$1', [userId]);
  return res.rows[0] || { id: userId, medicines: [], dates: [] };
}

async function saveUser(user) {
  await pool.query(
    `INSERT INTO users (id, medicines, dates)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET medicines=$2, dates=$3`,
    [user.id, user.medicines, user.dates]
  );
}

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
  const user = await getUser(ctx.from.id);
  const meds = user.medicines || [];
  const list = meds.length ? meds.join('\n- ') : 'Список пустий 🕊️';

  ctx.reply(`💊 Твої ліки:\n- ${list}`, Markup.keyboard([
    ['Додати ліки', 'Видалити ліки'],
    ['⬅️ Назад']
  ]).resize());
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
  const user = await getUser(ctx.from.id);
  const todayStr = new Date().toISOString().slice(0, 10);

  if (user.dates.includes(todayStr)) {
    return ctx.reply('Ти вже відмітив сьогодні 🌿');
  }

  user.dates.push(todayStr);
  await saveUser(user);
  ctx.reply('✅ Прийом зафіксовано. Молодець! ✨');
});

// --- 📅 Прогрес ---
bot.hears('📅 Прогрес', async (ctx) => {
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
});

// --- Інші кнопки ---
bot.hears('⏰ Нагадування', (ctx) => ctx.reply('⏰ Нагадування поки не налаштовані.'));
bot.hears('⚙️ Налаштування', (ctx) => ctx.reply('⚙️ Тут будуть налаштування.'));

// --- Обробка тексту (додавання/видалення ліків) ---
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates[userId];
  if (!state) return;

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
});

// --- Запуск ---
bot.launch().then(() => console.log('✅ CareTrack бот запущений'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
