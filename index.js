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

const admin = require("firebase-admin");
const serviceAccount = require("./firebase-adminsdk.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


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

const verifyFirebaseToken =async (req, res, next) =>{
  const authorization = req.headers.authorization
 if(!authorization){
  res.status(401).send({message: 'Unauthorized access'})
  return
 }
 const token = authorization.split(' ')[1]
 if(!token) {
  res.status(401).send({message: 'Unauthorized access'})
  return
 }

 try{
    const decoded = await admin.auth().verifyIdToken(token)
    req.decoded_email = decoded.email;
    next()
 }catch(err){
    res.status(401).send({message: 'Unauthorized access'})
    return
 }

}

async function run() {
  try {
    const db = client.db("StyleDecor");
    const userCollection = db.collection("Users");
    const servicesCollection = db.collection("Services");
    const bookingCollection = db.collection("Bookings");
    const paymentsCollection = db.collection("Payments");
    const trackingsCollection = db.collection("Trackings");


    // trackings api 
    const logTrackings = async (trackingId, status) =>{
      const log = {
        trackingId, 
        status, 
        createdAt: new Date().toDateString()
      }
      const result = await trackingsCollection.insertOne(log)
    }

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
    app.get('/manage-services',verifyFirebaseToken, async(req, res)=>{
      const {email} = req.query;
      const cursor = servicesCollection.find({creatorEmail: email});
      const result = await cursor.toArray();
      res.send(result);
    })

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
        .skip(0)
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

    app.patch('/service/:id', async(req, res)=>{
      const id = req.params.id;
      const service = req.body;
      const query = {_id: new ObjectId(id)}
      console.log(service)
      const updateDoc = {
        $set: {
          category: service.category,
          cost: service.cost,
          description: service.description,
          location: service.location,
          rating: service.rating,
          serviceName: service.serviceName,
          shortDescription: service.shortDescription
        }
      }
      const updated = await servicesCollection.updateOne(query, updateDoc)
      res.send(updated)
    })

    app.delete('/services/:id', async(req, res)=>{
      const id = req.params.id
      const deleted = await servicesCollection.deleteOne({_id: new ObjectId(id)}) 
      res.send(deleted)
    })

    //***********  Booking related APIs here *****************
    app.post("/bookings", async (req, res) => {
      const bookingInfo = req.body;
      const trackingId = generateTrackingId();
      bookingInfo.trackingId = trackingId
      const result = await bookingCollection.insertOne(bookingInfo);
      logTrackings(trackingId, 'Created')
      res.send(result);
    });

    app.get("/bookings",verifyFirebaseToken, async (req, res) => {
      
      const { email, limit= 0, skip = 0 } = req.query;
      const query = {};
      if (email) {
        query.customerEmail = email;
      }
      if(email !== req.decoded_email){
        res.status(403).send({message: 'Forbidden access'})
        return
      }
      const bookings = await bookingCollection.find(query).skip(Number(skip)).limit(Number(limit)).toArray();
      const count = await bookingCollection.countDocuments()
      res.send({bookings, count});
    });
    // for pagination 
    app.get('/bookings/count', async(req, res)=>{
      const {email} = req.query;
      const result = await bookingCollection.find({customerEmail: email}).toArray()
      res.send(result)
    })

    app.get("/bookings/manage-bookings",verifyFirebaseToken, async (req, res) => {

      const result = await bookingCollection.find().toArray();
      res.send(result);
    });

    app.get('/bookings/decorator-assigned',verifyFirebaseToken, async(req, res)=>{
      const {email} = req.query;
      const query = {}
      if(email){
        query.decoratorEmail= email;
      }
      if(email !== req.decoded_email){
        res.status(403).send({message: 'Forbidden access'})
        return
      }
      const result = await bookingCollection.find(query).toArray()
      res.send(result)
    })

    app.patch('/bookings/:id', async(req, res)=>{
      const decorator = req.body;
      const bookingId = req.params.id;
      const query = {_id: new ObjectId(bookingId)}
      const updateDoc = {
        $set:{
          decoratorName: decorator.decoratorName,
          decoratorEmail: decorator.decoratorEmail,
          decoratorPhoto: decorator.decoratorPhoto,
          decoratorId: decorator.decoratorId,
          serviceStatus: 'Assigned'
        }
      }
      const result = await bookingCollection.updateOne(query, updateDoc)
      logTrackings(decorator.trackingId, 'Assigned')
      res.send(result)
    })

    app.patch('/bookings/:id/Update-service-status', async(req, res)=>{
      const id = req.params.id;
      const {status, trackingId} = req.body;
      const query = {_id: new ObjectId(id)}

      const updateDoc = {
        $set:{
          serviceStatus: status,
        }
      }

      const result = bookingCollection.updateOne(query, updateDoc)
      logTrackings(trackingId, status)
      res.send(result)


    })

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
        logTrackings(session.metadata.trackingId, 'Pending')
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
