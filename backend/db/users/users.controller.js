import {
  authenticateUser,
  deleteUsersFromDb,
  fetchAndPopulateUsers,
  createUserInDb,
} from "./users.service.js";

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const token = await authenticateUser(email, password);
    res.json({ token });
  } catch (err) {
    console.error("Error logging in user:", err);
    res.status(500).json({ error: "Failed to log in user" });
  }
};

export const deleteAllUsers = async (req, res) => {
  try {
    const deletedCount = await deleteUsersFromDb();
    res.json({ deleted: deletedCount });
  } catch (err) {
    console.error("Error deleting users:", err);
    res.status(500).json({ error: "Failed to delete users" });
  }
};

export const populateUsers = async (req, res) => {
  try {
    const insertedCount = await fetchAndPopulateUsers();
    res.json({ inserted: insertedCount });
  } catch (err) {
    console.error("Error populating users:", err);
    res.status(500).json({ error: "Failed to fetch or write users" });
  }
};

export const createUser = async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await createUserInDb(email, password, displayName);
    res.status(201).json(user);
  } catch (err) {
    console.error("Error creating user:", err);
    res
      .status(500)
      .json({
        error: "Failed to create user",
        details: err.message || String(err),
      });
  }
};
