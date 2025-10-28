const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Usuario y contraseña son requeridos'
      });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas'
      });
    }

    const isPasswordCorrect = await user.correctPassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas'
      });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor'
    });
  }
});

router.get('/verify', auth, async (req, res) => {
  try {
    res.json({
      valid: true,
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role
      }
    });
  } catch (error) {
    res.status(401).json({ valid: false });
  }
});

router.post('/setup', async (req, res) => {
  try {
    const existingUser = await User.findOne({ username: 'admin' });
    if (!existingUser) {
      const user = new User({
        username: 'admin',
        password: '123456',
        email: 'dscarvajalo@itsjapon.edu.ec',
        role: 'admin'
      });

      await user.save();
      return res.json({
        success: true,
        message: 'Usuario admin creado exitosamente'
      });
    }

    res.json({
      success: true,
      message: 'Usuario admin ya existe'
    });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error creando usuario'
    });
  }
});

router.get('/setup-get', async (req, res) => {
  try {
    const existingUser = await User.findOne({ username: 'admin' });
    if (!existingUser) {
      const user = new User({
        username: 'admin',
        password: '123456',
        email: 'dscarvajalo@itsjapon.edu.ec',
        role: 'admin'
      });

      await user.save();
      return res.json({
        success: true,
        message: 'Usuario admin creado exitosamente (GET)'
      });
    }

    res.json({
      success: true,
      message: 'Usuario admin ya existe (GET)'
    });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error creando usuario'
    });
  }
});

// 🔧 ENDPOINT TEMPORAL PARA RESETEAR CONTRASEÑA DEL ADMIN
router.get('/fix-admin-login', async (req, res) => {
  try {
    console.log('🔧 Ejecutando fix-admin-login...');
    
    const user = await User.findOne({ username: 'admin' });
    
    if (!user) {
      console.log('❌ Usuario admin no encontrado, creando...');
      const newUser = new User({
        username: 'admin',
        password: '123456',
        email: 'dscarvajalo@itsjapon.edu.ec',
        role: 'admin'
      });
      await newUser.save();
      return res.json({ 
        success: true, 
        message: '✅ Usuario admin CREADO con contraseña 123456' 
      });
    }
    
    console.log('✅ Usuario admin encontrado:', user.username);
    
    user.password = '123456';
    await user.save();
    
    console.log('✅ Contraseña reseteada exitosamente');
    
    res.json({ 
      success: true, 
      message: '✅ CONTRASEÑA RESETEADA - Ahora usa: usuario: "admin", contraseña: "123456"' 
    });
    
  } catch (error) {
    console.error('❌ Error en fix-admin-login:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error: ' + error.message 
    });
  }
});

module.exports = router;