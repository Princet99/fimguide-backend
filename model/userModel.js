const pool = require("../Db/Db");

const updateUserEmail = async (userId, newEmail) => {
  const query = `UPDATE user SET us_email = ? where us_id = ?`;
  try {
    const [result] = await pool.execute(query, [newEmail, userId]);
    return result;
  } catch (error) {
    console.error("Error updating user email in model:", error);
    throw error;
  }
};

module.exports = {
  updateUserEmail,
};
