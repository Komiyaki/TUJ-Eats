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
app.use(bodyParser.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));
app.use("/uploads/restaurants", express.static("uploads/restaurants"));
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

// File paths
const USERS_FILE = "user.json";
const RESTAURANT_FILE = "restaurant.json";
const COMMENTS_FILE = "comments.json";

// Helpers
const readJSON = (filePath) => {
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

const writeJSON = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Routes

app.get("/", (req, res) => {
  res.redirect("/loginPage.html");
});

app.post("/register", upload.single("student_id_image"), (req, res) => {
  const { tuid, email, first_name, last_name } = req.body;
  const imageFile = req.file?.filename;

  if (!tuid || !email || !first_name || !last_name || !imageFile) {
    return res.status(400).send("Missing required fields");
  }

  const users = readJSON(USERS_FILE);
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
    password: "temp1234"
  };

  users.push(newUser);
  writeJSON(USERS_FILE, users);
  res.redirect("/loginPage.html?registered=1");
});

app.post("/login", (req, res) => {
  const { identifier, password } = req.body;
  const users = readJSON(USERS_FILE);

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

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/loginPage.html");
});

app.get("/main", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/loginPage.html?error=unauthorized");
  }

  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.id === req.session.userId);
  if (!user) {
    return res.redirect("/loginPage.html?error=notfound");
  }

  const restaurants = readJSON(RESTAURANT_FILE);
  const restaurantHtml = restaurants.map(r => `
    <div class="restaurant">
      <h2>${r.name}</h2>
      <p><strong>Category:</strong> ${r.category}</p>
      <p><strong>Address:</strong> ${r.address}</p>
      <img src="${r.image.startsWith('http') ? r.image : '/uploads/restaurants/' + r.image}" alt="${r.name}" width="300" />
      <p>${r.description}</p>
    </div>
  `).join("");

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Main</title>
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
        <img src="/uploads/${user.image}" alt="Student ID" width="200" />
      </div>
      <hr />
      <h2>Restaurant List</h2>
      ${restaurantHtml}
    </body>
    </html>
  `);
});

// POST /comment - only if logged in
app.post("/comment", (req, res) => {
  const { restaurantId, comment } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).send("Unauthorized: Please log in first");
  }

  if (!restaurantId || !comment) {
    return res.status(400).send("Missing fields");
  }

  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(403).send("User not found");
  }

  const comments = readJSON(COMMENTS_FILE);
  comments.push({
    id: uuid(),
    restaurantId,
    userId,
    userName: `${user.first_name} ${user.last_name}`,
    comment,
    timestamp: new Date().toISOString()
  });
  writeJSON(COMMENTS_FILE, comments);

  res.status(200).send("Comment saved");
});

// GET /me - check session
app.get("/me", (req, res) => {
  if (!req.session.userId) {
    return res.json({ loggedIn: false });
  }
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.id === req.session.userId);
  if (!user) {
    return res.json({ loggedIn: false });
  }
  res.json({ loggedIn: true, user });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});