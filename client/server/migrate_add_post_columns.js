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

  db.run("ALTER TABLE posts ADD COLUMN status TEXT", function (err) {
    if (err) console.log('add status error:', err.message);
    else console.log('Added column status');
  });

  db.run("UPDATE posts SET title = '' WHERE title IS NULL", function (err) {
    if (err) console.log('update title error:', err.message);
    else console.log('Updated existing rows title');
  });

  db.run("UPDATE posts SET post_type = '' WHERE post_type IS NULL", function (err) {
    if (err) console.log('update post_type error:', err.message);
    else console.log('Updated existing rows post_type');
  });

  db.run("UPDATE posts SET status = 'not' WHERE status IS NULL OR status = ''", function (err) {
    if (err) console.log('update status error:', err.message);
    else console.log('Updated existing rows status');
  });

  db.run("ALTER TABLE tags ADD COLUMN color TEXT", function (err) {
    if (err) console.log('add color error:', err.message);
    else console.log('Added column color');
  });

  db.run(
    "UPDATE tags SET color = CASE\n      WHEN name = 'Made with AI' THEN '#7c3aed'\n      WHEN name = 'tag1' THEN '#678c4f'\n      WHEN name = 'tag2' THEN '#1d4ed8'\n      WHEN name = 'tag3' THEN '#c2410c'\n      ELSE '#dce7dc'\n    END\n    WHERE color IS NULL OR color = ''",
    function (err) {
      if (err) console.log('update color error:', err.message);
      else console.log('Updated existing rows color');
    }
  );
});

db.close();
