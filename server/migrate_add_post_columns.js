const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'db', 'PadiBridge.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("ALTER TABLE posts ADD COLUMN title TEXT", function (err) {
    if (err) console.log('add title error:', err.message);
    else console.log('Added column title');
  });

  db.run("ALTER TABLE posts ADD COLUMN post_type TEXT", function (err) {
    if (err) console.log('add post_type error:', err.message);
    else console.log('Added column post_type');
  });

  db.run("UPDATE posts SET title = '' WHERE title IS NULL", function (err) {
    if (err) console.log('update title error:', err.message);
    else console.log('Updated existing rows title');
  });

  db.run("UPDATE posts SET post_type = '' WHERE post_type IS NULL", function (err) {
    if (err) console.log('update post_type error:', err.message);
    else console.log('Updated existing rows post_type');
  });
});

db.close();
