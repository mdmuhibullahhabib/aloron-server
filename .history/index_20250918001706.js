const express = require('express')
require('dotenv').config()
const app = express()
const jwt = require('jsonwebtoken')
const cors = require('cors')
const port = process.env.PORT || 5000;
const { ObjectId } = require('mongodb')
const axios = require("axios");
const { addMonths } = require("date-fns");


// middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }));

const { MongoClient, ServerApiVersion } = require('mongodb')
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.w5eri.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
    }
})


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect()

        const userCollection = client.db('Aloron').collection('users')
        const courseCollection = client.db('Aloron').collection('courses')
        const enrollmentCollection = client.db('Aloron').collection('enrollments')
        const productCollection = client.db('Aloron').collection('products')
        const cartCollection = client.db('Aloron').collection('cart')
        const orderCollection = client.db('Aloron').collection('orders')
        const questionCollection = client.db('Aloron').collection('questions')
        const practiceCollection = client.db('Aloron').collection('practice')
        const communityCollection = client.db('Aloron').collection('community')
        const subscriptionCollection = client.db('Aloron').collection('subscription')
        const paymentCollection = client.db('Aloron').collection('payment')
        const journalCollection = client.db('Aloron').collection('journals')
        const blogCollection = client.db('Aloron').collection('blogs')

        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            })
            res.send({ token })
        })

        // middlewares
        const verifyToken = (req, res, next) => {
            console.log('inside verify token', req.headers.authorization)
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded
                next()
            })
        }

        // payment related apis
        app.post('/create-ssl-payment', async (req, res) => {
            const payment = req.body;
            console.log("payment", payment)

            const trxid = new ObjectId().toString();
            payment.transactionId = trxid;

            //step 1: initialize the data
            const initiate = {
                store_id: `${process.env.PAYMENT_ID}`,
                store_passwd: `${process.env.PAYMENT_PASS}`,
                total_amount: payment.price,
                currency: "BDT",
                tran_id: trxid,
                success_url: "http://localhost:5000/success-payment",
                fail_url: "http://localhost:5173/fail",
                cancel_url: "http://localhost:5173/cancle",
                ipn_url: "http://localhost:5000/ipn-success-payment",
                cus_name: "Customer Name",
                cus_email: `${payment.email}`,
                cus_add1: "Dhaka&",
                cus_add2: "Dhaka&",
                cus_city: "Dhaka&",
                cus_state: "Dhaka&",
                cus_postcode: 1000,
                cus_country: "Bangladesh",
                cus_phone: "01711111111",
                cus_fax: "01711111111",
                shipping_method: "NO",
                product_name: "Laptop",
                product_category: "Laptop",
                product_profile: "general",
                multi_card_name: "mastercard,visacard,amexcard",
                value_a: "ref001_A&",
                value_b: "ref002_B&",
                value_c: "ref003_C&",
                value_d: "ref004_D",
            };

            //step 2: send the request to sslcommerz payment gateway
            const iniResponse = await axios({
                url: "https://sandbox.sslcommerz.com/gwprocess/v4/api.php",
                method: "POST",
                data: initiate,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            });
            const saveData = await paymentCollection.insertOne(payment);

            // If subscription, also create a pending subscription entry
            if (payment.category === "subscription") {
                await subscriptionCollection.insertOne({
                    userId: payment.userId,
                    userEmail: payment.email,
                    planId: payment.referenceId,
                    transactionId: trxid,
                    price: payment.price,
                    status: "pending",
                    startDate: null, // not started yet
                    endDate: null,
                    examCredit: payment.examCredit || 1,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }

            if (payment.category === "course") {
                // Mark enrollment as pending
                await enrollmentCollection.insertOne({
                    userId: payment.userId,
                    email: payment.email,
                    price: payment.price,
                    courseId: payment.referenceId,
                    transactionId: trxid,
                    status: "pending",
                    enrolledAt: null,
                });
            }

            // if (payment.category === "shop") {
            //     // Save cart order as pending
            //     await orderCollection.insertOne({
            //         userId: payment.userId,
            //         email: payment.email,
            //         cartIds: payment.cartIds,
            //         items: payment.menuItemIds,
            //         transactionId: trxid,
            //         total: payment.price,
            //         status: "pending",
            //         createdAt: new Date(),
            //     });
            // }

            const gatewayUrl = iniResponse?.data?.GatewayPageURL;
            res.send({ gatewayUrl });
        });

        app.post("/success-payment", async (req, res) => {
            //step-5 : success payment data
            const paymentSuccess = req.body;
            console.log(paymentSuccess)

            //step-6: Validation
            const { data } = await axios.get(
                `https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?val_id=${paymentSuccess.val_id}&store_id=${process.env.PAYMENT_ID}&store_passwd=${process.env.PAYMENT_PASS}&format=json`
            );
            if (data.status !== "VALID") {
                return res.send({ message: "Invalid payment" });
            }

            //step-7: update the payment to your database
            const updatePayment = await paymentCollection.updateOne(
                { transactionId: data.tran_id },
                {
                    $set: {
                        status: "success",
                    },
                }
            );

            //step-8: find the payment for more functionality
            const payment = await paymentCollection.findOne({
                transactionId: data.tran_id,
            });

            console.log('payment', payment)

            // Handle subscription
            if (payment.category === "subscription") {
                const updateSubscription = await subscriptionCollection.updateOne(
                    { transactionId: data.tran_id },
                    {
                        $set: {
                            status: "active",
                            updatedAt: new Date(),
                            startDate: new Date(),
                            endDate: addMonths(new Date(), 1),
                        },
                    }
                );
                console.log(updateSubscription)
            }

            // handle course
            if (payment.category === "course") {
                await enrollmentCollection.updateOne(
                    { transactionId: data.tran_id },
                    {
                        $set: {
                            status: "active",
                            enrolledAt: new Date(),
                        },
                    }
                );
            }

            // Handle Shop Payment
            if (payment.category === "shop") {
                // 1️⃣ Update order status
                const updateOrder = await orderCollection.updateOne(
                    { transactionId: data.tran_id },
                    {
                        $set: {
                            status: "completed",
                            updatedAt: new Date(),
                        },
                    }
                );

                // Remove items from cart
                if (payment.cartIds && payment.cartIds.length > 0) {
                    const query = {
                        _id: {
                            $in: payment.cartIds.map((id) => new ObjectId(id)),
                        },
                    };
                    const deleteResult = await cartCollection.deleteMany(query);
                    console.log("🛒 Cart cleared:", deleteResult.deletedCount, "items removed");
                }
            }

            //step-9: redirect the customer to success page
            res.redirect("http://localhost:5173/success");
            // console.log(updatePayment, "updatePayment");
            // console.log("isValidPayment", data);

        });

        // user related apis
        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user)
            res.send(result)
        })

        // user get user data
        app.get('/user', async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const result = await userCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/users/role/:email', async (req, res) => {
            // const role = student;
            // res.send(role)
            const email = req.params.email;
            // if (email !== req.decoded.email) {
            //     return res.status(403).send({ message: 'Unauthorized access' })
            // }
            const query = { email: email }
            const user = await userCollection.findOne(query)

            // const admin = user.role === 'admin'
            const role = user.role

            res.send({ role })
        })

        app.patch('/users/role/:id', async (req, res) => {
            const id = req.params.id
            const { role } = req.body
            const allowedRoles = ['student', 'teacher', 'admin']
            if (!allowedRoles.includes(role)) {
                return res.status(400).send({ message: 'Invalid role specified.' })
            }
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: { role: role }
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        app.patch(
            '/users/guide/:id',
            // verifyToken,
            // verifyAdmin,
            async (req, res) => {
                const id = req.params.id
                const { role } = req.body
                const filter = { _id: new ObjectId(id) }
                const updatedDoc = {
                    $set: { role }
                }
                const result = await userCollection.updateOne(filter, updatedDoc)
                res.send(result)
            }
        )

        app.get('/user', async (req, res) => {
            const email = req.query.email
            const result = await userCollection.findOne({ email })
            res.send(result)
        })

        app.put('/users/:id', async (req, res) => {
            const { id } = req.params
            const updateData = req.body
            const result = await userCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updateData }
            )
            res.send(result)
        })

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query)
            res.send(result)
        })

        // course related api
        app.post('/courses', async (req, res) => {
            const booked = req.body
            const result = await courseCollection.insertOne(booked)
            res.send(result)
        })

        app.patch('/courses/:id', async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;
            const result = await courseCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { status } }
            );
            res.send(result);
        });

        app.get('/courses', async (req, res) => {
            const result = await courseCollection.find().toArray()
            res.send(result)
        })

        app.get('/courses', async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const result = await courseCollection.find(query).toArray()
            res.send(result)
        })

        app.patch('/courses/:id', async (req, res) => {
            const id = req.params.id
            const result = await courseCollection.updateOne(
                { _id: new ObjectId(id), status: 'pending' },
                { $set: { status: 'in-review' } }
            )
            res.send(result)
        })

        app.delete('/courses/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await courseCollection.deleteOne(query)
            res.send(result)
        })

        // subscription related apis
        app.post("/subscriptions", async (req, res) => {
            const subscription = req.body;
            const result = await subscriptionCollection.insertOne(subscription);
            res.send(result);
        });

        // ✅ Update subscription status by ID
        app.patch("/subscriptions/:id", async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;
            const result = await subscriptionCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { status } }
            );
            res.send(result);
        });

        // ✅ Get all subscriptions
        app.get("/subscriptions", async (req, res) => {
            const result = await subscriptionCollection.find().toArray();
            res.send(result);
        });

        // ✅ Get subscriptions by userId
        app.get("/subscriptions/user", async (req, res) => {
            const id = req.query.id;
            const query = { userId: id };
            const result = await subscriptionCollection.find(query).toArray();
            res.send(result);
        });

        // ✅ Update subscription to "renewed" if pending (example)
        app.patch("/subscriptions/renew/:id", async (req, res) => {
            const id = req.params.id;
            const result = await subscriptionCollection.updateOne(
                { _id: new ObjectId(id), status: "active" },
                { $set: { status: "renewed" } }
            );
            res.send(result);
        });

        // ✅ Delete subscription by ID
        app.delete("/subscriptions/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await subscriptionCollection.deleteOne(query);
            res.send(result);
        });


        // Shop related api
        app.post('/products', async (req, res) => {
            const booked = req.body
            const result = await productCollection.insertOne(booked)
            res.send(result)
        })

        app.get('/products', async (req, res) => {
            const result = await productCollection.find().toArray()
            res.send(result)
        })

        app.get('/product', async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const result = await productCollection.find(query).toArray()
            res.send(result)
        })

        app.patch('/products/:id', async (req, res) => {
            const id = req.params.id
            const result = await productCollection.updateOne(
                { _id: new ObjectId(id), status: 'pending' },
                { $set: { status: 'in-review' } }
            )
            res.send(result)
        })

        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await productCollection.deleteOne(query)
            res.send(result)
        })



        // Cart 
        app.post('/cart', async (req, res) => {
            const cart = req.body
            const result = await cartCollection.insertOne(cart)
            res.send(result)
        })

        app.get('/cart', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        });

        app.delete('/cart/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.deleteOne(query)
            res.send(result)
        })

        // orders
        app.post('/orders', async (req, res) => {
            const booked = req.body
            const result = await orderCollection.insertOne(booked)
            res.send(result)
        })

        app.get('/order', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await orderCollection.find(query).toArray();
            console.log(query)
            res.send(result);
        });

        app.get('/orders', async (req, res) => {
            const result = await orderCollection.find().toArray()
            res.send(result)
        })

        app.patch('/orders/:id', async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;
            const result = await orderCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { status } }
            );
            res.send(result);
        });

        // journal related apis 
        app.post('/journals', async (req, res) => {
            const journal = req.body
            const result = await journalCollection.insertOne(journal)
            res.send(result)
        })

        app.get('/journals', async (req, res) => {
            const result = await journalCollection.find().toArray()
            res.send(result)
        })

        app.get('/journal', async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const result = await journalCollection.find(query).toArray()
            res.send(result)
        })

        app.patch('/journals/:id', async (req, res) => {
            const id = req.params.id
            const result = await journalCollection.updateOne(
                { _id: new ObjectId(id), status: 'pending' },
                { $set: { status: 'in-review' } }
            )
            res.send(result)
        })

        app.delete('/journals/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await journalCollection.deleteOne(query)
            res.send(result)
        })
        
        // blog related apis 
        app.post('/blogs', async (req, res) => {
            const blog = req.body
            const result = await blogCollection.insertOne(blog)
            res.send(result)
        })

        app.get('/blogs', async (req, res) => {
            const result = await blogCollection.find().toArray()
            res.send(result)
        })

        app.get('/blog', async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const result = await blogCollection.find(query).toArray()
            res.send(result)
        })

        app.patch('/journals/:id', async (req, res) => {
            const id = req.params.id
            const result = await journalCollection.updateOne(
                { _id: new ObjectId(id), status: 'pending' },
                { $set: { status: 'in-review' } }
            )
            res.send(result)
        })

        app.delete('/journals/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await journalCollection.deleteOne(query)
            res.send(result)
        })


        //  Community related api
        app.get('/community', async (req, res) => {
            const result = await communityCollection.find().toArray()
            res.send(result)
        })


        //  QUESTIONBANK RELATED APIS

        // Exam related api
        app.post('/practice-questions', async (req, res) => {
            const booked = req.body
            const result = await practiceCollection.insertOne(booked)
            res.send(result)
        })


        app.get('/practice-questions', async (req, res) => {
            try {
                const { subject, paper, chapter } = req.query;

                // Build dynamic filter object
                const filter = {};
                if (subject) filter.subject = subject;
                if (paper) filter.paper = paper;
                if (chapter) filter.chapter = chapter;

                const result = await practiceCollection.find(filter).toArray();
                res.status(200).json(result);
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: 'Server Error' });
            }
        });




        // Exam related api
        app.post('/questions', async (req, res) => {
            const booked = req.body
            const result = await questionCollection.insertOne(booked)
            res.send(result)
        })

        app.get('/questions', async (req, res) => {
            const result = await questionCollection.find().toArray()
            res.send(result)
        })



        // enrollments related api
        app.post('/enrollments', async (req, res) => {
            const booked = req.body
            const result = await enrollmentCollection.insertOne(booked)
            res.send(result)
        })

        app.get('/enrollments', async (req, res) => {
            const result = await enrollmentCollection.find().toArray()
            res.send(result)
        })

        // student-enrolled-course
        app.get('/enrolled', async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const result = await enrollmentCollection.find(query).toArray()
            res.send(result)
        })

        app.patch('/enrollments/:id', async (req, res) => {
            const id = req.params.id
            const result = await enrollmentCollection.updateOne(
                { _id: new ObjectId(id), status: 'pending' },
                { $set: { status: 'in-review' } }
            )
            res.send(result)
        })

        app.delete('/enrollments/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await enrollmentCollection.deleteOne(query)
            res.send(result)
        })


        // reviews related api
        app.post('/reviews', async (req, res) => {
            const { review, name, date } = req.body
            const result = await reviewsCollection.insertOne({ review, name, date })
            res.send(result)
        })

        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find().toArray()
            res.send(result)
        })

        app.get('/reviews', async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const result = await reviewsCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/reviews-random', async (req, res) => {
            const result = await reviewsCollection
                .aggregate([{ $sample: { size: 2 } }])
                .toArray()
            res.send(result)
        })

        app.delete('/review/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await reviewsCollection.deleteOne(query)
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log(
            'Pinged your deployment. You successfully connected to MongoDB!'
        )
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('hashi in running...')
})

app.listen(port, () => {
    console.log(`hashi is running on port ${port}`)
})