import pkg from 'pg';
const { Pool } = pkg;

// Підключення до бази даних
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Обробка помилок підключення
pool.on('error', (err) => {
  console.error('❌ Помилка підключення до БД:', err);
});

/**
 * Отримати користувача з БД або створити нового
 * @param {number} userId - ID користувача Telegram
 * @returns {Promise<{id: number, medicines: string[], dates: string[]}>}
 */
export async function getUser(userId) {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
      
      if (result.rows.length > 0) {
        return {
          id: result.rows[0].id,
          medicines: result.rows[0].medicines || [],
          dates: result.rows[0].dates || []
        };
      }
      
      // Автоматично створюємо користувача, якщо його немає
      await pool.query(
        'INSERT INTO users (id, medicines, dates) VALUES ($1, $2, $3)',
        [userId, [], []]
      );
      
      return {
        id: userId,
        medicines: [],
        dates: []
      };
    } catch (error) {
      console.error('❌ Помилка отримання користувача:', error);
      throw error;
    }
}

/**
 * Зберегти користувача в БД
 * @param {Object} user - Об'єкт користувача {id, medicines, dates}
 */
export async function saveUser(user) {
  try {
    await pool.query(
      `INSERT INTO users (id, medicines, dates)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET medicines = $2, dates = $3`,
      [user.id, user.medicines, user.dates]
    );
  } catch (error) {
    console.error('❌ Помилка збереження користувача:', error);
    throw error;
  }
}

// Експортуємо pool для можливого закриття при завершенні
export { pool };