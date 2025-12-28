import { userService } from "./users.service.js";

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const result = await userService.authenticateUser(email, password);

    // Set JWT token as HTTP-only cookie
    res.cookie("token", result.token, {
      httpOnly: true, // Prevents XSS attacks
      secure: false, // Allow HTTP in development
      sameSite: "lax", // Use 'lax' for cross-origin requests in development
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      path: "/", // Ensure cookie is available for all paths
    });

    res.json({
      success: true,
      message: "Login successful",
      user: result.user,
      // Don't send token in response body when using cookies
      token: result.token, // Still include for compatibility
    });
  } catch (err) {
    console.error("Error logging in user:", err);
    if (err.message === "Invalid email or password") {
      return res.status(401).json({ error: err.message });
    }
    res.status(500).json({ error: "Failed to log in user" });
  }
};

const logoutUser = async (req, res) => {
  try {
    // Clear the JWT cookie
    res.clearCookie("token", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });

    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (err) {
    console.error("Error logging out user:", err);
    res.status(500).json({ error: "Failed to log out user" });
  }
};

const deleteAllUsers = async (req, res) => {
  try {
    const deletedCount = await userService.deleteUsersFromDb();
    res.json({ deleted: deletedCount });
  } catch (err) {
    console.error("Error deleting users:", err);
    res.status(500).json({ error: "Failed to delete users" });
  }
};

const populateUsers = async (req, res) => {
  try {
    const insertedCount = await userService.fetchAndPopulateUsers();
    res.json({ inserted: insertedCount });
  } catch (err) {
    console.error("Error populating users:", err);
    res.status(500).json({ error: "Failed to fetch or write users" });
  }
};

const createUser = async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const result = await userService.createUserInDb(
      email,
      password,
      displayName
    );

    // Set JWT token as HTTP-only cookie
    res.cookie("token", result.token, {
      httpOnly: true, // Prevents XSS attacks
      secure: false, // Allow HTTP in development
      sameSite: "lax", // Use 'lax' for cross-origin requests in development
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      path: "/", // Ensure cookie is available for all paths
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: result.user,
      // Don't send token in response body when using cookies
      token: result.token, // Still include for compatibility
    });
  } catch (err) {
    console.error("Error creating user:", err);
    if (err.message === "User with this email already exists") {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({
      error: "Failed to create user",
      details: err.message || String(err),
    });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsersFromDb();
    console.log("users=", JSON.stringify(users, null, 2));
    return res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching all users:", error);
    return res.status(500).json({ error: "Failed to fetch all users" });
  }
};

const deleteUserWithEmail = async (req, res) => {
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
  logoutUser,
  deleteAllUsers,
  populateUsers,
  createUser,
  getAllUsers,
  deleteUserWithEmail,
};
