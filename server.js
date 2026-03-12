require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
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

/* GET MY AGENT */
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

    const existingAgent = await pool.query(
      "SELECT * FROM public.agents WHERE employee_id=$1 OR email=$2 LIMIT 1",
      [employee_id, email]
    );

    if (existingAgent.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Agent already exists"
      });
    }

    const existingUser = await pool.query(
      "SELECT * FROM public.users WHERE username=$1 LIMIT 1",
      [employee_id]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Username already exists"
      });
    }

    const agentResult = await pool.query(
      `INSERT INTO public.agents
       (employee_id, name, email, phone, password, shift)
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

/* CREDIT CARD LEAD SUBMIT - DAY SHIFT */
app.post("/sales", async (req, res) => {
  try {
    const {
      agent_id,
      arn,
      product_applied,
      full_name_pan,
      mobile_number,
      alternate_number,
      email_id,
      date_of_birth,
      gender,
      current_address,
      city,
      state,
      pincode,
      residence_type,
      company_name,
      job_designation,
      monthly_in_hand_salary,
      salary_account_bank,
      total_work_experience,
      current_company,
      working_since,
      already_have_credit_card,
      existing_card_bank_name,
      credit_limit_approx,
      card_vintage,
      first_credit_card_application,
      any_active_loan,
      emi_amount_approx,
      salary_credit_regular,
      pan_available,
      aadhaar_available,
      office_id_available,
      customer_consent_taken,
      application_date,
      customer_declaration,
      amount_balance_20
    } = req.body;

    if (
      !agent_id ||
      !product_applied ||
      !full_name_pan ||
      !mobile_number ||
      !city ||
      !state ||
      !pincode
    ) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing"
      });
    }

    const result = await pool.query(
      `INSERT INTO public.credit_card_leads (
        agent_id,
        arn,
        product_applied,
        full_name_pan,
        mobile_number,
        alternate_number,
        email_id,
        date_of_birth,
        gender,
        current_address,
        city,
        state,
        pincode,
        residence_type,
        company_name,
        job_designation,
        monthly_in_hand_salary,
        salary_account_bank,
        total_work_experience,
        current_company,
        working_since,
        already_have_credit_card,
        existing_card_bank_name,
        credit_limit_approx,
        card_vintage,
        first_credit_card_application,
        any_active_loan,
        emi_amount_approx,
        salary_credit_regular,
        pan_available,
        aadhaar_available,
        office_id_available,
        customer_consent_taken,
        application_date,
        customer_declaration,
        amount_balance_20,
        status
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
        $31,$32,$33,$34,$35,$36,'pending'
      ) RETURNING *`,
      [
        agent_id,
        arn || null,
        product_applied || null,
        full_name_pan || null,
        mobile_number || null,
        alternate_number || null,
        email_id || null,
        date_of_birth || null,
        gender || null,
        current_address || null,
        city || null,
        state || null,
        pincode || null,
        residence_type || null,
        company_name || null,
        job_designation || null,
        monthly_in_hand_salary || null,
        salary_account_bank || null,
        total_work_experience || null,
        current_company || null,
        working_since || null,
        already_have_credit_card || null,
        existing_card_bank_name || null,
        credit_limit_approx || null,
        card_vintage || null,
        first_credit_card_application || null,
        any_active_loan || null,
        emi_amount_approx || null,
        salary_credit_regular || null,
        pan_available || null,
        aadhaar_available || null,
        office_id_available || null,
        customer_consent_taken || null,
        application_date || null,
        customer_declaration || null,
        amount_balance_20 || null
      ]
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

/* ADMIN GET ALL CREDIT CARD LEADS */
app.get("/sales", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.*,
        a.name AS agent_name,
        a.employee_id,
        a.shift
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

/* AGENT GET MY CREDIT CARD LEADS */
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

/* ADMIN UPDATE CREDIT CARD LEAD STATUS */
app.put("/sale-status/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["pending", "in process", "approved", "rejected"];

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

/* DELETE CREDIT CARD LEAD */
app.delete("/sales/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM public.credit_card_leads WHERE id=$1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Lead not found"
      });
    }

    return res.json({
      success: true,
      message: "Lead deleted successfully"
    });
  } catch (error) {
    console.log("DELETE SALE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Delete lead failed"
    });
  }
});

/* DELETE AUTOPARTS ORDER */
app.delete("/autoparts-orders/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM public.autoparts_orders WHERE id=$1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    return res.json({
      success: true,
      message: "Order deleted successfully"
    });
  } catch (error) {
    console.log("DELETE AUTOPARTS ORDER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Delete order failed"
    });
  }
});

/* ADMIN UPDATE CREDIT CARD LEAD EXTRA FIELDS */
app.put("/sales-admin-update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { call_recording, quality_feedback } = req.body;

    const result = await pool.query(
      `UPDATE public.credit_card_leads
       SET call_recording=$1, quality_feedback=$2
       WHERE id=$3
       RETURNING *`,
      [call_recording || null, quality_feedback || null, id]
    );

    return res.json({
      success: true,
      sale: result.rows[0]
    });
  } catch (error) {
    console.log("SALES ADMIN UPDATE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Admin update failed"
    });
  }
});

/* AUTOPARTS ORDER SUBMIT - NIGHT SHIFT */
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
        actual_part_price,
        commission_amount,
        discount_applied || null,
        total_amount,
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
      message: "Order submit failed"
    });
  }
});

/* ADMIN GET ALL AUTOPARTS ORDERS */
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

/* AGENT GET MY AUTOPARTS ORDERS */
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

/* ADMIN UPDATE AUTOPARTS ORDER STATUS */
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

/* ATTENDANCE CHECK-IN */
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

/* ATTENDANCE CHECK-OUT */
app.post("/attendance/check-out", async (req, res) => {
  try {
    const { agent_id } = req.body;

    const existing = await pool.query(
      "SELECT * FROM public.attendance WHERE agent_id=$1 AND attendance_date=CURRENT_DATE LIMIT 1",
      [agent_id]
    );

    if (existing.rows.length === 0) {
      return res.json({
        success: false,
        message: "No check-in found for today"
      });
    }

    const attendanceRow = existing.rows[0];

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

/* ADMIN GET ATTENDANCE */
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
    const values = [];

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

/* AGENT GET OWN ATTENDANCE */
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
    const values = [agentId];

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

/* GET TODAY ATTENDANCE FOR TIMER */
app.get("/attendance/today/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;

    const result = await pool.query(
      "SELECT * FROM public.attendance WHERE agent_id=$1 AND attendance_date=CURRENT_DATE LIMIT 1",
      [agentId]
    );

    return res.json({
      success: true,
      attendance: result.rows[0] || null
    });
  } catch (error) {
    console.log("TODAY ATTENDANCE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Fetch today attendance failed"
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

/* ADMIN GET LEAVES */
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

/* AGENT GET OWN LEAVES */
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

/* ADMIN UPDATE LEAVE STATUS */
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

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});