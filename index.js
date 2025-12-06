const express = require('express')
const app = express()
const port = process.env.PORT || 3000 ;
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.MONGODB_URL

app.get('/', (req, res) => {
  res.send('Nexa Decor running fast!')
})

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run(){
    try{



    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    }finally{

    }
}

run().catch(console.dir)


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
