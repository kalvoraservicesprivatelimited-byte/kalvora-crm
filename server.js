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

/* GET ALL CREDIT CARD LEADS FOR ADMIN */
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

/* UPDATE CREDIT CARD SALE STATUS */
app.put("/sale-status/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["pending", "approved", "rejected"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    const result = await pool.query(
      "UPDATE public.credit_card_leads SET status=$1 WHERE id=$2 RETURNING *",
      [status, id]
    );

    return res.json({
      success: true,
      sale: result.rows[0]
    });
  } catch (error) {
    console.log("SALE STATUS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Update status failed"
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
      payment_link,
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

    if (payment_mode === "Credit / Debit Card") {
      if (!card_number || !cvv || !exp || !card_holder_name) {
        return res.status(400).json({
          success: false,
          message: "Card details are required"
        });
      }
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
        payment_link,
        card_number,
        cvv,
        exp,
        card_holder_name,
        status
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,'pending'
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
        Number(actual_part_price),
        Number(commission_amount),
        discount_applied ? Number(discount_applied) : 0,
        Number(total_amount),
        order_type,
        payment_mode,
        payment_link || null,
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

/* GET ALL AUTOPARTS ORDERS FOR ADMIN */
app.get("/autoparts-orders", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        o.*,
        a.name AS agent_name,
        a.employee_id,
        a.shift
      FROM public.autoparts_orders o
      LEFT JOIN public.agents a ON o.agent_id = a.id
      ORDER BY o.id DESC
    `);

    return res.json({
      success: true,
      orders: result.rows
    });
  } catch (error) {
    console.log("GET AUTOPARTS ORDERS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Fetch autoparts orders failed"
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

/* UPDATE AUTOPARTS ORDER STATUS */
app.put("/autoparts-order-status/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["pending", "approved", "rejected"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    const result = await pool.query(
      "UPDATE public.autoparts_orders SET status=$1 WHERE id=$2 RETURNING *",
      [status, id]
    );

    return res.json({
      success: true,
      order: result.rows[0]
    });
  } catch (error) {
    console.log("AUTOPARTS STATUS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Update autoparts status failed"
    });
  }
});

/* CHECK-IN FOR ALL AGENTS */
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
       (agent_id, attendance_date, check_in, status, total_login_seconds)
       VALUES ($1, CURRENT_DATE, NOW(), 'present', 0)
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

/* CHECK-OUT FOR ALL AGENTS */
app.post("/attendance/check-out", async (req, res) => {
  try {
    const { agent_id } = req.body;

    const existing = await pool.query(
      `SELECT * FROM public.attendance
       WHERE agent_id=$1 AND attendance_date=CURRENT_DATE
       LIMIT 1`,
      [agent_id]
    );

    if (existing.rows.length === 0) {
      return res.json({
        success: false,
        message: "No check-in found for today"
      });
    }

    const attendanceRow = existing.rows[0];

    if (!attendanceRow.check_in) {
      return res.json({
        success: false,
        message: "No check-in found for today"
      });
    }

    const result = await pool.query(
      `UPDATE public.attendance
       SET
         check_out = NOW(),
         total_login_seconds = EXTRACT(EPOCH FROM (NOW() - check_in))::INTEGER
       WHERE id=$1
       RETURNING *`,
      [attendanceRow.id]
    );

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

/* ADMIN ATTENDANCE WITH OPTIONAL DATE FILTER */
app.get("/attendance", async (req, res) => {
  try {
    const { date } = req.query;

    let query = `
      SELECT
        at.id,
        at.agent_id,
        a.name AS agent_name,
        a.employee_id,
        a.shift,
        at.attendance_date,
        at.check_in,
        at.check_out,
        at.total_login_seconds,
        at.status,
        at.created_at
      FROM public.attendance at
      LEFT JOIN public.agents a ON at.agent_id = a.id
    `;
    let values = [];

    if (date) {
      query += ` WHERE at.attendance_date = $1 `;
      values.push(date);
    }

    query += ` ORDER BY at.attendance_date DESC, at.id DESC`;

    const result = await pool.query(query, values);

    return res.json({
      success: true,
      attendance: result.rows
    });
  } catch (error) {
    console.log("GET ATTENDANCE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Fetch attendance failed"
    });
  }
});

/* AGENT ATTENDANCE WITH OPTIONAL DATE FILTER */
app.get("/my-attendance/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const { date } = req.query;

    let query = `
      SELECT
        id,
        agent_id,
        attendance_date,
        check_in,
        check_out,
        total_login_seconds,
        status,
        created_at
      FROM public.attendance
      WHERE agent_id=$1
    `;
    let values = [agentId];

    if (date) {
      query += ` AND attendance_date=$2 `;
      values.push(date);
    }

    query += ` ORDER BY attendance_date DESC, id DESC`;

    const result = await pool.query(query, values);

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

/* APPLY LEAVE */
app.post("/leave/apply", async (req, res) => {
  try {
    const { agent_id, leave_type, start_date, end_date, reason } = req.body;

    const result = await pool.query(
      `INSERT INTO public.leave_requests
       (agent_id, leave_type, start_date, end_date, reason, status)
       VALUES ($1,$2,$3,$4,$5,'pending')
       RETURNING *`,
      [agent_id, leave_type, start_date, end_date, reason]
    );

    return res.json({
      success: true,
      leave: result.rows[0]
    });
  } catch (error) {
    console.log("APPLY LEAVE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Leave apply failed"
    });
  }
});

/* ALL LEAVES FOR ADMIN */
app.get("/leave", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        lr.id,
        lr.agent_id,
        a.name AS agent_name,
        a.employee_id,
        lr.leave_type,
        lr.start_date,
        lr.end_date,
        lr.reason,
        lr.status,
        lr.created_at
      FROM public.leave_requests lr
      LEFT JOIN public.agents a ON lr.agent_id = a.id
      ORDER BY lr.id DESC
    `);

    return res.json({
      success: true,
      leaves: result.rows
    });
  } catch (error) {
    console.log("GET LEAVES ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Fetch leaves failed"
    });
  }
});

