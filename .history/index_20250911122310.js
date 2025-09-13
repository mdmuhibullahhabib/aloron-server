const express = require('express')
require('dotenv').config()
const app = express()
const jwt = require('jsonwebtoken')
const cors = require('cors')
const port = process.env.PORT || 5000
const { ObjectId } = require('mongodb')

// middleware
app.use(cors())
app.use(express.json())

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

        // doctor related api
        app.post('/doctors', async (req, res) => {
            const booked = req.body
            const result = await doctorsCollection.insertOne(booked)
            res.send(result)
        })

        app.get('/doctors', async (req, res) => {
            const result = await doctorsCollection.find().toArray()
            res.send(result)
        })

        app.delete('/doctors/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await doctorsCollection.deleteOne(query)
            res.send(result)
        })

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
            const email = req.params.email
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Unauthorized access' })
            }
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
// ✅ Update course status
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const course = await Course.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!course) return res.status(404).json({ message: "Course not found" });

    res.status(200).json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Delete course
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await Course.findByIdAndDelete(id);
    res.status(200).json({ message: "Course deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Create new course (Duplicate)
router.post("/", async (req, res) => {
  try {
    const courseData = req.body;
    const newCourse = await Course.create(courseData);
    res.status(201).json(newCourse);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
২️⃣ Frontend: ManageCourses.jsx
jsx
Copy code
import React, { useState } from "react";
import {
  FaBookOpen,
  FaUsers,
  FaEdit,
  FaTrash,
  FaEye,
  FaToggleOn,
  FaToggleOff,
  FaListUl,
  FaMoneyBillWave,
  FaStar,
  FaCopy,
  FaInfoCircle,
  FaCheckCircle,
  FaTimesCircle,
  FaSearch,
  FaFilter,
} from "react-icons/fa";
import toast, { Toaster } from "react-hot-toast";
import useAxiosSecure from "../../../../hooks/useAxiosSecure";
import useCourses from "../../../../hooks/useCourses";
import CourseCurriculumModal from "./CourseCurriculumModal";
import CourseDetailsModal from "./CourseDetailsModal";
import CourseEditModal from "./CourseEditModal";
import CourseStudentsModal from "./CourseStudentsModal";

const ManageCourses = () => {
  const axiosSecure = useAxiosSecure(); // ✅ Backend call with JWT
  const [courses, refetch] = useCourses(); // কোর্স ডেটা লোড

  // ---------------- State ----------------
  const [selectedCurriculum, setSelectedCurriculum] = useState(null);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [selectedEdit, setSelectedEdit] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState(null);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");

  // ---------------- Backend Operations ----------------

  // ✅ Approve → Published
  const handleApprove = async (id) => {
    try {
      await axiosSecure.patch(`/courses/${id}`, { status: "Published" });
      toast.success("✅ কোর্স Published হয়েছে");
      refetch();
    } catch (err) {
      console.error(err);
      toast.error("Publish ব্যর্থ হয়েছে!");
    }
  };

  // ✅ Reject → Rejected
  const handleReject = async (id) => {
    try {
      await axiosSecure.patch(`/courses/${id}`, { status: "Rejected" });
      toast.error("❌ কোর্স Rejected হয়েছে");
      refetch();
    } catch (err) {
      console.error(err);
      toast.error("Reject ব্যর্থ হয়েছে!");
    }
  };

  // ✅ Publish / Unpublish toggle
  const handleTogglePublish = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === "Published" ? "Draft" : "Published";
      await axiosSecure.patch(`/courses/${id}`, { status: newStatus });
      toast.success(
        newStatus === "Published"
          ? "✅ কোর্স Published হয়েছে"
          : "⏸️ কোর্স Unpublished হয়েছে"
      );
      refetch();
    } catch (err) {
      console.error(err);
      toast.error("Status update ব্যর্থ হয়েছে!");
    }
  };

  // ✅ Delete
  const handleDelete = async (id) => {
    if (confirm("আপনি কি নিশ্চিত এই কোর্স ডিলিট করতে চান?")) {
      try {
        await axiosSecure.delete(`/courses/${id}`);
        toast.error("🗑️ কোর্স ডিলিট হয়েছে");
        refetch();
      } catch (err) {
        console.error(err);
        toast.error("Delete ব্যর্থ হয়েছে!");
      }
    }
  };

  // ✅ Duplicate
  const handleDuplicate = async (course) => {
    try {
      const newCourse = { ...course, _id: undefined, title: course.title + " (Copy)", status: "Draft" };
      await axiosSecure.post("/courses", newCourse);
      toast.success("📑 কোর্স ডুপ্লিকেট হয়েছে");
      refetch();
    } catch (err) {
      console.error(err);
      toast.error("Duplicate ব্যর্থ হয়েছে!");
    }
  };

  // ✅ Students (modal)
  const handleViewStudents = (course) => setSelectedStudents(course);

  // ---------------- Filter + Search ----------------
  const filteredCourses = courses.filter(
    (c) =>
      (filter ? c.status === filter : true) &&
      (search
        ? c.title.toLowerCase().includes(search.toLowerCase()) ||
          c.subject.toLowerCase().includes(search.toLowerCase()) ||
          c.teacher.toLowerCase().includes(search.toLowerCase())
        : true)
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <Toaster position="top-center" reverseOrder={false} />
      <h2 className="text-2xl font-bold mb-6 text-green-600 text-center">
        📚 Manage Courses (Admin)
      </h2>

      {/* Filter & Search */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <FaFilter />
          <select className="select select-bordered select-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">সবগুলো</option>
            <option value="Published">Published</option>
            <option value="Draft">Draft</option>
            <option value="Pending">Pending</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <FaSearch />
          <input type="text" placeholder="Search by title, subject, teacher" value={search} onChange={(e) => setSearch(e.target.value)} className="input input-bordered input-sm"/>
        </div>
      </div>

      {/* Courses Grid */}
      {filteredCourses.length === 0 ? (
        <p className="text-center text-gray-500">কোনো কোর্স পাওয়া যায়নি।</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => (
            <div key={course._id} className="bg-white shadow-md rounded-xl p-6 border border-gray-200 flex flex-col">
              <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                <FaBookOpen className="text-green-600" /> {course.title}
              </h3>
              <p className="text-sm text-gray-600">বিষয়: <span className="font-semibold">{course.subject}</span></p>
              <p className="text-sm text-gray-600">শিক্ষক: {course.teacher}</p>
              <p className="text-sm text-gray-600">লেভেল: {course.level}</p>
              <p className="text-sm text-gray-500 line-clamp-2 my-2">{course.description}</p>
              <p className="text-sm text-gray-600">⏳ মেয়াদ: {course.duration}</p>
              <p className="text-sm text-gray-600">💰 ফি: {course.price} টাকা</p>
              <p className="text-sm text-yellow-600 flex items-center gap-1 mb-2"><FaStar /> {course.rating} ⭐</p>
              <p className="text-sm text-green-700 flex items-center gap-1 mb-3"><FaMoneyBillWave /> মোট আয়: {course.revenue} টাকা</p>

              {/* Status */}
              <span className={`inline-block px-3 py-1 text-xs rounded-full font-medium mb-3 ${course.status === "Published" ? "bg-green-100 text-green-700" : course.status === "Draft" ? "bg-yellow-100 text-yellow-700" : course.status === "Pending" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                {course.status}
              </span>

              {/* Students Count */}
              <p className="text-sm text-gray-600 mb-3 flex items-center gap-2"><FaUsers className="text-blue-600" /> শিক্ষার্থী: {course.students}</p>

              {/* Buttons */}
              <div className="flex flex-wrap gap-2 mt-auto">
                {course.status === "Pending" && (
                  <>
                    <button onClick={() => handleApprove(course._id)} className="btn btn-xs bg-green-600 text-white"><FaCheckCircle /> Approve</button>
                    <button onClick={() => handleReject(course._id)} className="btn btn-xs bg-red-600 text-white"><FaTimesCircle /> Reject</button>
                  </>
                )}
                <button onClick={() => handleTogglePublish(course._id, course.status)} className={`btn btn-xs text-white ${course.status === "Published" ? "bg-yellow-600" : "bg-green-600"}`}>
                  {course.status === "Published" ? <FaToggleOff /> : <FaToggleOn />} {course.status === "Published" ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => setSelectedEdit(course)} className="btn btn-xs bg-blue-600 text-white"><FaEdit /> Edit</button>
                <button onClick={() => handleViewStudents(course)} className="btn btn-xs bg-indigo-600 text-white"><FaEye /> Students</button>
                <button onClick={() => handleDuplicate(course)} className="btn btn-xs bg-teal-600 text-white"><FaCopy /> Duplicate</button>
                <button onClick={() => handleDelete(course._id)} className="btn btn-xs bg-red-600 text-white"><FaTrash /> Delete</button>
                <button onClick={() => setSelectedCurriculum(course)} className="

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

    app.get('/order',  async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await orderCollection.find(query).toArray();
      console.log(query)
      res.send(result);
    });


    app.get('/orders',  async (req, res) => {
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





        //  Community related api

    app.get('/community',  async (req, res) => {
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