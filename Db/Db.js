const mysql = require("mysql2");

const pool = mysql.createPool({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
  port: 13879,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});


console.log("database is connected")

// Export the pool for use in other files
module.exports = pool.promise(); // Using promise() for async/await support
