const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const publicPath = typeof __dirname !== 'undefined' ? path.join(__dirname, 'public') : '';
if (publicPath) {
  app.use(express.static(publicPath));
}



// REST API Endpoints

// 1. GET all borrowers with aggregated transactions
app.get('/api/borrowers', async (req, res, next) => {
  try {
    const queryText = `
      SELECT b.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', t.id,
                   'type', t.type,
                   'date', t.date::text,
                   'item', t.item,
                   'qty', t.qty,
                   'amount', t.amount::float,
                   'remarks', t.remarks
                 ) ORDER BY t.date DESC, t.id DESC
               ) FILTER (WHERE t.id IS NOT NULL), 
               '[]'::json
             ) as transactions
      FROM borrowers b
      LEFT JOIN transactions t ON b.id = t.borrower_id
      GROUP BY b.id
      ORDER BY b.name ASC
    `;
    const result = await db.query(queryText);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// 2. POST create a new borrower
app.post('/api/borrowers', async (req, res, next) => {
  const { name, phone, address, notes, opening_balance } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    // Insert borrower
    const borrowerInsert = `
      INSERT INTO borrowers (name, phone, address, notes) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `;
    const borrowerRes = await client.query(borrowerInsert, [name, phone, address || '', notes || '']);
    const borrower = borrowerRes.rows[0];

    // If there is an opening balance, record it as a borrow transaction
    const openAmt = parseFloat(opening_balance);
    if (!isNaN(openAmt) && openAmt > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const transactionInsert = `
        INSERT INTO transactions (borrower_id, type, date, item, qty, amount, remarks) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      await client.query(transactionInsert, [
        borrower.id, 
        'borrow', 
        todayStr, 
        'Opening balance', 
        1, 
        openAmt, 
        'Opening balance'
      ]);
    }

    await client.query('COMMIT');
    res.status(201).json(borrower);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// 3. POST record a new transaction for a borrower
app.post('/api/transactions', async (req, res, next) => {
  const { borrower_id, type, date, item, qty, amount, remarks } = req.body;
  
  if (!borrower_id || !type || !date || amount === undefined) {
    return res.status(400).json({ error: 'borrower_id, type, date, and amount are required.' });
  }
  if (type !== 'borrow' && type !== 'received') {
    return res.status(400).json({ error: 'type must be borrow or received.' });
  }
  const amtNum = parseFloat(amount);
  if (isNaN(amtNum) || amtNum <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number.' });
  }

  try {
    // Check if borrower exists
    const checkBorrower = await db.query('SELECT id FROM borrowers WHERE id = $1', [borrower_id]);
    if (checkBorrower.rows.length === 0) {
      return res.status(404).json({ error: 'Borrower not found.' });
    }

    const queryText = `
      INSERT INTO transactions (borrower_id, type, date, item, qty, amount, remarks) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *
    `;
    const result = await db.query(queryText, [
      borrower_id, 
      type, 
      date, 
      item || '', 
      parseInt(qty) || 1, 
      amtNum, 
      remarks || ''
    ]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// 4. DELETE a borrower (cascades transactions)
app.delete('/api/borrowers/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM borrowers WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Borrower not found.' });
    }
    res.json({ message: 'Borrower deleted successfully.', deleted: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// 5. DELETE a transaction
app.delete('/api/transactions/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM transactions WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    res.json({ message: 'Transaction deleted successfully.', deleted: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// 6. GET all cashflow transactions
app.get('/api/cashflow', async (req, res, next) => {
  try {
    const result = await db.query('SELECT id, type, amount::float, date::text, payment_method, description, created_at FROM cashflow ORDER BY date DESC, id DESC');
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// 7. POST create a new cashflow transaction (income or expense)
app.post('/api/cashflow', async (req, res, next) => {
  const { type, amount, date, payment_method, description } = req.body;
  if (!type || amount === undefined || !date || !payment_method) {
    return res.status(400).json({ error: 'type, amount, date, and payment_method are required.' });
  }
  if (type !== 'income' && type !== 'expense') {
    return res.status(400).json({ error: 'type must be income or expense.' });
  }
  if (payment_method !== 'cash' && payment_method !== 'online') {
    return res.status(400).json({ error: 'payment_method must be cash or online.' });
  }
  const amtNum = parseFloat(amount);
  if (isNaN(amtNum) || amtNum <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number.' });
  }

  try {
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
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// 8. DELETE a cashflow transaction
app.delete('/api/cashflow/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM cashflow WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cashflow record not found.' });
    }
    res.json({ message: 'Cashflow record deleted successfully.', deleted: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  if (publicPath) {
    res.sendFile(path.join(publicPath, 'index.html'));
  } else {
    res.status(404).send('Not Found');
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Express Error Handler caught:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running in production mode on http://localhost:${PORT}`);
  });
}
