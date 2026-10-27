const fs = require('fs');
const path = require('path');
const db = require('./db');

async function migrate() {
  try {
    console.log('Reading schema.sql...');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

    console.log('Running migrations...');
    // Split the schema file by semicolon to execute commands one by one
    const commands = schema
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0);

    for (const cmd of commands) {
      await db.query(cmd);
    }
    console.log('Database tables verified/created successfully.');

    // Seed borrowers if empty
    const bCheck = await db.query('SELECT COUNT(*) FROM borrowers');
    if (parseInt(bCheck.rows[0].count) === 0) {
      console.log('Seeding initial borrower data...');
      await db.query(`
        INSERT INTO borrowers (name, phone) VALUES 
        ('Rajesh Kumar', '9876543210'),
        ('Priya Patel', '9812345678'),
        ('Amit Shah', '9988776655')
      `);
      
      const rajesh = await db.query("SELECT id FROM borrowers WHERE name = 'Rajesh Kumar'");
      const priya = await db.query("SELECT id FROM borrowers WHERE name = 'Priya Patel'");

      await db.query(`
        INSERT INTO transactions (borrower_id, type, amount, date, item, qty, remarks) VALUES 
        (${rajesh.rows[0].id}, 'borrow', 500, '2024-10-10', 'Samosa Box', 2, 'For party'),
        (${rajesh.rows[0].id}, 'received', 200, '2024-10-11', NULL, 1, 'Partial payment'),
        (${priya.rows[0].id}, 'borrow', 1200, '2024-10-12', 'Premium Sweets', 3, 'Diwali gift prep')
      `);
      console.log('Borrower seeding completed.');
    }

    // Seed cashflow if empty
    const cfCheck = await db.query('SELECT COUNT(*) FROM cashflow');
    if (parseInt(cfCheck.rows[0].count) === 0) {
      console.log('Seeding initial cashflow data...');
      await db.query(`
        INSERT INTO cashflow (type, amount, date, payment_method, description) VALUES
        ('income', 15000, '2024-10-10', 'online', 'Catering Deposit - Sharma Birthday Party'),
        ('expense', 1200, '2024-10-10', 'cash', 'Fresh Potatoes & Raw Spices'),
        ('income', 8500, '2024-10-11', 'cash', 'Daily Cash Counter Sales'),
        ('expense', 4500, '2024-10-12', 'online', 'Cloud Hosting Subscription')
      `);
      console.log('Cashflow seeding completed.');
    }

    console.log('Migration and seeding completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

migrate();