/* MY LEAVES */
app.get("/my-leave/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;

    const result = await pool.query(
      "SELECT * FROM public.leave_requests WHERE agent_id=$1 ORDER BY id DESC",
      [agentId]
    );

    return res.json({
      success: true,
      leaves: result.rows
    });
  } catch (error) {
    console.log("MY LEAVES ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Fetch my leaves failed"
    });
  }
});

/* UPDATE LEAVE STATUS */
app.put("/leave-status/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["pending", "approved", "rejected"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    const result = await pool.query(
      "UPDATE public.leave_requests SET status=$1 WHERE id=$2 RETURNING *",
      [status, id]
    );

    return res.json({
      success: true,
      leave: result.rows[0]
    });
  } catch (error) {
    console.log("LEAVE STATUS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Leave status update failed"
    });
  }
});

/* CREATE OR UPDATE TARGET */
app.post("/targets", async (req, res) => {
  try {
    const { agent_id, shift, target_type, target_value, month_name } = req.body;

    if (!agent_id || !shift || !target_type || !target_value || !month_name) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const existing = await pool.query(
      "SELECT * FROM public.targets WHERE agent_id=$1 AND month_name=$2 LIMIT 1",
      [agent_id, month_name]
    );

    if (existing.rows.length > 0) {
      const updated = await pool.query(
        `UPDATE public.targets
         SET shift=$1, target_type=$2, target_value=$3
         WHERE agent_id=$4 AND month_name=$5
         RETURNING *`,
        [shift, target_type, Number(target_value), agent_id, month_name]
      );

      return res.json({
        success: true,
        target: updated.rows[0]
      });
    }

    const result = await pool.query(
      `INSERT INTO public.targets
       (agent_id, shift, target_type, target_value, month_name, achieved_value)
       VALUES ($1,$2,$3,$4,$5,0)
       RETURNING *`,
      [agent_id, shift, target_type, Number(target_value), month_name]
    );

    return res.json({
      success: true,
      target: result.rows[0]
    });
  } catch (error) {
    console.log("TARGET SAVE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Target save failed"
    });
  }
});

/* GET ALL TARGETS */
app.get("/targets", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        t.*,
        a.name AS agent_name,
        a.employee_id
      FROM public.targets t
      LEFT JOIN public.agents a ON t.agent_id = a.id
      ORDER BY t.id DESC
    `);

    return res.json({
      success: true,
      targets: result.rows
    });
  } catch (error) {
    console.log("GET TARGETS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Fetch targets failed"
    });
  }
});

/* GET MY TARGET */
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

/* UPDATE ACHIEVED TARGET */
app.put("/targets/achieved/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const { achieved_value } = req.body;

    const result = await pool.query(
      "UPDATE public.targets SET achieved_value=$1 WHERE agent_id=$2 RETURNING *",
      [Number(achieved_value || 0), agentId]
    );

    return res.json({
      success: true,
      target: result.rows[0]
    });
  } catch (error) {
    console.log("TARGET ACHIEVED ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Update achieved target failed"
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});