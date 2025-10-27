const express = require('express');
const mongoose = require('mongoose');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://disecaror27-planificador-de-tareas.vercel.app',
    'https://disecaror27-planificador-de-tareas-git-*.vercel.app',
    'https://disecaror27-planificador-de-tareas-*.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => console.error('❌ Error MongoDB:', err));

const pgPool = new Pool({
  connectionString: process.env.POSTGRES_URI,
  ssl: {
    rejectUnauthorized: false
  }
});

pgPool.on('error', (err, client) => {
  console.error('❌ Error in PostgreSQL pool:', err.message);
});

pgPool.connect()
  .then(() => {
    console.log('✅ Conectado a PostgreSQL');
    return pgPool.query(`
      CREATE TABLE IF NOT EXISTS task_metadata (
        id SERIAL PRIMARY KEY,
        task_id VARCHAR(255) UNIQUE NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        priority VARCHAR(50) DEFAULT 'media',
        category VARCHAR(100) DEFAULT 'general',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  })
  .then(() => console.log('✅ Tabla PostgreSQL creada/verificada'))
  .catch(err => console.error('❌ Error PostgreSQL:', err.message));

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  status: { type: String, default: 'pendiente' },
  priority: { type: String, default: 'media' },
  userId: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Task = mongoose.model('Task', taskSchema);

const auth = require('./middleware/auth');

app.get('/api/health', async (req, res) => {
  try {
    let postgresStatus = '❌ Error';
    try {
      const client = await pgPool.connect();
      postgresStatus = '✅ Conectado';
      client.release();
    } catch (pgError) {
      postgresStatus = '❌ Error';
    }
    
    res.json({ 
      status: '✅ Online', 
      databases: {
        mongodb: mongoose.connection.readyState === 1 ? '✅ Conectado' : '❌ Error',
        postgresql: postgresStatus
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tasks', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user._id }).sort({ createdAt: -1 });
    
    let metadataResult = { rows: [] };
    try {
      metadataResult = await pgPool.query('SELECT * FROM task_metadata WHERE user_id = $1', [req.user._id.toString()]);
    } catch (pgError) {
      console.error('❌ Error obteniendo metadata:', pgError.message);
    }
    
    const tasksWithMetadata = tasks.map(task => {
      const meta = metadataResult.rows.find(m => m.task_id === task._id.toString());
      return {
        ...task.toObject(),
        metadata: meta || {}
      };
    });
    
    res.json(tasksWithMetadata);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks', auth, async (req, res) => {
  try {
    const { title, description, priority } = req.body;
    
    const task = new Task({
      title,
      description,
      priority,
      userId: req.user._id
    });
    
    await task.save();
    
    try {
      await pgPool.query(
        'INSERT INTO task_metadata (task_id, user_id, priority, category) VALUES ($1, $2, $3, $4)',
        [task._id.toString(), req.user._id.toString(), priority, 'general']
      );
    } catch (pgError) {
      console.error('❌ Error guardando metadata:', pgError.message);
    }
    
    res.status(201).json({
      message: '✅ Tarea creada exitosamente',
      task
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status, updatedAt: new Date() },
      { new: true }
    );
    
    if (!task) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', auth, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user._id 
    });
    
    if (!task) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    
    try {
      await pgPool.query(
        'DELETE FROM task_metadata WHERE task_id = $1 AND user_id = $2',
        [req.params.id, req.user._id.toString()]
      );
    } catch (pgError) {
      console.error('❌ Error eliminando metadata:', pgError.message);
    }
    
    res.json({ message: '🗑️ Tarea eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', auth, async (req, res) => {
  try {
    const totalTasks = await Task.countDocuments({ userId: req.user._id });
    const completedTasks = await Task.countDocuments({ 
      userId: req.user._id, 
      status: 'completada' 
    });
    const pendingTasks = await Task.countDocuments({ 
      userId: req.user._id, 
      status: 'pendiente' 
    });
    
    let pgStats = { rows: [] };
    try {
      pgStats = await pgPool.query(
        'SELECT COUNT(*) as total, priority FROM task_metadata WHERE user_id = $1 GROUP BY priority',
        [req.user._id.toString()]
      );
    } catch (pgError) {
      console.error('❌ Error obteniendo stats PostgreSQL:', pgError.message);
    }
    
    res.json({
      mongoStats: {
        total: totalTasks,
        completed: completedTasks,
        pending: pendingTasks
      },
      postgresStats: pgStats.rows,
      message: '📊 Estadísticas de ambas bases de datos'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📚 API disponible en: http://localhost:${PORT}/api`);
  console.log(`🔐 Rutas de autenticación en: http://localhost:${PORT}/api/auth`);
});

process.on('SIGTERM', () => {
  console.log('🔄 Recibió SIGTERM, cerrando gracefully...');
  process.exit(0);
});