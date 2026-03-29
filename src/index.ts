import pool from './config/db';

async function testConnection(): Promise<void> {
  try {
    const connection = await pool.getConnection();
    console.log('Connected to MySQL');
    connection.release();
  } catch (error) {
    console.error('Failed to connect to MySQL:', error);
  } finally {
    await pool.end();
  }
}

testConnection();
