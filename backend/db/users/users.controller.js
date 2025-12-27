import { userService } from "./users.service.js";

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const token = await userService.authenticateUser(email, password);
    res.json({ token });
  } catch (err) {
    console.error("Error logging in user:", err);
    res.status(500).json({ error: "Failed to log in user" });
  }
};

export const deleteAllUsers = async (req, res) => {
  try {
    const deletedCount = await userService.deleteUsersFromDb();
    res.json({ deleted: deletedCount });
  } catch (err) {
    console.error("Error deleting users:", err);
    res.status(500).json({ error: "Failed to delete users" });
  }
};

export const populateUsers = async (req, res) => {
  try {
    const insertedCount = await userService.fetchAndPopulateUsers();
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

    const user = await userService.createUserInDb(email, password, displayName);
    res.status(201).json(user);
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({
      error: "Failed to create user",
      details: err.message || String(err),
    });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsersFromDb();
    console.log("users=", JSON.stringify(users, null, 2));
    return res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching all users:", error);
    return res.status(500).json({ error: "Failed to fetch all users" });
  }
};

export const deleteUserWithEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    const result = await userService.deleteUserWithEmail(email);
    if (result) {
      return res.status(200).send("Deleted user with email= " + email);
    } else {
      return res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ error: "Failed to delete user" });
  }
};

// Export as a single controller object
export const userController = {
  loginUser,
  deleteAllUsers,
  populateUsers,
  createUser,
  getAllUsers,
  deleteUserWithEmail,
};
