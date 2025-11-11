import { Markup } from 'telegraf';
import { getUser, saveUser } from '../services/database.js';

export function setupMedicinesHandlers(bot, userStates) {
  // 💊 Мої ліки
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

  // Обробка тексту для додавання/видалення
  bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const state = userStates[userId];
    if (!state || (state !== 'adding' && state !== 'removing')) return;

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
}