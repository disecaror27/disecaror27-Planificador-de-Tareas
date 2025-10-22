import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// ✅ URL CORREGIDA - APUNTA AL BACKEND EN RAILWAY
const API_URL = 'https://disecaror27-planificador-de-tareas-production.up.railway.app/api';

function App() {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'media'
  });
  const [loading, setLoading] = useState(false);

  // Cargar tareas
  const fetchTasks = async () => {
    try {
      const response = await axios.get(`${API_URL}/tasks`);
      setTasks(response.data);
    } catch (error) {
      console.error('Error cargando tareas:', error);
    }
  };

  // Cargar estadísticas
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error cargando stats:', error);
    }
  };

  // Crear tarea
  const createTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    setLoading(true);
    try {
      await axios.post(`${API_URL}/tasks`, newTask);
      setNewTask({ title: '', description: '', priority: 'media' });
      await fetchTasks();
      await fetchStats();
    } catch (error) {
      console.error('Error creando tarea:', error);
    } finally {
      setLoading(false);
    }
  };

  // Actualizar estado de tarea
  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      await axios.put(`${API_URL}/tasks/${taskId}`, { status: newStatus });
      await fetchTasks();
      await fetchStats();
    } catch (error) {
      console.error('Error actualizando tarea:', error);
    }
  };

  // Eliminar tarea
  const deleteTask = async (taskId) => {
    if (!confirm('¿Eliminar esta tarea?')) return;
    
    try {
      await axios.delete(`${API_URL}/tasks/${taskId}`);
      await fetchTasks();
      await fetchStats();
    } catch (error) {
      console.error('Error eliminando tarea:', error);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <img 
          src="https://i.imgur.com/Q17EHVQ.png" 
          alt="Logo ITS Japon" 
          className="header-image"
        />
        <h1>Planificador de Tareas ITS Japon</h1>
        <p>Base de datos: MongoDB + PostgreSQL</p>
      </header>

      <div className="container">
        {/* Formulario */}
        <section className="task-form">
          <h2>➕ Nueva Tarea</h2>
          <form onSubmit={createTask}>
            <input
              type="text"
              placeholder="Título de la tarea"
              value={newTask.title}
              onChange={(e) => setNewTask({...newTask, title: e.target.value})}
              required
            />
            <textarea
              placeholder="Descripción (opcional)"
              value={newTask.description}
              onChange={(e) => setNewTask({...newTask, description: e.target.value})}
            />
            <select
              value={newTask.priority}
              onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
            >
              <option value="baja">Baja Prioridad</option>
              <option value="media">Media Prioridad</option>
              <option value="alta">Alta Prioridad</option>
            </select>
            <button type="submit" disabled={loading}>
              {loading ? 'Creando...' : 'Crear Tarea'}
            </button>
          </form>
        </section>

        {/* Estadísticas */}
        {stats && (
          <section className="stats">
            <h2>📊 Estadísticas</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Tareas</h3>
                <p>{stats.mongoStats?.total || 0}</p>
              </div>
              <div className="stat-card">
                <h3>Completadas</h3>
                <p>{stats.mongoStats?.completed || 0}</p>
              </div>
              <div className="stat-card">
                <h3>Pendientes</h3>
                <p>{stats.mongoStats?.pending || 0}</p>
              </div>
            </div>
          </section>
        )}

        {/* Lista de Tareas */}
        <section className="task-list">
          <h2>📋 Lista de Tareas ({tasks.length})</h2>
          {tasks.length === 0 ? (
            <p className="no-tasks">No hay tareas. ¡Crea la primera!</p>
          ) : (
            <div className="tasks-grid">
              {tasks.map(task => (
                <div key={task._id} className={`task-card ${task.status}`}>
                  <div className="task-header">
                    <h3>{task.title}</h3>
                    <span className={`priority ${task.priority}`}>
                      {task.priority}
                    </span>
                  </div>
                  
                  {task.description && (
                    <p className="task-description">{task.description}</p>
                  )}
                  
                  <div className="task-meta">
                    <span className={`status ${task.status}`}>
                      {task.status}
                    </span>
                    <span className="date">
                      {new Date(task.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="task-actions">
                    {task.status !== 'completada' && (
                      <button 
                        onClick={() => updateTaskStatus(task._id, 'completada')}
                        className="btn-success"
                      >
                        ✅ Completar
                      </button>
                    )}
                    {task.status === 'completada' && (
                      <button 
                        onClick={() => updateTaskStatus(task._id, 'pendiente')}
                        className="btn-warning"
                      >
                        ↩️ Pendiente
                      </button>
                    )}
                    <button 
                      onClick={() => deleteTask(task._id)}
                      className="btn-danger"
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;