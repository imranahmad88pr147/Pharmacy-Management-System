// Import necessary modules
const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const hbs = require('hbs');
const path = require('path');

// Create Express application
const app = express();

// Set up MySQL connection configuration
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root', // Change this to your MySQL username
  password: '', // Change this to your MySQL password
  database: 'bpe' // Change this to your database name
});
// Define Handlebars helpers
hbs.registerHelper('formatDate', function(date) {
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
});
// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL database:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

// Set up middleware
app.use(express.static('public'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Define routes

// Render the index.hbs template for the homepage
app.get('/', (req, res) => {
  res.render('index');
});

// Render the medorder.hbs template for the medicine order page
app.get('/views/medorder', (req, res) => {
  // Example query to fetch data from MySQL based on status
  db.query('SELECT * FROM medvendororder WHERE receivestatus IS False', (err, pendingOrders) => {
      if (err) {
          res.status(500).send('Error fetching pending orders from database');
          return;
      }

      db.query('SELECT * FROM medvendororder WHERE receivestatus = 1', (err, receivedOrders) => {
          if (err) {
              res.status(500).send('Error fetching received orders from database');
              return;
          }

          res.render('medorder', {
              pendingOrders: pendingOrders,
              receivedOrders: receivedOrders
          }); // Render the medorder.hbs template and pass fetched data
      });
  });
});
// Handle POST requests to submit a new order
app.post('/', (req, res) => {
  const { medname, quantity, vendorname } = req.body;

  // Insert new order into MySQL
  db.query(
    'INSERT INTO medvendororder (medname, quantity, vendorname, orderdate) VALUES (?, ?, ?, NOW())',
    [medname, quantity, vendorname],
    (err, result) => {
      if (err) {
        console.error('Error executing MySQL query:', err);
        res.status(500).send('Error inserting data into database');
        return;
      }
      console.log('New order added successfully:', result); // Log successful insertion
      res.redirect('/views/medorder'); // Redirect to medorder page after successful submission
    }
  );
});

// Route to handle GET requests to the Customer Record Management page
app.get('/customer-record', (req, res) => {
  // Example query to fetch data from MySQL
  db.query('SELECT * FROM customers', (err, result) => {
    if (err) {
      console.error('Error executing MySQL query:', err);
      res.status(500).send('Error fetching data from database');
      return;
    }
    res.render('customerRecord', { customers: result }); // Pass fetched data to customerRecord.hbs template
  });
});

// Handle POST requests to update status
app.post('/update-status', (req, res) => {
    const { orderid, description, expiryDate, price, medname, quantity } = req.body;

    // Update status and recdate in MySQL for the specific orderid
    db.query(
        'UPDATE medvendororder SET receivestatus = 1, receivedate = NOW() WHERE orderid = ?',
        [orderid],
        (err, result) => {
            if (err) {
                console.error('Error updating receivestatus and receivedate:', err);
                res.status(500).send('Error updating receivestatus and receivedate in database');
                return;
            }
            console.log('Receive Status and Receive Date updated successfully:', result);
            
            // Check if the medicine already exists in the inventory
            db.query(
                'SELECT * FROM medications WHERE name = ?',
                [medname],
                (err, existingMedicine) => {
                    if (err) {
                        console.error('Error checking existing medicine:', err);
                        res.status(500).send('Error checking existing medicine in database');
                        return;
                    }

                    if (existingMedicine.length > 0) {
                        // If medicine already exists, update the quantity
                        const existingQuantity = existingMedicine[0].quantity;
                        const newQuantity = parseInt(existingQuantity) + parseInt(quantity); // Update quantity correctly
                        db.query(
                            'UPDATE medications SET quantity = ? WHERE name = ?',
                            [newQuantity, medname],
                            (err, result) => {
                                if (err) {
                                    console.error('Error updating existing medicine quantity:', err);
                                    res.status(500).send('Error updating existing medicine quantity in database');
                                    return;
                                }
                                console.log('Existing medicine quantity updated successfully:', result);
                                res.send('Order status updated and existing medicine quantity updated successfully');
                            }
                        );
                    } else {
                        // If medicine doesn't exist, insert it into the medications table
                        db.query(
                            'INSERT INTO medications (name, description, expiry_date, price, quantity) VALUES (?, ?, ?, ?, ?)',
                            [medname, description, expiryDate, price, quantity],
                            (err, result) => {
                                if (err) {
                                    console.error('Error inserting medicine into medications table:', err);
                                    res.status(500).send('Error inserting medicine into medications table');
                                    return;
                                }
                                console.log('Medicine added successfully:', result);
                                res.send('Order status updated and medicine added successfully');
                            }
                        );
                    }
                }
            );
        }
    );
});

// Handle POST requests for deleting a medication
app.post('/medications/delete/:id', (req, res) => {
  console.log('Delete request received'); // Debugging output
  const medicationId = req.params.id;
  console.log('Medication ID:', medicationId); // Debugging output
  db.query('DELETE FROM Medications WHERE medication_id = ?', [medicationId], (error, results) => {
    if (error) {
      console.error('Error deleting medication:', error);
      res.status(500).send('Internal Server Error');
      res.redirect('/medication');
    }
    return;
  });
});

// Delete customer record
app.post('/customer-record-delete', (req, res) => {
  const { customerid } = req.body;
  db.query('DELETE FROM customers WHERE customerid = ?', [customerid], (error, results) => {
    if (error) {
      console.error('Error deleting customer account:', error);
      res.status(500).send('Internal Server Error');
    } else {
      console.log('Deleted customer with ID:', customerid);
      res.status(200).json({ message: `Customer with ID ${customerid} has been deleted.` });
    }
  });
});

// Handle GET requests for medication search
app.get('/medications', (req, res) => {
  // Get the search query from the request parameters
  const searchTerm = req.query.search;

  // If there's no search term, fetch all medications
  if (!searchTerm) {
    db.query('SELECT * FROM Medications', (error, results) => {
      if (error) {
        console.error('Error fetching medications:', error);
        res.status(500).send('Internal Server Error');
        return;
      }
      // Render the medicine.hbs template and pass medications data to it
      res.render('medicine', { medications: results });
    });
  } else {
    // If there's a search term, perform a search query
    const searchQuery = '%' + searchTerm + '%';
    const query = 'SELECT * FROM Medications WHERE name LIKE ?';
    db.query(query, [searchQuery], (error, results) => {
      if (error) {
        console.error('Error searching medications:', error);
        res.status(500).send('Internal Server Error');
        return;
      }
      // Render the medicine.hbs template and pass medications data to it
      res.render('medicine', { medications: results, searchTerm });
    });
  }
});

// Handle POST requests to add a new medication
app.post('/medications/add', (req, res) => {
  const { name, description, expiry_date, price, quantity } = req.body;

  // Insert new medicine into MySQL
  db.query(
    'INSERT INTO Medications (name, description, expiry_date, Price, quantity) VALUES (?, ?, ?, ?, ?)',
    [name, description, expiry_date, price, quantity],
    (err, result) => {
      if (err) {
        console.error('Error executing MySQL query:', err);
        res.status(500).send('Error inserting data into database');
        return;
      }
      console.log('New medicine added successfully:', result); // Log successful insertion
      res.redirect('/medications'); // Redirect to medications page after successful submission
    }
  );
});
app.get('/bills', (req, res) => {
    res.render('bills', { title: 'Billing' });
});
app.use(express.static(path.join(__dirname, 'public')));

app.get('/bills/medication', (req, res) => {
    // Get the search query from the request parameters
    const searchTerm = req.query.search;

    // If there's no search term, fetch all medications
    if (!searchTerm) {
        db.query('SELECT * FROM Medications', (error, results) => {
            if (error) {
                console.error('Error fetching medications:', error);
                res.status(500).send('Internal Server Error');
                return;
            }
            // Render the medicine.hbs template and pass medications data to it
            res.render('bills', { medications: results });
        });
    } else {
        // If there's a search term, perform a search query
        const searchQuery = '%' + searchTerm + '%';
        const query = 'SELECT * FROM Medications WHERE name LIKE ?';
        db.query(query, [searchQuery], (error, results) => {
            if (error) {
                console.error('Error searching medications:', error);
                res.status(500).send('Internal Server Error');
                return;
            }
            // Render the medicine.hbs template and pass medications data to it
            res.render('bills', { medications: results, searchTerm });
        });
    }
});

// Handle POST requests to add a new customer
// Handle POST requests to add a new customer
app.post('/customers/add', (req, res) => {
    const { name, email, phone, address } = req.body;

    // Check if the name field is empty
    if (!name) {
        return res.status(400).send('Name field cannot be empty');
    }

    // Insert new customer into MySQL
    db.query(
        'INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)',
        [name, email, phone, address],
        (err, result) => {
            if (err) {
                console.error('Error executing MySQL query:', err);
                return res.status(500).send('Error adding customer. Please try again.');
            }
            console.log('New customer added successfully:', result); // Log successful insertion
            res.redirect('/customer-record'); // Redirect to customer record page after successful submission
        }
    );
});

// Serve the sales report page
app.get('/salesreport', (req, res) => {
  res.render('salesReport', { title: 'Sales Report' });
});

// Route to fetch yearly sales report with average sale per month
// Route to fetch yearly sales report with average sale per month
app.get('/yearly-sales-report', (req, res) => {
    const year = req.query.year;
    const query = `SELECT MONTH(sales_date) AS month, SUM(amount) AS totalSales 
                   FROM sales 
                   WHERE YEAR(sales_date) = ?
                   GROUP BY MONTH(sales_date)`;

    db.query(query, [year], (err, results) => {
        if (err) {
            console.error('Error fetching yearly sales report:', err);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
        if (results.length === 0) {
            res.status(404).json({ error: 'No data found for the specified year' });
            return;
        }

        // Calculate total sales for the year
        const totalSales = results.reduce((acc, curr) => acc + curr.totalSales, 0);
        // Calculate the number of months with sales data
        const numMonths = results.length;
        // Calculate average sale per month
        const averageSalePerMonth = totalSales / numMonths;

        // Fetch sales data for the year
        const salesQuery = `SELECT sales_date, amount FROM sales WHERE YEAR(sales_date) = ?`;
        db.query(salesQuery, [year], (err, salesResults) => {
            if (err) {
                console.error('Error fetching yearly sales data:', err);
                res.status(500).json({ error: 'Internal server error' });
                return;
            }

            res.json({
                totalSales: totalSales,
                averageSalePerMonth: averageSalePerMonth,
                salesData: salesResults // Include sales data in the response
            });
        });
    });
});

// Route to fetch monthly sales report
app.get('/monthly-sales-report', (req, res) => {
    const year = req.query.year;
    const month = req.query.month;
    const query = `SELECT SUM(amount) AS totalSales, AVG(amount) AS averageSalePerDay 
                 FROM sales 
                 WHERE YEAR(sales_date) = ? AND MONTH(sales_date) = ?`;

    db.query(query, [year, month], (err, results) => {
        if (err) {
            console.error('Error fetching monthly sales report:', err);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
        if (results.length === 0 || results[0].totalSales === null) {
            res.status(404).json({ error: 'No data found for the specified year and month' });
            return;
        }

        // Fetch sales data for the specified month
        const salesQuery = `SELECT sales_date, amount FROM sales WHERE YEAR(sales_date) = ? AND MONTH(sales_date) = ?`;
        db.query(salesQuery, [year, month], (err, salesResults) => {
            if (err) {
                console.error('Error fetching monthly sales data:', err);
                res.status(500).json({ error: 'Internal server error' });
                return;
            }

            res.json({
                totalSales: results[0].totalSales,
                averageSalePerDay: results[0].averageSalePerDay,
                salesData: salesResults // Include sales data in the response
            });
        });
    });
});


// Handle POST requests to process and save the bill
app.post('/process-bill', (req, res) => {
    const { selectedMedicines } = req.body;
    
    const billDate = new Date(); // Get current date and time

    // Calculate subtotal for each medication and update total price
let totalPrice = 0;
selectedMedicines.forEach(medicine => {
    medicine.subtotal = medicine.price * medicine.quantity;
    totalPrice += medicine.subtotal;
});

    // Save bill information to the bills table
    db.query(
        'INSERT INTO bills (total_amount, bill_date) VALUES (?, ?)', // Insert bill_date
        [totalPrice, billDate],
        (err, result) => {
            if (err) {
                console.error('Error executing MySQL query:', err);
                res.status(500).send('Error processing the bill. Please try again later.'); // Updated response
                return;
            }

            const billId = result.insertId; // Get the ID of the inserted bill
            let successCount = 0;

            // Save selected medicines to the bill_details table
            selectedMedicines.forEach(medicine => {
                db.query(
                    'INSERT INTO bill_details (medication_id, quantity, subtotal) VALUES (?, ?, ?)',
                    [medicine.medication_id, medicine.quantity, medicine.subtotal],
                    (err, result) => {
                        if (err) {
                            console.error('Error executing MySQL query:', err);
                            res.status(500).send('Error processing the bill. Please try again later.'); // Updated response
                            return;
                        }

                        successCount++;

                        if (successCount === selectedMedicines.length) {
                            console.log('All bill details processed and saved successfully');
                            res.status(200).send('Bill processed and saved successfully'); // Updated response
                        }
                    }
                );
            });
        }
    );
});






// Handle GET request to fetch medication details by ID
app.get('/medications/:medicationId', (req, res) => {
    const medicationId = req.params.medicationId;

    // Query the database to fetch medication details by ID
    db.query('SELECT * FROM Medications WHERE medication_id = ?', [medicationId], (error, results) => {
        if (error) {
            console.error('Error fetching medication details:', error);
            res.status(500).send('Internal Server Error');
            return;
        }
        if (results.length === 0) {
            console.error('Medication not found');
            res.status(404).send('Medication not found');
            return;
        }
        const medication = results[0];
        res.json(medication); // Send JSON response with medication details
    });
});


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
