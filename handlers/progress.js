import { getUser, saveUser } from '../services/database.js';

export function setupProgressHandlers(bot) {
  // ✅ Відмітити прийом
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

  // 📅 Прогрес
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
}