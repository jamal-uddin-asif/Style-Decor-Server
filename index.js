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

function generateTrackingId() {
  const prefix = "TRK"; // change this if needed
  // Step 1: Get timestamp
  const now = new Date();
  const timestamp =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
  // Step 2: Generate random digits
  const random = Math.floor(100000 + Math.random() * 900000); // 6 digits
  // Step 3: Combine
  return `${prefix}-${timestamp}-${random}`;
}

async function run() {
  try {
    const db = client.db("StyleDecor");
    const userCollection = db.collection("Users");
    const servicesCollection = db.collection("Services");
    const bookingCollection = db.collection("Bookings");
    const paymentsCollection = db.collection("Payments");

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
      const { email, role } = req.query;
      console.log("AllDecorator --->", role);
      const query = {};
      if (email) {
        query.email = email;
      }
      if (role) {
        query.role = role;
      }
      const result = await userCollection.find(query).toArray();
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
      const cursor = servicesCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/hero-services", async (req, res) => {
      const projectFields = {
        _id: 1,
        serviceName: 1,
        serviceImg: 1,
        cost: 1,
        shortDescription: 1,
      };
      const cursor = servicesCollection
        .find()
        .project(projectFields)
        .skip(7)
        .limit(4);
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
      bookingInfo.trackingId = generateTrackingId();
      const result = await bookingCollection.insertOne(bookingInfo);
      res.send(result);
    });

    app.get("/bookings", async (req, res) => {
      const { email } = req.query;
      const query = {};
      if (email) {
        query.customerEmail = email;
      }
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
      const amount = parseInt(service.cost * 100);
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            // Provide the exact Price ID (for example, price_1234) of the product you want to sell
            price_data: {
              currency: "usd",
              product_data: {
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
          serviceId: service.serviceId,
          trackingId: service.trackingId,
          serviceName: service.serviceName,
          shortDescription: service.shortDescription,
          cost: service.cost
        },
        customer_email: service.customerEmail,
        success_url: `${process.env.CLIENT_SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_SITE_DOMAIN}/dashboard/myBookings`,
      });

      res.send({ url: session.url });
    });

    app.patch("/payment-success", async (req, res) => {
      const { sessionId } = req.query;
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // prevent dubble insert for useEffect 
      const query = {transactionId: session.payment_intent}
      const isExisit = await paymentsCollection.findOne(query)
      if(isExisit){
        res.send({message: 'Payment is exist in payment collection'})
        return
      }

      if (session.payment_status === "paid") {
        
        const paymentInfo = {
          serviceName: session.metadata.serviceName,
          trackingId: session.metadata.trackingId,
          customerEmail: session.customer_email,
          serviceId: session.metadata.serviceId,
          transactionId: session.payment_intent,
          paymentStatus: session.payment_status,
          cost: session.metadata.cost
        };  

        const paymentResult = await paymentsCollection.insertOne(paymentInfo)
        console.log(paymentResult)
        // update bookingCollection status 
        const id = session.metadata.serviceId;
        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            paymentStatus: "Paid",
            serviceStatus: "Pending",
            transactionId: session.payment_intent,
          },
        };
        const bookingUpdateResult = await bookingCollection.updateOne(query, updateDoc);
        res.send({paymentResult, bookingUpdateResult})
      }
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
  console.log(`Style Decor app listening on port ${port}`);
});
