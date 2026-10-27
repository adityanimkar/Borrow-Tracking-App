import { Hono } from 'hono';
import { cors } from 'hono/cors';
import db from './db';

const app = new Hono();

// Global Error Handler
app.onError((err, c) => {
  console.error("Uncaught exception in Hono:", err);
  return c.json({
    error: err.message,
    message: "Hono caught global exception"
  }, 500);
});

// Inject env vars to process.env on every request
app.use('*', async (c, next) => {
  try {
    if (c.env && c.env.DATABASE_URL) {
      process.env.DATABASE_URL = c.env.DATABASE_URL;
    }
    await next();
  } catch (err) {
    return c.json({
      error: err.message,
      stack: err.stack,
      message: "Exception inside middleware next()"
    }, 500);
  }
});

app.use('*', cors());





// 1. GET all borrowers with aggregated transactions
app.get('/api/borrowers', async (c) => {
  try {
    const queryText = `
      SELECT 
        b.id, b.name, b.phone, b.address, b.notes, b.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'type', t.type,
              'amount', t.amount::float,
              'date', t.date::text,
              'item', t.item,
              'qty', t.qty,
              'remarks', t.remarks,
              'defect_detected', t.defect_detected,
              'created_at', t.created_at
            ) ORDER BY t.date DESC, t.id DESC
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) AS transactions
      FROM borrowers b
      LEFT JOIN transactions t ON b.id = t.borrower_id
      GROUP BY b.id
      ORDER BY b.name ASC
    `;
    const result = await db.query(queryText);
    return c.json(result.rows);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// 2. POST create a new borrower
app.post('/api/borrowers', async (c) => {
  try {
    const { name, phone, address, notes, opening_balance } = await c.req.json();
    if (!name || !phone) {
      return c.json({ error: 'Name and phone are required.' }, 400);
    }
    const queryText = 'INSERT INTO borrowers (name, phone, address, notes) VALUES ($1, $2, $3, $4) RETURNING *';
    const result = await db.query(queryText, [name, phone, address || '', notes || '']);
    const row = result.rows[0];

    // If there is an opening balance, record it as a borrow transaction
    const openAmt = parseFloat(opening_balance);
    if (!isNaN(openAmt) && openAmt > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const transactionInsert = `
        INSERT INTO transactions (borrower_id, type, date, item, qty, amount, remarks) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      await db.query(transactionInsert, [
        row.id, 
        'borrow', 
        todayStr, 
        'Opening balance', 
        1, 
        openAmt, 
        'Opening balance'
      ]);
    }

    // Refetch the borrower with transactions
    const refetchQuery = `
      SELECT 
        b.id, b.name, b.phone, b.address, b.notes, b.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'type', t.type,
              'amount', t.amount::float,
              'date', t.date::text,
              'item', t.item,
              'qty', t.qty,
              'remarks', t.remarks,
              'defect_detected', t.defect_detected,
              'created_at', t.created_at
            ) ORDER BY t.date DESC, t.id DESC
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) AS transactions
      FROM borrowers b
      LEFT JOIN transactions t ON b.id = t.borrower_id
      WHERE b.id = $1
      GROUP BY b.id
    `;
    const refetchResult = await db.query(refetchQuery, [row.id]);
    return c.json(refetchResult.rows[0], 201);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// 3. POST create a transaction for a borrower
app.post('/api/transactions', async (c) => {
  try {
    const { borrower_id, type, amount, date, item, qty, remarks, defect_detected } = await c.req.json();
    if (!borrower_id || !type || amount === undefined || !date) {
      return c.json({ error: 'borrower_id, type, amount, and date are required.' }, 400);
    }
    if (type !== 'borrow' && type !== 'received') {
      return c.json({ error: 'type must be borrow or received.' }, 400);
    }
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      return c.json({ error: 'amount must be a positive number.' }, 400);
    }

    // Check if borrower exists
    const checkBorrower = await db.query('SELECT id FROM borrowers WHERE id = $1', [borrower_id]);
    if (checkBorrower.rows.length === 0) {
      return c.json({ error: 'Borrower not found.' }, 404);
    }

    const queryText = `
      INSERT INTO transactions (borrower_id, type, date, item, qty, amount, remarks, defect_detected) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *
    `;
    const result = await db.query(queryText, [
      borrower_id, 
      type, 
      date, 
      item || '', 
      parseInt(qty) || 1, 
      amtNum, 
      remarks || '',
      defect_detected || null
    ]);
    return c.json(result.rows[0], 201);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// 4. DELETE a borrower
app.delete('/api/borrowers/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const result = await db.query('DELETE FROM borrowers WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return c.json({ error: 'Borrower not found.' }, 404);
    }
    return c.json({ message: 'Borrower deleted successfully.', deleted: result.rows[0] });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// 5. DELETE a transaction
app.delete('/api/transactions/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const result = await db.query('DELETE FROM transactions WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return c.json({ error: 'Transaction not found.' }, 404);
    }
    return c.json({ message: 'Transaction deleted successfully.', deleted: result.rows[0] });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// 6. GET all cashflow transactions
app.get('/api/cashflow', async (c) => {
  try {
    const result = await db.query('SELECT id, type, amount::float, date::text, payment_method, description, created_at FROM cashflow ORDER BY date DESC, id DESC');
    return c.json(result.rows);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// 7. POST create a new cashflow transaction
app.post('/api/cashflow', async (c) => {
  try {
    const { type, amount, date, payment_method, description } = await c.req.json();
    if (!type || amount === undefined || !date || !payment_method) {
      return c.json({ error: 'type, amount, date, and payment_method are required.' }, 400);
    }
    if (type !== 'income' && type !== 'expense') {
      return c.json({ error: 'type must be income or expense.' }, 400);
    }
    if (payment_method !== 'cash' && payment_method !== 'online') {
      return c.json({ error: 'payment_method must be cash or online.' }, 400);
    }
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      return c.json({ error: 'amount must be a positive number.' }, 400);
    }

    const queryText = `
      INSERT INTO cashflow (type, amount, date, payment_method, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await db.query(queryText, [
      type,
      amtNum,
      date,
      payment_method,
      description || ''
    ]);
    return c.json(result.rows[0], 201);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// 8. DELETE a cashflow transaction
app.delete('/api/cashflow/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const result = await db.query('DELETE FROM cashflow WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return c.json({ error: 'Cashflow record not found.' }, 404);
    }
    return c.json({ message: 'Cashflow record deleted successfully.', deleted: result.rows[0] });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

export default app;
