const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URL;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Style Decor running fast!");
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
    const servicesCollection = db.collection("Services");

    // user related api
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      (user.role = "User"), (user.createdAt = new Date().toDateString());

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const { email } = req.query;
      const query = {};
      if (email) {
        query.email = email;
      }
      const result = await userCollection.find().toArray()
      res.send(result)
    });

    app.patch('/users/:id', async(req, res)=>{
      const id = req.params.id;
      const role = req.body.role;

      const query = {_id: new ObjectId(id)}

      const updateDoc = {
        $set:{
          role: role
        }
      }
      const result = await userCollection.updateOne(query, updateDoc)
      res.send(result)

    })

    // services related APIs 
    app.post('/services', async(req, res)=>{
      const service = req.body;
      const result = await servicesCollection.insertOne(service)
      res.send(result)

    })

    app.get('/services', async(req, res)=>{
      const {search, category} = req.query
      const query = {}
      if(search){
        query.serviceName = {$regex: search,$options: "i"}
      }
      if(category){
        query.category = category;
      }
      console.log(category)
      const cursor = servicesCollection.find(query)
      const result = await cursor.toArray()
      res.send(result)
    })

    app.get('/services/:id', async(req, res)=>{
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await servicesCollection.findOne(query)
      res.send(result)
    })

    

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Style Decor app listening on port ${port}`);
});
