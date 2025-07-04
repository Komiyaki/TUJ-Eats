const express = require("express");
const multer = require("multer");
const uuid = require("uuid").v4;
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const bodyParser = require("body-parser");

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public")); // For HTML, CSS
app.use("/uploads", express.static("uploads")); // For uploaded images
app.use(session({
  secret: "tuj-eats-secret",
  resave: false,
  saveUninitialized: true
}));

// File upload config
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// User data helpers
const USERS_FILE = "user.json";
const readUsers = () => {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
};
const writeUsers = (users) => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

// Home route
app.get("/", (req, res) => {
  res.redirect("/loginPage.html");
});

// Register route
app.post("/register", upload.single("student_id_image"), (req, res) => {
  const { tuid, email, first_name, last_name } = req.body;
  const imageFile = req.file?.filename;

  if (!tuid || !email || !first_name || !last_name || !imageFile) {
    return res.status(400).send("Missing required fields");
  }

  let users = readUsers();
  if (users.find(u => u.tuid === tuid || u.email === email)) {
    return res.redirect("/RegisterPage.html?error=exists");
  }

  const newUser = {
    id: uuid(),
    tuid,
    email,
    first_name,
    last_name,
    image: imageFile,
    password: "temp1234" // Default password
  };

  users.push(newUser);
  writeUsers(users);
  res.redirect("/loginPage.html?registered=1");
});

// Login route
app.post("/login", (req, res) => {
  const { identifier, password } = req.body;
  let users = readUsers();

  const user = users.find(u =>
    (u.email === identifier || u.tuid === identifier) &&
    u.password === password
  );

  if (user) {
    req.session.userId = user.id;
    return res.redirect("/main");
  } else {
    return res.redirect("/loginPage.html?error=invalid");
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/loginPage.html");
});

// Protected main page
app.get("/main", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/loginPage.html?error=unauthorized");
  }

  const users = readUsers();
  const user = users.find(u => u.id === req.session.userId);
  if (!user) {
    return res.redirect("/loginPage.html?error=notfound");
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Welcome</title>
      <link rel="stylesheet" href="/style.css" />
    </head>
    <body>
      <div class="header-bar">
        <h1>Welcome, ${user.first_name} ${user.last_name}</h1>
        <a href="/logout">Logout</a>
      </div>
      <div>
        <p>TUid: ${user.tuid}</p>
        <p>Email: ${user.email}</p>
        <img src="/uploads/${user.image}" alt="Student ID" width="300" />
      </div>
    </body>
    </html>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});