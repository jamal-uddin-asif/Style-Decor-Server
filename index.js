const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = process.env.MONGODB_URL;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Nexa Decor running fast!");
});

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("StyleDecor");
    const userCollection = db.collection("Users");

    // user related api
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      (user.role = "user"), (user.createdAt = new Date().toDateString());

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

  

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
