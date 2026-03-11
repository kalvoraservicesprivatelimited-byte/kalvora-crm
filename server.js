require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect()
  .then(() => console.log("PostgreSQL Connected"))
  .catch((err) => console.log("DB Error:", err));

/* LOGIN */
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM public.users WHERE username=$1 AND password=$2 LIMIT 1",
      [username, password]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: "Invalid login"
      });
    }

    return res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.log("LOGIN ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/* GET AGENT BY USERNAME / EMPLOYEE ID */
app.get("/my-agent/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const result = await pool.query(
      "SELECT * FROM public.agents WHERE employee_id=$1 LIMIT 1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: "Agent not found"
      });
    }

    return res.json({
      success: true,
      agent: result.rows[0]
    });
  } catch (error) {
    console.log("MY AGENT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Fetch my agent failed"
    });
  }
});

/* GET ALL AGENTS */
app.get("/agents", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM public.agents ORDER BY id ASC"
    );

    return res.json({
      success: true,
      agents: result.rows
    });
  } catch (error) {
    console.log("GET AGENTS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Fetch agents failed"
    });
  }
});

/* CREATE AGENT */
app.post("/create-agent", async (req, res) => {
  try {
    const { employee_id, name, email, phone, password, shift } = req.body;

    if (!employee_id || !name || !email || !phone || !password || !shift) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const exists = await pool.query(
      "SELECT * FROM public.agents WHERE employee_id=$1 OR email=$2 LIMIT 1",
      [employee_id, email]
    );

    if (exists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Agent already exists"
      });
    }

    const agentResult = await pool.query(
      `INSERT INTO public.agents (employee_id, name, email, phone, password, shift)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [employee_id, name, email, phone, password, shift]
    );

    await pool.query(
      `INSERT INTO public.users (username, password, role)
       VALUES ($1,$2,'agent')`,
      [employee_id, password]
    );

    return res.json({
      success: true,
      agent: agentResult.rows[0]
    });
  } catch (error) {
    console.log("CREATE AGENT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Create agent failed"
    });
  }
});

/* CREDIT CARD LEAD SUBMIT */
app.post("/sales", async (req, res) => {
  try {
    const { agent_id, name, phone, city, bank } = req.body;

    if (!agent_id || !name || !phone || !city || !bank) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const result = await pool.query(
      `INSERT INTO public.credit_card_leads
       (agent_id, name, phone, city, bank, status)
       VALUES ($1,$2,$3,$4,$5,'pending')
       RETURNING *`,
      [agent_id, name, phone, city, bank]
    );

    return res.json({
      success: true,
      sale: result.rows[0]
    });
  } catch (error) {
    console.log("CREATE SALE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Lead submit failed"
    });
  }
});

/* AUTOPARTS ORDER SUBMIT */
app.post("/autoparts-orders", async (req, res) => {
  try {
    const {
      agent_id,
      customer_name,
      customer_contact_number,
      customer_email_id,
      address,
      city,
      state,
      zipcode,
      billing_address,
      type_of_customer,
      product_link,
      part_name,
      car_make_in_year,
      brand_name,
      actual_part_price,
      commission_amount,
      discount_applied,
      total_amount,
      order_type,
      payment_mode,
      card_number,
      cvv,
      exp,
      card_holder_name
    } = req.body;

    if (
      !agent_id ||
      !customer_name ||
      !customer_contact_number ||
      !address ||
      !city ||
      !state ||
      !zipcode ||
      !billing_address ||
      !type_of_customer ||
      !product_link ||
      !part_name ||
      !car_make_in_year ||
      !brand_name ||
      !actual_part_price ||
      !commission_amount ||
      !total_amount ||
      !order_type ||
      !payment_mode
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields are required"
      });
    }

    const result = await pool.query(
      `INSERT INTO public.autoparts_orders (
        agent_id,
        customer_name,
        customer_contact_number,
        customer_email_id,
        address,
        city,
        state,
        zipcode,
        billing_address,
        type_of_customer,
        product_link,
        part_name,
        car_make_in_year,
        brand_name,
        actual_part_price,
        commission_amount,
        discount_applied,
        total_amount,
        order_type,
        payment_mode,
        card_number,
        cvv,
        exp,
        card_holder_name
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24
      ) RETURNING *`,
      [
        agent_id,
        customer_name,
        customer_contact_number,
        customer_email_id || null,
        address,
        city,
        state,
        zipcode,
        billing_address,
        type_of_customer,
        product_link,
        part_name,
        car_make_in_year,
        brand_name,
        actual_part_price,
        commission_amount,
        discount_applied || 0,
        total_amount,
        order_type,
        payment_mode,
        card_number || null,
        cvv || null,
        exp || null,
        card_holder_name || null
      ]
    );

    return res.json({
      success: true,
      order: result.rows[0]
    });
  } catch (error) {
    console.log("AUTOPARTS ORDER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Autoparts order submit failed"
    });
  }
});

/* GET ALL LEADS FOR ADMIN */
app.get("/sales", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.agent_id,
        a.name AS agent_name,
        a.employee_id,
        a.shift,
        c.name AS customer_name,
        c.phone,
        c.city,
        c.bank,
        c.status,
        c.created_at
      FROM public.credit_card_leads c
      LEFT JOIN public.agents a ON c.agent_id = a.id
      ORDER BY c.id DESC
    `);

    return res.json({
      success: true,
      sales: result.rows
    });
  } catch (error) {
    console.log("GET SALES ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Fetch sales failed"
    });
  }
});

