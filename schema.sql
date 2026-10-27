-- Database Schema for Borrower Ledger

CREATE TABLE IF NOT EXISTS borrowers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    borrower_id INTEGER REFERENCES borrowers(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('borrow', 'received')),
    date DATE NOT NULL,
    item VARCHAR(255),
    qty INTEGER DEFAULT 1,
    amount NUMERIC(12, 2) NOT NULL,
    remarks TEXT,
    defect_detected VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optimization indexes for production performance
CREATE INDEX IF NOT EXISTS idx_transactions_borrower_id ON transactions(borrower_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_borrowers_name ON borrowers(LOWER(name));

-- Cashflow (Income & Expense) Table
CREATE TABLE IF NOT EXISTS cashflow (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC(12, 2) NOT NULL,
    date DATE NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'online')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optimization indexes for cashflow performance
CREATE INDEX IF NOT EXISTS idx_cashflow_date ON cashflow(date);
CREATE INDEX IF NOT EXISTS idx_cashflow_type ON cashflow(type);
