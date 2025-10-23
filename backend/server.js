const express = require('express');
const mongoose = require('mongoose');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();

// ✅ CONFIGURACIÓN CORS CORREGIDA PARA VERCEL
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

// ✅ CONEXIÓN MONGODB
mongoose.connect('mongodb+srv://disecaror27_db_user:disecaror27@cluster0.tnhmlkl.mongodb.net/tareasdb?retryWrites=true&w=majority&appName=Cluster0')
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => console.error('❌ Error MongoDB:', err));

// ✅ CONEXIÓN POSTGRESQL CON MANEJO DE ERRORES
const pgPool = new Pool({
  connectionString: 'postgresql://disecaror27_user:sJgyJDqNT8EyQRcGr93f2v3BqJ75ghdQ@dpg-d3rfnt1r0fns73djvkf0-a.oregon-postgres.render.com/disecaror27?ssl=true',
  ssl: {
    rejectUnauthorized: false
  }
});

// Manejo de errores de PostgreSQL
pgPool.on('error', (err, client) => {
  console.error('❌ Error in PostgreSQL pool:', err.message);
});

// Verificar conexión PostgreSQL
pgPool.connect()
  .then(() => {
    console.log('✅ Conectado a PostgreSQL');
    // Crear tabla si no existe
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

// 📊 RUTAS DE LA API

// Health check
app.get('/api/health', async (req, res) => {
  try {
    let postgresStatus = '❌ Error';
    // Verificar PostgreSQL
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

// Obtener todas las tareas
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    
    // Obtener metadata de PostgreSQL (si está disponible)
    let metadataResult = { rows: [] };
    try {
      metadataResult = await pgPool.query('SELECT * FROM task_metadata');
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
    
    // Guardar metadata en PostgreSQL (si está disponible)
    try {
      await pgPool.query(
        'INSERT INTO task_metadata (task_id, user_id, priority, category) VALUES ($1, $2, $3, $4)',
        [task._id.toString(), 'user-123', priority, 'general']
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
    
    // También eliminar de PostgreSQL (si está disponible)
    try {
      await pgPool.query(
        'DELETE FROM task_metadata WHERE task_id = $1',
        [req.params.id]
      );
    } catch (pgError) {
      console.error('❌ Error eliminando metadata:', pgError.message);
    }
    
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
    
    // Stats de PostgreSQL (si está disponible)
    let pgStats = { rows: [] };
    try {
      pgStats = await pgPool.query(
        'SELECT COUNT(*) as total, priority FROM task_metadata GROUP BY priority'
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

// ✅ CONFIGURACIÓN CORRECTA PARA RAILWAY - PUERTO DINÁMICO
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📚 API disponible en: http://0.0.0.0:${PORT}/api`);
});

// Manejo graceful de shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Recibió SIGTERM, cerrando gracefully...');
  process.exit(0);
});