/* GET MY CREDIT CARD LEADS */
app.get("/my-sales/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;

    const result = await pool.query(
      "SELECT * FROM public.credit_card_leads WHERE agent_id=$1 ORDER BY id DESC",
      [agentId]
    );

    return res.json({
      success: true,
      sales: result.rows
    });
  } catch (error) {
    console.log("MY SALES ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Fetch my sales failed"
    });
  }
});

/* GET MY AUTOPARTS ORDERS */
app.get("/my-autoparts-orders/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;

    const result = await pool.query(
      "SELECT * FROM public.autoparts_orders WHERE agent_id=$1 ORDER BY id DESC",
      [agentId]
    );

    return res.json({
      success: true,
      orders: result.rows
    });
  } catch (error) {
    console.log("MY AUTOPARTS ORDERS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Fetch my autoparts orders failed"
    });
  }
});

/* CHECK-IN */
app.post("/attendance/check-in", async (req, res) => {
  try {
    const { agent_id } = req.body;

    const existing = await pool.query(
      "SELECT * FROM public.attendance WHERE agent_id=$1 AND attendance_date=CURRENT_DATE LIMIT 1",
      [agent_id]
    );

    if (existing.rows.length > 0) {
      return res.json({
        success: false,
        message: "Already checked in today"
      });
    }

    const result = await pool.query(
      `INSERT INTO public.attendance
       (agent_id, attendance_date, check_in, status)
       VALUES ($1, CURRENT_DATE, NOW(), 'present')
       RETURNING *`,
      [agent_id]
    );

    return res.json({
      success: true,
      message: "Checked In",
      attendance: result.rows[0]
    });
  } catch (error) {
    console.log("CHECK-IN ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Check-in failed"
    });
  }
});

/* CHECK-OUT */
app.post("/attendance/check-out", async (req, res) => {
  try {
    const { agent_id } = req.body;

    const result = await pool.query(
      `UPDATE public.attendance
       SET check_out=NOW()
       WHERE agent_id=$1 AND attendance_date=CURRENT_DATE
       RETURNING *`,
      [agent_id]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: "No check-in found for today"
      });
    }

    return res.json({
      success: true,
      message: "Checked Out",
      attendance: result.rows[0]
    });
  } catch (error) {
    console.log("CHECK-OUT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Check-out failed"
    });
  }
});

/* MY ATTENDANCE */
app.get("/my-attendance/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;

    const result = await pool.query(
      "SELECT * FROM public.attendance WHERE agent_id=$1 ORDER BY id DESC",
      [agentId]
    );

    return res.json({
      success: true,
      attendance: result.rows
    });
  } catch (error) {
    console.log("MY ATTENDANCE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Fetch my attendance failed"
    });
  }
});

/* MY TARGET */
app.get("/my-target/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;

    const result = await pool.query(
      "SELECT * FROM public.targets WHERE agent_id=$1 ORDER BY id DESC LIMIT 1",
      [agentId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: "No target assigned"
      });
    }

    return res.json({
      success: true,
      target: result.rows[0]
    });
  } catch (error) {
    console.log("MY TARGET ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Fetch target failed"
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});