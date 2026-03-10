require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.use(express.static(path.join(__dirname, "public")));

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
      "SELECT * FROM users WHERE username=$1 AND password=$2",
      [username, password]
    );

    if (result.rows.length > 0) {
      res.json({
        success: true,
        user: result.rows[0]
      });
    } else {
      res.json({
        success: false,
        message: "Invalid login"
      });
    }
  } catch (err) {
    console.log("Login Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});
/* GET AGENT PROFILE BY EMAIL */
app.get("/agent-by-email/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);

    const result = await pool.query(
      "SELECT * FROM public.agents WHERE email=$1 LIMIT 1",
      [email]
    );

    if (result.rows.length > 0) {
      res.json({
        success: true,
        agent: result.rows[0]
      });
    } else {
      res.json({
        success: false,
        message: "Agent not found"
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Fetch agent failed" });
  }
});

/* CREATE AGENT */
app.post("/agents", async (req, res) => {
  try {
    const { employee_id, name, email, phone, shift, password } = req.body;

    const existingUser = await pool.query(
      "SELECT * FROM public.users WHERE email=$1 OR employee_id=$2",
      [email, employee_id]
    );

    const existingAgent = await pool.query(
      "SELECT * FROM public.agents WHERE email=$1 OR employee_id=$2",
      [email, employee_id]
    );

    if (existingUser.rows.length > 0 || existingAgent.rows.length > 0) {
      return res.json({
        success: false,
        message: "Email or Employee ID already exists"
      });
    }

    const agentResult = await pool.query(
      "INSERT INTO public.agents (employee_id, name, email, phone, shift) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [employee_id, name, email, phone, shift]
    );

    await pool.query(
      "INSERT INTO public.users (employee_id, name, email, password, role) VALUES ($1,$2,$3,$4,$5)",
      [employee_id, name, email, password, "agent"]
    );

    res.json({
      success: true,
      agent: agentResult.rows[0]
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Create agent failed" });
  }
});

/* GET ALL AGENTS */
app.get("/agents", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM public.agents ORDER BY id ASC"
    );

    res.json({
      success: true,
      agents: result.rows
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Fetch agents failed" });
  }
});

/* AGENT SUBMIT LEAD - DEFAULT STATUS PENDING */
app.post("/sales", async (req, res) => {
  try {
    const { agent_id, name, phone, city, bank } = req.body;

    const result = await pool.query(
      "INSERT INTO public.credit_card_leads (agent_id, name, phone, city, bank, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [agent_id, name, phone, city, bank, "pending"]
    );

    res.json({
      success: true,
      sale: result.rows[0]
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Create sale failed" });
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

    res.json({
      success: true,
      sales: result.rows
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Fetch sales failed" });
  }
});

/* GET MY LEADS FOR AGENT */
app.get("/my-sales/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;

    const result = await pool.query(
      "SELECT * FROM public.credit_card_leads WHERE agent_id=$1 ORDER BY id DESC",
      [agentId]
    );

    res.json({
      success: true,
      sales: result.rows
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Fetch my sales failed" });
  }
});

/* ADMIN UPDATE STATUS - ONLY PENDING/APPROVED/REJECTED */
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

    res.json({
      success: true,
      sale: result.rows[0]
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Update status failed" });
  }
});

/* ALL ATTENDANCE */
app.get("/attendance", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        at.id,
        at.agent_id,
        a.name AS agent_name,
        a.employee_id,
        at.attendance_date,
        at.check_in,
        at.check_out,
        at.status,
        at.created_at
      FROM public.attendance at
      LEFT JOIN public.agents a ON at.agent_id = a.id
      ORDER BY at.id DESC
    `);

    res.json({
      success: true,
      attendance: result.rows
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Fetch attendance failed" });
  }
});

/* CHECK-IN */
app.post("/attendance/check-in", async (req, res) => {
  try {
    const { agent_id } = req.body;

    const existing = await pool.query(
      "SELECT * FROM public.attendance WHERE agent_id=$1 AND attendance_date=CURRENT_DATE",
      [agent_id]
    );

    if (existing.rows.length > 0) {
      return res.json({
        success: false,
        message: "Already checked in today"
      });
    }

    const result = await pool.query(
      "INSERT INTO public.attendance (agent_id, attendance_date, check_in, status) VALUES ($1,CURRENT_DATE,NOW(),'present') RETURNING *",
      [agent_id]
    );

    res.json({
      success: true,
      attendance: result.rows[0]
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Check-in failed" });
  }
});

/* CHECK-OUT */
app.post("/attendance/check-out", async (req, res) => {
  try {
    const { agent_id } = req.body;

    const result = await pool.query(
      "UPDATE public.attendance SET check_out=NOW() WHERE agent_id=$1 AND attendance_date=CURRENT_DATE RETURNING *",
      [agent_id]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: "No check-in found for today"
      });
    }

    res.json({
      success: true,
      attendance: result.rows[0]
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Check-out failed" });
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

    res.json({
      success: true,
      attendance: result.rows
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Fetch my attendance failed" });
  }
});

/* APPLY LEAVE */
app.post("/leave/apply", async (req, res) => {
  try {
    const { agent_id, leave_type, start_date, end_date, reason } = req.body;

    const result = await pool.query(
      "INSERT INTO public.leave_requests (agent_id, leave_type, start_date, end_date, reason, status) VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *",
      [agent_id, leave_type, start_date, end_date, reason]
    );

    res.json({
      success: true,
      leave: result.rows[0]
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Leave apply failed" });
  }
});

/* ALL LEAVES */
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

    res.json({
      success: true,
      leaves: result.rows
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Fetch leaves failed" });
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

    res.json({
      success: true,
      leaves: result.rows
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Fetch my leaves failed" });
  }
});

/* UPDATE LEAVE STATUS */
app.put("/leave-status/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      "UPDATE public.leave_requests SET status=$1 WHERE id=$2 RETURNING *",
      [status, id]
    );

    res.json({
      success: true,
      leave: result.rows[0]
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Leave status update failed" });
  }
});

/* CREATE OR UPDATE TARGET */
app.post("/targets", async (req, res) => {
  try {
    const { agent_id, shift, target_type, target_value, month_name } = req.body;

    const existing = await pool.query(
      "SELECT * FROM public.targets WHERE agent_id=$1 AND month_name=$2",
      [agent_id, month_name]
    );

    if (existing.rows.length > 0) {
      const updated = await pool.query(
        "UPDATE public.targets SET shift=$1, target_type=$2, target_value=$3 WHERE agent_id=$4 AND month_name=$5 RETURNING *",
        [shift, target_type, target_value, agent_id, month_name]
      );

      return res.json({
        success: true,
        target: updated.rows[0]
      });
    }

    const result = await pool.query(
      "INSERT INTO public.targets (agent_id, shift, target_type, target_value, month_name) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [agent_id, shift, target_type, target_value, month_name]
    );

    res.json({
      success: true,
      target: result.rows[0]
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Target save failed" });
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

    res.json({
      success: true,
      targets: result.rows
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Fetch targets failed" });
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

    res.json({
      success: true,
      target: result.rows[0]
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Fetch target failed" });
  }
});

/* UPDATE ACHIEVED TARGET */
app.put("/targets/achieved/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const { achieved_value } = req.body;

    const result = await pool.query(
      "UPDATE public.targets SET achieved_value=$1 WHERE agent_id=$2 RETURNING *",
      [achieved_value, agentId]
    );

    res.json({
      success: true,
      target: result.rows[0]
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Update achieved target failed" });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});