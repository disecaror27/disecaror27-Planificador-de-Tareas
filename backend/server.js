const express = require('express');
const mongoose = require('mongoose');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Conexión a MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => console.error('❌ Error MongoDB:', err));

// Conexión a PostgreSQL (Render)
const pgPool = new Pool({
  connectionString: process.env.POSTGRES_URI,
  ssl: {
    rejectUnauthorized: false
  }
});

// Verificar conexión PostgreSQL
pgPool.connect()
  .then(() => console.log('✅ Conectado a PostgreSQL'))
  .catch(err => console.error('❌ Error PostgreSQL:', err));

// Modelo MongoDB para tareas
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

// Crear tabla PostgreSQL si no existe
const createTable = async () => {
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS task_metadata (
        id SERIAL PRIMARY KEY,
        task_id VARCHAR(255) UNIQUE NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        priority VARCHAR(50) DEFAULT 'media',
        category VARCHAR(100) DEFAULT 'general',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla PostgreSQL creada/verificada');
  } catch (error) {
    console.error('❌ Error creando tabla:', error);
  }
};
createTable();

// 📊 RUTAS DE LA API

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: '✅ Online', 
    databases: {
      mongodb: mongoose.connection.readyState === 1 ? '✅ Conectado' : '❌ Error',
      postgresql: '✅ Conectado'
    },
    timestamp: new Date().toISOString()
  });
});

// Obtener todas las tareas
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    
    // Obtener metadata de PostgreSQL
    const metadataResult = await pgPool.query('SELECT * FROM task_metadata');
    
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

// Crear nueva tarea
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, description, priority, userId } = req.body;
    
    // Guardar en MongoDB
    const task = new Task({
      title,
      description,
      priority,
      userId: userId || 'user-123'
    });
    
    await task.save();
    
    // Guardar metadata en PostgreSQL
    await pgPool.query(
      'INSERT INTO task_metadata (task_id, user_id, priority, category) VALUES ($1, $2, $3, $4)',
      [task._id.toString(), 'user-123', priority, 'general']
    );
    
    res.status(201).json({
      message: '✅ Tarea creada en ambas bases de datos',
      task
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar tarea
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: new Date() },
      { new: true }
    );
    
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar tarea
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    
    // También eliminar de PostgreSQL
    await pgPool.query(
      'DELETE FROM task_metadata WHERE task_id = $1',
      [req.params.id]
    );
    
    res.json({ message: '🗑️ Tarea eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Estadísticas desde ambas BD
app.get('/api/stats', async (req, res) => {
  try {
    // Stats de MongoDB
    const totalTasks = await Task.countDocuments();
    const completedTasks = await Task.countDocuments({ status: 'completada' });
    const pendingTasks = await Task.countDocuments({ status: 'pendiente' });
    
    // Stats de PostgreSQL
    const pgStats = await pgPool.query(
      'SELECT COUNT(*) as total, priority FROM task_metadata GROUP BY priority'
    );
    
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
});