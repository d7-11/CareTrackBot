import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import fs from 'fs';


const BOT_TOKEN = process.env.BOT_TOKEN;
const DATA_FILE = './data.json';
const bot = new Telegraf(BOT_TOKEN);

const userStates = {}; // { userId: 'adding' | 'removing' | null }

// --- Функции работы с файлом ---
function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE));
  } catch {
    return {};
  }
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// --- Главное меню ---
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
  ctx.reply(`Привіт ${name}! 👋\nЯ — CareTrack. Допоможу пам'ятати про ліки.\nОбери дію нижче 👇`, mainKeyboard());
});

// --- Кнопки ---
bot.hears('💊 Мої ліки', (ctx) => {
  const userId = ctx.from.id;
  const data = readData();
  if (!data[userId]) data[userId] = { medicines: [], dates: [] };

  const meds = data[userId].medicines;
  const list = meds.length ? meds.join('\n- ') : 'Список пустий';

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

bot.hears('✅ Відмітити прийом', (ctx) => {
  const userId = ctx.from.id;
  const data = readData();
  if (!data[userId]) data[userId] = { medicines: [], dates: [] };

  const todayStr = new Date().toISOString().slice(0, 10);
  if (data[userId].dates.includes(todayStr)) {
    return ctx.reply('Ти вже відмітив сьогодні. 🌿');
  }

  data[userId].dates.push(todayStr);
  saveData(data);
  ctx.reply('✅ Прийом зафіксовано. Молодець! ✨');
});

bot.hears('📅 Прогрес', (ctx) => {
  const userId = ctx.from.id;
  const data = readData();
  if (!data[userId] || !data[userId].dates.length) {
    return ctx.reply('Поки що немає відміток. Натисни "✅ Відмітити прийом"');
  }

  const datesSet = new Set(data[userId].dates);
  let count = 0;
  let offset = 0;
  while (datesSet.has(new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10))) {
    count++;
    offset++;
  }

  ctx.reply(`📊 Твій прогрес:\n- Серія днів поспіль: ${count}\n- Всього днів: ${data[userId].dates.length}`);
});

bot.hears('⏰ Нагадування', (ctx) => ctx.reply('⏰ Нагадування поки не налаштовані.'));
bot.hears('⚙️ Налаштування', (ctx) => ctx.reply('⚙️ Тут будуть налаштування.'));

// --- Общий обработчик текста ---
bot.on('text', (ctx) => {
  const userId = ctx.from.id;
  const state = userStates[userId];
  if (!state) return; // если нет состояния — игнорируем

  const data = readData();
  if (!data[userId]) data[userId] = { medicines: [], dates: [] };

  const medName = ctx.message.text.trim();

  if (state === 'adding') {
    if (!data[userId].medicines.includes(medName)) {
      data[userId].medicines.push(medName);
      saveData(data);
      ctx.reply(`✅ ${medName} додано до списку.`);
    } else {
      ctx.reply('Ці ліки вже є у списку.');
    }
  } else if (state === 'removing') {
    const index = data[userId].medicines.indexOf(medName);
    if (index > -1) {
      data[userId].medicines.splice(index, 1);
      saveData(data);
      ctx.reply(`❌ ${medName} видалено зі списку.`);
    } else {
      ctx.reply('Такого ліки у списку немає.');
    }
  }

  userStates[userId] = null;
});

// --- Запуск ---
bot.launch().then(() => console.log('✅ CareTrack бот запущений'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
