const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRETE_KEY);
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());







const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.k53g2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        const userCollection = client.db("scholarshipDb").collection("users");
        const allScholarshipCollection = client.db("scholarshipDb").collection("allScholarship");
        const appliedScholarshipCollection = client.db("scholarshipDb").collection("appliedScholarships");
        const reviewCollection = client.db("scholarshipDb").collection("reviews");
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");



        // jwt related api 
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '4h' })
            res.send({ token })
        })
        // verify token 
        const verifyToken = (req, res, next) => {
            // console.log("inside verify", req.headers);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorize access' })

            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorize access' })

                }
                req.decoded = decoded;
                next();
            })


        }
        // verify admin 
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })

            }
            next();
        }


        // scholarship related api


        const verifyAdminOrModerator = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);

            if (user?.role === 'admin' || user?.role === 'moderator') {
                next();
            } else {
                return res.status(403).send({ message: 'Forbidden access' });
            }
        };


        app.post('/allScholarship', verifyToken, verifyAdminOrModerator, async (req, res) => {
            const scholarship = req.body;
            const result = await allScholarshipCollection.insertOne(scholarship);
            res.send(result);
        });

        app.get('/allScholarship', verifyToken, verifyAdminOrModerator, async (req, res) => {
            const data = await allScholarshipCollection.find().toArray();
            res.send(data)
        })
        app.get('/allScholarships', async (req, res) => {
            const data = await allScholarshipCollection.find().toArray();
            res.send(data)
        })
        app.get('/allScholarships/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const data = await allScholarshipCollection.findOne(query);
            res.send(data)
        })
        app.get('/topScholarships', async (req, res) => {
            const data = await allScholarshipCollection
                .find()
                .sort({
                    applicationFees: 1,
                    scholarshipPostDate: -1
                })
                .limit(8)
                .toArray();
            res.send(data);
        });

        app.delete('/allScholarship/:id', verifyToken, verifyAdminOrModerator, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await allScholarshipCollection.deleteOne(query);
            res.send(result)

        })
        app.patch('/allScholarship/:id', verifyToken, verifyAdminOrModerator, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateData = { $set: req.body }
            const result = await allScholarshipCollection.updateOne(query, updateData);
            res.send(result)

        })
        // applied scholarship
        app.post('/appliedScholarships', verifyToken, async (req, res) => {
            const data = req.body;
            const result = await appliedScholarshipCollection.insertOne(data);
            res.send(result)
        })
        // scholarship for a user
        app.get('/appliedScholarships/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { userMail: email };
            const result = await appliedScholarshipCollection.find(query).toArray();
            res.send(result)
        })
        app.delete('/appliedScholarships/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const data = await appliedScholarshipCollection.deleteOne(query)
            res.send(data)
        })
        // get all scholarship
        app.get('/allAppliedScholarship', verifyToken, verifyAdminOrModerator, async (req, res) => {
            const { sortBy } = req.query;

            let sortCriteria = {};
            if (sortBy === 'applicationDate') {
                sortCriteria = {
                    applicationDate: 1
                };
            } else if (sortBy === 'deadLine') {
                sortCriteria = { deadLine: 1 };
            }

            const data = await appliedScholarshipCollection.find().sort(sortCriteria).toArray();
            res.send(data);
        });

        app.patch('/appliedScholarshipFeedback/:id', verifyToken, verifyAdminOrModerator, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateData = { $set: req.body };
            const data = await appliedScholarshipCollection.updateOne(query, updateData);
            res.send(data)
        })


        app.patch('/appliedScholarshipStatus/:id', verifyToken, verifyAdminOrModerator, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateData = { $set: req.body };
            const data = await appliedScholarshipCollection.updateOne(query, updateData);
            res.send(data)

        })

        // post review
        app.post('/reviews', verifyToken, async (req, res) => {
            const data = req.body;
            const result = await reviewCollection.insertOne(data);
            res.send(result)
        })
        app.get('/reviews/:id', async (req, res) => {
            const id = req.params.id;

            const query = { scholarshipId: id };
            const data = await reviewCollection.find(query).toArray()
            res.send(data)
        })
        app.get('/userReviews/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            console.log('Received email:', email);
            const query = { userEmail: email };
            const data = await reviewCollection.find(query).toArray();
            res.send(data)
        })
        app.delete('/userReviews/delete/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const data = await reviewCollection.deleteOne(query);
            res.send(data)
        })

        app.patch('/userReviews/update/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateData = { $set: req.body };
            const data = await reviewCollection.updateOne(query, updateData);
            res.send(data)
        })
        app.get('/allReviews', verifyToken, verifyAdminOrModerator, async (req, res) => {
            const data = await reviewCollection.find().toArray();
            res.send(data)
        })
        app.delete('/allReviews/delete/:id', verifyToken, verifyAdminOrModerator, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const data = await reviewCollection.deleteOne(query);
            res.send(data)

        })
        app.patch('/appliedScholarships/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateData = { $set: req.body };
            const data = await appliedScholarshipCollection.updateOne(query, updateData);
            res.send(data)
        })
        // user related apis
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exist' })
            }
            const result = await userCollection.insertOne(user);
            res.send(result)

        })
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const data = await userCollection.find().toArray();
            res.send(data)
        })
        // app.get('/user/:email',async(req,res)=>{
        //     const email = req.params.email;
        //     const query = {email: email};
        //     const data =await userCollection.findOne(query);
        //     res.send(data)

        // })
        app.get('/users/:email', verifyToken, verifyAdminOrModerator, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await userCollection.findOne(query);
            res.send(result);
        })
        app.get('/normalUsers/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await userCollection.findOne(query);
            res.send(result);
        })

        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query);
            res.send(result)
        })
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })
        app.patch('/users/moderator/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'moderator'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })
        app.patch('/users/user/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'user'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })
        // check admin
        app.get('/user/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            console.log(user)
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin })

        })
        // checking moderator
        app.get('/user/moderator/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            console.log(user)
            let moderator = false;
            if (user) {
                moderator = user?.role === 'moderator';
            }
            res.send({ moderator })

        })


        // payment related apis
        app.post('/create-checkout-session', async (req, res) => {
            const { price } = req.body;

            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })
       
        app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const usersCount = await userCollection.estimatedDocumentCount();
                const scholarshipsCount = await allScholarshipCollection.estimatedDocumentCount();
                const applicationsCount = await appliedScholarshipCollection.estimatedDocumentCount();
                const reviewsCount = await reviewCollection.estimatedDocumentCount();
               
                res.send({
                    users: usersCount,
                    scholarships: scholarshipsCount,
                    applications: applicationsCount,
                    reviews: reviewsCount,
                    
                });
            } catch (error) {
                console.error("Error fetching admin stats:", error);
                res.status(500).send({ message: "Failed to fetch admin statistics" });
            }
        });
        app.get('/user-stats/:email', verifyToken, async (req, res) => {
            try {
              const email = req.params.email;
          
            
              const user = await userCollection.findOne({ email: email });
          
              if (!user) {
                return res.status(404).send({ message: "User not found" });
              }
          
            
              const applicationsCount = await appliedScholarshipCollection.countDocuments({ userMail: email });
          
           
              const reviewsCount = await reviewCollection.countDocuments({ 
                userEmail: email });
          
              res.send({
                applicationsCount: applicationsCount,
                reviewsCount: reviewsCount,
              });
            } catch (error) {
              console.error("Error fetching user stats:", error);
              res.status(500).send({ message: "Failed to fetch user statistics" });
            }
          });
          
          
        
        



    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('scholar360 running ');
});

app.listen(port, () => [
    console.log(`scholar 360 is live at ${port}`)
])
