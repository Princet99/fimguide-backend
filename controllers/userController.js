const userModel = require("../model/userModel");

const updateEmail = async (req, res) => {
  const { userId } = req.params;
  const { newEmail } = req.body;

  //Basic validation
  if (!userId || !newEmail) {
    return res
      .status(400)
      .json({ message: "User Id and new email are required" });
  }

  try {
    const result = await userModel.updateUserEmail(userId, newEmail);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "User not found or email already exists" });
    }

    res
      .status(200)
      .json({ message: "User email updated successfully!", userId: userId });
  } catch (error) {
    console.error("Error updating user email in controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  updateEmail,
};
