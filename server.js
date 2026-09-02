const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
const SECRET_KEY = 'clave-super-secreta-cambiar-en-produccion';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// BASE DE DATOS EN MEMORIA
let users = [
  {
    id: 1,
    email: 'admin@rutamanager.com',
    password: bcrypt.hashSync('admin123', 10),
    nombre: 'Administrador',
    rol: 'admin',
    activo: true
  },
  {
    id: 2,
    email: 'conductor@rutamanager.com',
    password: bcrypt.hashSync('conductor123', 10),
    nombre: 'Juan Pérez',
    rol: 'conductor',
    activo: true,
    driver_id: 1
  }
];

let drivers = [
  {
    id: 1,
    user_id: 2,
    documento: '1234567890',
    vehiculo: 'Toyota Hilux',
    placa: 'ABC-123',
    telefono: '+573001234567'
  }
];

let routes = [
  {
    id: 1,
    driver_id: 1,
    fecha: new Date().toISOString().split('T')[0],
    estado: 'planificada',
    hora_inicio: null,
    hora_fin: null,
    created_at: new Date().toISOString()
  }
];

let activities = [
  {
    id: 1,
    route_id: 1,
    orden: 1,
    fecha: new Date().toISOString().split('T')[0],
    hora_programada: '08:00',
    ubicacion: 'Calle 50 #25-10, Medellín',
    lat: 6.2442,
    lng: -75.5898,
    cliente: 'Empresa A',
    tipo_servicio: 'entrega',
    descripcion: 'Entregar 10 cajas de productos',
    cantidad: 10,
    estado: 'pendiente',
    observaciones: ''
  },
  {
    id: 2,
    route_id: 1,
    orden: 2,
    fecha: new Date().toISOString().split('T')[0],
    hora_programada: '10:00',
    ubicacion: 'Cra 43 #5-45, Medellín',
    lat: 6.2250,
    lng: -75.5800,
    cliente: 'Empresa B',
    tipo_servicio: 'recogida',
    descripcion: 'Recoger paquetes devueltos',
    cantidad: 5,
    estado: 'pendiente',
    observaciones: ''
  }
];

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
  
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
};

// AUTENTICACIÓN
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  const token = jwt.sign({ id: user.id, email: user.email, rol: user.rol }, SECRET_KEY, { expiresIn: '24h' });
  res.json({ success: true, token, user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol } });
});

app.get('/auth/me', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  res.json({ id: user.id, email: user.email, nombre: user.nombre, rol: user.rol });
});

// RUTAS
app.get('/api/routes', authenticateToken, (req, res) => {
  res.json(routes.map(r => ({ ...r, activities: activities.filter(a => a.route_id === r.id).sort((a, b) => a.orden - b.orden), driver: drivers.find(d => d.id === r.driver_id) })));
});

app.post('/api/routes', authenticateToken, (req, res) => {
  const { driver_id, fecha } = req.body;
  const newRoute = { id: Math.max(...routes.map(r => r.id), 0) + 1, driver_id: parseInt(driver_id), fecha, estado: 'planificada', hora_inicio: null, hora_fin: null, created_at: new Date().toISOString() };
  routes.push(newRoute);
  res.status(201).json(newRoute);
});

app.put('/api/routes/:id', authenticateToken, (req, res) => {
  const route = routes.find(r => r.id === parseInt(req.params.id));
  if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });
  const { estado, hora_inicio, hora_fin } = req.body;
  if (estado) route.estado = estado;
  if (hora_inicio) route.hora_inicio = hora_inicio;
  if (hora_fin) route.hora_fin = hora_fin;
  res.json(route);
});

app.delete('/api/routes/:id', authenticateToken, (req, res) => {
  const index = routes.findIndex(r => r.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Ruta no encontrada' });
  const deleted = routes.splice(index, 1);
  activities = activities.filter(a => a.route_id !== deleted[0].id);
  res.json({ success: true });
});

// ACTIVIDADES
app.get('/api/routes/:id/activities', authenticateToken, (req, res) => {
  res.json(activities.filter(a => a.route_id === parseInt(req.params.id)).sort((a, b) => a.orden - b.orden));
});

app.post('/api/routes/:id/activities', authenticateToken, (req, res) => {
  const { orden, fecha, hora_programada, ubicacion, lat, lng, cliente, tipo_servicio, descripcion, cantidad } = req.body;
  const newActivity = { id: Math.max(...activities.map(a => a.id), 0) + 1, route_id: parseInt(req.params.id), orden: orden || activities.filter(a => a.route_id === parseInt(req.params.id)).length + 1, fecha, hora_programada, ubicacion, lat: lat || 0, lng: lng || 0, cliente, tipo_servicio: tipo_servicio || 'entrega', descripcion: descripcion || '', cantidad: cantidad || 1, estado: 'pendiente', observaciones: '' };
  activities.push(newActivity);
  res.status(201).json(newActivity);
});

app.put('/api/activities/:id', authenticateToken, (req, res) => {
  const activity = activities.find(a => a.id === parseInt(req.params.id));
  if (!activity) return res.status(404).json({ error: 'Actividad no encontrada' });
  const { estado, observaciones, hora_programada, orden } = req.body;
  if (estado) activity.estado = estado;
  if (observaciones) activity.observaciones = observaciones;
  if (hora_programada) activity.hora_programada = hora_programada;
  if (orden) activity.orden = orden;
  res.json(activity);
});

// CONDUCTORES
app.get('/api/drivers', authenticateToken, (req, res) => res.json(drivers));

// DASHBOARD
app.get('/api/dashboard', authenticateToken, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const routesToday = routes.filter(r => r.fecha === today);
  const activitiesToday = activities.filter(a => a.fecha === today);
  res.json({
    fecha: today,
    stats: {
      rutasTotales: routesToday.length,
      rutasEnProgreso: routesToday.filter(r => r.estado === 'en_progreso').length,
      rutasCompletadas: routesToday.filter(r => r.estado === 'completada').length,
      actividadesTotales: activitiesToday.length,
      actividadesCompletadas: activitiesToday.filter(a => a.estado === 'completada').length,
      actividadesEnProgreso: activitiesToday.filter(a => a.estado === 'en_proceso').length,
      actividadesPendientes: activitiesToday.filter(a => a.estado === 'pendiente').length
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
