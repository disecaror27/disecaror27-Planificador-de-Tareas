import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaPlus, FaChartBar, FaList, FaCheck, FaTrash, FaSignOutAlt, FaUser } from 'react-icons/fa';
import Login from './components/Login';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://disecaror27-planificador-de-tareas.onrender.com/api';

function App() {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'media'
  });
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [appLoading, setAppLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      verifyAuth(token, JSON.parse(userData));
    } else {
      setAppLoading(false);
    }
  }, []);

  const verifyAuth = async (token, userData) => {
    try {
      const response = await axios.get(`${API_URL}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.valid) {
        setUser(userData);
        setIsAuthenticated(true);
        fetchTasks(token);
        fetchStats(token);
      }
    } catch (error) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } finally {
      setAppLoading(false);
    }
  };

  const fetchTasks = async (token = localStorage.getItem('token')) => {
    try {
      const response = await axios.get(`${API_URL}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(response.data);
    } catch (error) {
      console.error('Error cargando tareas:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  const fetchStats = async (token = localStorage.getItem('token')) => {
    try {
      const response = await axios.get(`${API_URL}/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error cargando stats:', error);
    }
  };

  const createTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    setLoading(true);
    try {
      await axios.post(`${API_URL}/tasks`, newTask, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setNewTask({ title: '', description: '', priority: 'media' });
      await fetchTasks();
      await fetchStats();
    } catch (error) {
      console.error('Error creando tarea:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      await axios.put(`${API_URL}/tasks/${taskId}`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      await fetchTasks();
      await fetchStats();
    } catch (error) {
      console.error('Error actualizando tarea:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  const deleteTask = async (taskId) => {
    if (!confirm('¿Eliminar esta tarea?')) return;
    
    try {
      await axios.delete(`${API_URL}/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      await fetchTasks();
      await fetchStats();
    } catch (error) {
      console.error('Error eliminando tarea:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  const handleLogin = (userData, token) => {
    setUser(userData);
    setIsAuthenticated(true);
    fetchTasks(token);
    fetchStats(token);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
    setTasks([]);
    setStats(null);
  };

  if (appLoading) {
    return (
      <div className="loading-container">
        <div className="loading">Cargando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <img 
            src="https://i.imgur.com/Q17EHVQ.png" 
            alt="Logo ITS Japon" 
            className="header-image"
          />
          <div className="header-text">
            <h1>Planificador de Tareas ITS Japón</h1>
            <p>Base de datos: MongoDB + PostgreSQL</p>
          </div>
        </div>
        
        <div className="user-info">
          <span className="user-welcome">
            <FaUser /> Hola, Diego
          </span>
          <button onClick={handleLogout} className="logout-button">
            <FaSignOutAlt /> Cerrar Sesión
          </button>
        </div>
      </header>

      <div className="container">
        <section className="task-form">
          <h2><FaPlus /> Nueva Tarea</h2>
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

        {stats && (
          <section className="stats">
            <h2><FaChartBar /> Estadísticas</h2>
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

        <section className="task-list">
          <h2><FaList /> Lista de Tareas ({tasks.filter(task => task.status !== 'completada').length})</h2>
          {tasks.filter(task => task.status !== 'completada').length === 0 ? (
            <p className="no-tasks">No hay tareas pendientes. ¡Crea una nueva!</p>
          ) : (
            <div className="tasks-grid">
              {tasks.filter(task => task.status !== 'completada').map(task => (
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
                        <FaCheck /> Completar
                      </button>
                    )}
                    <button 
                      onClick={() => deleteTask(task._id)}
                      className="btn-danger"
                    >
                      <FaTrash /> Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="app-footer">
        <p>Copyright © 2025 Diego Carvajal. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

export default App;