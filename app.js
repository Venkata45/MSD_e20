const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'books.json');

function readBooks() {
  return new Promise((resolve, reject) => {
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') return resolve([]);
        return reject(err);
      }
      try {
        const parsed = data.trim() ? JSON.parse(data) : [];
        if (!Array.isArray(parsed)) return resolve([]);
        resolve(parsed);
      } catch (e) {
        resolve([]);
      }
    });
  });
}

function writeBooks(books) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(books, null, 2);
    fs.writeFile(DATA_FILE, payload + '\n', 'utf8', (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function ensureDataFile() {
  return new Promise((resolve) => {
    fs.access(DATA_FILE, fs.constants.F_OK, (err) => {
      if (!err) return resolve();
      const sample = [
        { id: 1, title: 'Atomic Habits', author: 'James Clear', available: true },
        { id: 2, title: 'Deep Work', author: 'Cal Newport', available: false }
      ];
      fs.writeFile(DATA_FILE, JSON.stringify(sample, null, 2) + '\n', 'utf8', () => resolve());
    });
  });
}

app.get('/books', async (req, res) => {
  try {
    const books = await readBooks();
    res.json(books);
  } catch (e) {
    res.status(500).json({ error: 'Failed to read books.' });
  }
});

app.get('/books/available', async (req, res) => {
  try {
    const books = await readBooks();
    res.json(books.filter((b) => b && b.available === true));
  } catch (e) {
    res.status(500).json({ error: 'Failed to read books.' });
  }
});

app.post('/books', async (req, res) => {
  try {
    const { title, author, available } = req.body || {};
    if (typeof title !== 'string' || typeof author !== 'string' || typeof available !== 'boolean') {
      return res.status(400).json({ error: 'Invalid body. Expected { title: string, author: string, available: boolean }.' });
    }
    const books = await readBooks();
    const maxId = books.reduce((max, b) => (typeof b.id === 'number' && b.id > max ? b.id : max), 0);
    const newBook = { id: maxId + 1, title, author, available };
    books.push(newBook);
    await writeBooks(books);
    res.status(201).json(newBook);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create book.' });
  }
});

app.put('/books/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id.' });
    const { title, author, available } = req.body || {};
    if (
      typeof title !== 'string' &&
      typeof author !== 'string' &&
      typeof available !== 'boolean'
    ) {
      return res.status(400).json({ error: 'Nothing to update. Provide title, author, or available.' });
    }
    const books = await readBooks();
    const idx = books.findIndex((b) => b && b.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Book not found.' });
    const updated = { ...books[idx] };
    if (typeof title === 'string') updated.title = title;
    if (typeof author === 'string') updated.author = author;
    if (typeof available === 'boolean') updated.available = available;
    books[idx] = updated;
    await writeBooks(books);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update book.' });
  }
});

app.delete('/books/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id.' });
    const books = await readBooks();
    const existing = books.some((b) => b && b.id === id);
    if (!existing) return res.status(404).json({ error: 'Book not found.' });
    const filtered = books.filter((b) => b && b.id !== id);
    await writeBooks(filtered);
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete book.' });
  }
});

const PORT = process.env.PORT || 3000;
ensureDataFile().finally(() => {
  app.listen(PORT, () => {
  });
});
