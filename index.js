const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URL;
const stripe = require("stripe")(process.env.STRIPE_SECRETE_KEY);

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
    const bookingCollection = db.collection("Bookings");

    // user related api
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      (user.role = "User"), (user.createdAt = new Date().toDateString());

      const isExisit = await userCollection.findOne({ email: user.email });
      if (isExisit) {
        return res.send({ message: "Alrady in stored in database" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const { email } = req.query;
      const query = {};
      if (email) {
        query.email = email;
      }
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const role = req.body.role;

      const query = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // services related APIs
    app.post("/services", async (req, res) => {
      const service = req.body;
      const result = await servicesCollection.insertOne(service);
      res.send(result);
    });

    app.get("/services", async (req, res) => {
      const { search, category } = req.query;
      const query = {};
      if (search) {
        query.serviceName = { $regex: search, $options: "i" };
      }
      if (category) {
        query.category = category;
      }
      console.log(category);
      const cursor = servicesCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await servicesCollection.findOne(query);
      res.send(result);
    });

    // Booking related APIs here
    app.post("/bookings", async (req, res) => {
      const bookingInfo = req.body;
      const result = await bookingCollection.insertOne(bookingInfo);
      res.send(result);
    });

    app.get("/bookings/:email", async (req, res) => {
      const { email } = req.params;
      const query = { customerEmail: email };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/booking/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    // Payment Related APIs
    app.post("/create-checkout-session", async (req, res) => {
      const service = req.body;
      const amount = parseInt(service.cost * 100)
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            // Provide the exact Price ID (for example, price_1234) of the product you want to sell
            price_data:{
              currency: 'usd',
              product_data:{
                name: service.serviceName,
                description: service.shortDescription,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
            serviceId: service.serviceId
        },
        customer_email:service.customerEmail,
        success_url: `${process.env.CLIENT_SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_SITE_DOMAIN}/dashboard/myBookings`,
      });

      res.send({url:session.url})
    });

    app.patch('/payment-success', async(req, res)=>{
      const {sessionId} = req.query;
      const session = await stripe.checkout.sessions.retrieve(sessionId)

      if(session.payment_status === 'paid'){
       const id =  session.metadata.serviceId
       console.log("ServiceId--->", id)
       const query = {_id: new ObjectId(id)}
       const filter = await servicesCollection.findOne(query)
       console.log("Service --->", filter)
      }
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
