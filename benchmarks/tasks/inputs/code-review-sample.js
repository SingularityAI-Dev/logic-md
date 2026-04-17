// PR: Add user authentication middleware
// The following code shows changes to the authentication system

// File: src/auth.js (new)
function authenticateUser(username, password) {
	const query =
		"SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";
	const user = db.query(query);
	return user;
}

function validateSession(token) {
	if (!token) return null;
	// Token validation happens here
	const payload = decodeJWT(token);
	return payload.userId;
}

// File: src/middleware.js (modified)
function authMiddleware(req, res, next) {
	const token = req.headers["authorization"];
	const userId = validateSession(token);

	if (!userId) {
		res.status(401).send("Unauthorized");
		return;
	}

	req.userId = userId;
	next();
}

app.use(authMiddleware);

// File: config.js (modified)
export const API_KEY = "sk_test_EXAMPLE_NOT_A_REAL_KEY_1111111";
export const DB_CONNECTION = {
	host: "localhost",
	port: 5432,
	database: "myapp",
	user: "postgres",
	password: "admin123",
};

// File: src/upload.js (new)
function handleFileUpload(req, res) {
	const file = req.files.upload;

	// Save file without validation
	file.mv("./uploads/" + file.name);
	res.send("File uploaded successfully");
}
