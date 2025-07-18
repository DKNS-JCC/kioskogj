const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');
const fs = require('fs');

const app = express();
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'database.db');

// Crear directorio data si no existe
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);
const PORT = 3000;

const corsOptions = {
    origin: '*', // Permitir todas las solicitudes de origen
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Métodos permitidos
    allowedHeaders: ['Content-Type', 'Authorization'],
}

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Crear tabla de niños si no existe
db.run(`CREATE TABLE IF NOT EXISTS ninos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  grupo INTEGER NOT NULL,
  dinero REAL NOT NULL
)`);

// Crear tabla de productos si no existe
db.run(`CREATE TABLE IF NOT EXISTS productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  precio REAL NOT NULL
)`);

// Crear tabla de configuración si no existe
db.run(`CREATE TABLE IF NOT EXISTS configuracion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clave TEXT UNIQUE,
  valor TEXT
)`);

// Crear tabla de transacciones si no existe
db.run(`CREATE TABLE IF NOT EXISTS transacciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nino_id INTEGER NOT NULL,
  nino_nombre TEXT NOT NULL,
  productos TEXT NOT NULL,
  total REAL NOT NULL,
  fecha_hora TEXT NOT NULL,
  FOREIGN KEY (nino_id) REFERENCES ninos(id)
)`);

// Crear tabla de castigos si no existe
db.run(`CREATE TABLE IF NOT EXISTS castigos (
  nino_id INTEGER PRIMARY KEY,
  hasta INTEGER NOT NULL,
  FOREIGN KEY (nino_id) REFERENCES ninos(id)
)`);

// Crear tabla de historial de castigos si no existe
db.run(`CREATE TABLE IF NOT EXISTS castigos_hist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nino_id INTEGER NOT NULL,
  fecha INTEGER NOT NULL,
  hasta INTEGER NOT NULL,
  revocado INTEGER DEFAULT 0,
  FOREIGN KEY (nino_id) REFERENCES ninos(id)
)`);

// Migración para asegurar que existe la columna tokens
db.get("SELECT COUNT(*) as count FROM pragma_table_info('ninos') WHERE name='tokens'", [], (err, row) => {
  if (err || !row || row.count === 0) {
    db.run("ALTER TABLE ninos ADD COLUMN tokens INTEGER DEFAULT 0", [], function(err) {
      if (err) console.error("Error al añadir columna tokens:", err);
      else console.log("Columna tokens añadida correctamente");
      
      // Inicializar tokens existentes a 0
      db.run("UPDATE ninos SET tokens = 0 WHERE tokens IS NULL");
    });
  }
});

// Endpoint para añadir niño
app.post('/api/ninos', (req, res) => {
  const { nombre, apellidos, grupo, dinero } = req.body;
  if (!nombre || !apellidos || typeof grupo !== 'number' || grupo <= 0 || typeof dinero !== 'number' || dinero < 0) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  db.run(
    'INSERT INTO ninos (nombre, apellidos, grupo, dinero) VALUES (?, ?, ?, ?)',
    [nombre, apellidos, grupo, dinero],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

app.post('/api/limpiar-ninos', (req, res) => {
  db.run('DELETE FROM ninos', [], function(err) {
    if (err) return res.json({ success: false });
    res.json({ success: true });
  });
});

// Endpoint para listar niños
app.get('/api/ninos', (req, res) => {
  db.all('SELECT * FROM ninos', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Endpoint para actualizar niño
app.put('/api/ninos/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { nombre, apellidos, grupo, dinero } = req.body;
  
  if (isNaN(id) || !nombre || !apellidos || typeof grupo !== 'number' || grupo <= 0 || typeof dinero !== 'number' || dinero < 0) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  
  db.run(
    'UPDATE ninos SET nombre = ?, apellidos = ?, grupo = ?, dinero = ? WHERE id = ?',
    [nombre, apellidos, grupo, dinero, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Niño no encontrado' });
      res.json({ success: true });
    }
  );
});

// Endpoint para eliminar niño
app.delete('/api/ninos/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  
  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  
  db.run('DELETE FROM ninos WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Niño no encontrado' });
    res.json({ success: true });
  });
});

// Endpoint para añadir producto
app.post('/api/productos', (req, res) => {
  const { nombre, precio } = req.body;
  if (!nombre || typeof precio !== 'number' || precio <= 0) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  db.run(
    'INSERT INTO productos (nombre, precio) VALUES (?, ?)',
    [nombre, precio],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Endpoint para listar productos
app.get('/api/productos', (req, res) => {
  db.all('SELECT * FROM productos', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Endpoint para actualizar producto
app.put('/api/productos/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { nombre, precio } = req.body;
  
  if (isNaN(id) || !nombre || typeof precio !== 'number' || precio <= 0) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  
  db.run(
    'UPDATE productos SET nombre = ?, precio = ? WHERE id = ?',
    [nombre, precio, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
      res.json({ success: true });
    }
  );
});

// Endpoint para eliminar producto
app.delete('/api/productos/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  
  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  
  db.run('DELETE FROM productos WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ success: true });
  });
});

// Restar saldo a un niño
app.post('/api/ninos/:id/restar', (req, res) => {
  const id = parseInt(req.params.id, 10); // Asegúrate de convertir el ID a un número entero
  let cantidad = req.body.cantidad;
  cantidad = parseFloat(cantidad); // Asegúrate de convertir la cantidad a un número flotante
  if (isNaN(id) || isNaN(cantidad) || cantidad <= 0) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  db.get('SELECT dinero FROM ninos WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Niño no encontrado' });
    if (row.dinero < cantidad) return res.status(400).json({ error: 'Saldo insuficiente' });
    const nuevoSaldo = parseFloat((row.dinero - cantidad).toFixed(2));
    db.run('UPDATE ninos SET dinero = ? WHERE id = ?', [nuevoSaldo, id], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true, nuevoSaldo });
    });
  });
});

// Ruta para obtener configuración
app.get('/api/configuracion', (req, res) => {
  db.get('SELECT valor FROM configuracion WHERE clave = ?', ['cotaDiaria'], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const cotaDiaria = row ? parseFloat(row.valor) : 2.50;
    res.json({ cotaDiaria });
  });
});

// Ruta para actualizar configuración
app.post('/api/configuracion', (req, res) => {
  const { cotaDiaria } = req.body;
  
  if (typeof cotaDiaria !== 'number' || cotaDiaria < 0) {
    res.status(400).json({ error: 'Cota diaria debe ser un número válido' });
    return;
  }

  db.run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)`, 
    ['cotaDiaria', cotaDiaria.toString()], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true });
  });
});

// Endpoint para registrar una transacción
app.post('/api/transacciones', (req, res) => {
  const { nino_id, nino_nombre, productos, total } = req.body;
  const fecha_hora = new Date().toISOString();
  
  if (!nino_id || !nino_nombre || !productos || typeof total !== 'number' || total <= 0) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  
  db.run(
    'INSERT INTO transacciones (nino_id, nino_nombre, productos, total, fecha_hora) VALUES (?, ?, ?, ?, ?)',
    [nino_id, nino_nombre, productos, total, fecha_hora],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Endpoint para obtener transacciones con filtros
app.get('/api/transacciones', (req, res) => {
  const { fecha_inicio, fecha_fin, nino_id, grupo, busqueda } = req.query;
  let query = `
    SELECT t.*, n.grupo 
    FROM transacciones t 
    LEFT JOIN ninos n ON t.nino_id = n.id 
    WHERE 1=1
  `;
  const params = [];
  
  if (fecha_inicio) {
    query += ' AND date(t.fecha_hora) >= date(?)';
    params.push(fecha_inicio);
  }
  
  if (fecha_fin) {
    query += ' AND date(t.fecha_hora) <= date(?)';
    params.push(fecha_fin);
  }
  
  if (nino_id) {
    query += ' AND t.nino_id = ?';
    params.push(nino_id);
  }
  
  if (grupo) {
    query += ' AND n.grupo = ?';
    params.push(grupo);
  }
  
  if (busqueda) {
    query += ' AND (t.nino_nombre LIKE ? OR t.productos LIKE ?)';
    params.push(`%${busqueda}%`, `%${busqueda}%`);
  }
  
  query += ' ORDER BY t.fecha_hora DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// NUEVO: Endpoint para reembolsar una transacción
app.delete('/api/transacciones/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  
  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  
  // Primero obtener la transacción para verificar que existe y obtener los datos
  db.get('SELECT * FROM transacciones WHERE id = ?', [id], (err, transaccion) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!transaccion) return res.status(404).json({ error: 'Transacción no encontrada' });
    
    // Verificar que el niño aún existe
    db.get('SELECT dinero FROM ninos WHERE id = ?', [transaccion.nino_id], (err2, nino) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (!nino) return res.status(404).json({ error: 'Niño no encontrado' });
      
      // Devolver el dinero al niño
      const nuevoSaldo = parseFloat((nino.dinero + transaccion.total).toFixed(2));
      
      db.run('UPDATE ninos SET dinero = ? WHERE id = ?', [nuevoSaldo, transaccion.nino_id], function(err3) {
        if (err3) return res.status(500).json({ error: err3.message });
        
        // Eliminar la transacción
        db.run('DELETE FROM transacciones WHERE id = ?', [id], function(err4) {
          if (err4) return res.status(500).json({ error: err4.message });
          
          res.json({ 
            success: true, 
            nuevoSaldo,
            transaccion: {
              nino_nombre: transaccion.nino_nombre,
              total: transaccion.total
            }
          });
        });
      });
    });
  });
});

// Endpoint para estadísticas de transacciones - adaptado para campamento corto
app.get('/api/estadisticas', (req, res) => {
  const queries = {
    totalVentas: 'SELECT COUNT(*) as count, SUM(total) as sum FROM transacciones',
    ventasHoy: `SELECT COUNT(*) as count, SUM(total) as sum FROM transacciones WHERE date(fecha_hora) = date('now')`,
    topNinos: `SELECT nino_nombre, COUNT(*) as compras, SUM(total) as gastado FROM transacciones GROUP BY nino_id ORDER BY gastado DESC LIMIT 5`,
    // Modificado para enfocarse en últimos 10 días
    ventasPorDia: `SELECT date(fecha_hora) as fecha, COUNT(*) as compras, SUM(total) as total FROM transacciones WHERE date(fecha_hora) >= date('now', '-10 days') GROUP BY date(fecha_hora) ORDER BY fecha DESC`
  };
  
  const results = {};
  let completed = 0;
  const total = Object.keys(queries).length;
  
  Object.entries(queries).forEach(([key, query]) => {
    db.all(query, [], (err, rows) => {
      if (err) {
        results[key] = [];
      } else {
        results[key] = rows;
      }
      completed++;
      if (completed === total) {
        res.json(results);
      }
    });
  });
});

// Servir index.html en la raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Función para obtener IPs de la red
function getNetworkIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// NUEVO: Endpoint para info de saldo y compra del día de un niño
app.get('/api/ninos/:id/info', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  db.get('SELECT dinero, COALESCE(tokens, 0) as tokens FROM ninos WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Niño no encontrado' });

    db.get(
      `SELECT COUNT(*) as comprasHoy FROM transacciones WHERE nino_id = ? AND date(fecha_hora) = date('now')`,
      [id],
      (err2, row2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({
          saldo: row.dinero,
          tokens: row.tokens,
          compradoHoy: row2 && row2.comprasHoy > 0
        });
      }
    );
  });
});

// Endpoint para actualizar tokens
app.post('/api/ninos/:id/tokens', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const cantidad = parseInt(req.body.cantidad, 10);
  
  if (isNaN(id) || isNaN(cantidad) || cantidad < 0) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  
  db.get('SELECT COALESCE(tokens, 0) as tokens FROM ninos WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Niño no encontrado' });
    
    const nuevosTokens = row.tokens + cantidad;
    
    db.run('UPDATE ninos SET tokens = ? WHERE id = ?', [nuevosTokens, id], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true, nuevosTokens });
    });
  });
});

// Endpoint para castigar a un niño por 12 horas
app.post('/api/ninos/:id/castigar', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
  const ahora = Date.now();
  const hasta = ahora + 12 * 60 * 60 * 1000; // 12 horas

  // Registrar en historial SIEMPRE
  db.run(
    `INSERT INTO castigos_hist (nino_id, fecha, hasta, revocado) VALUES (?, ?, ?, 0)`,
    [id, ahora, hasta],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });

      // Añadir/actualizar castigo activo
      db.run(
        `INSERT OR REPLACE INTO castigos (nino_id, hasta) VALUES (?, ?)`,
        [id, hasta],
        function(err2) {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ success: true, hasta });
        }
      );
    }
  );
});

// Endpoint para eliminar el castigo de un niño
app.delete('/api/ninos/:id/castigar', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  // Marcar como revocado en el historial el castigo activo (si existe y sigue vigente)
  const ahora = Date.now();
  db.run(
    `UPDATE castigos_hist SET revocado = 1 WHERE nino_id = ? AND revocado = 0 AND hasta > ?`,
    [id, ahora],
    function() {
      // Eliminar castigo activo
      db.run(`DELETE FROM castigos WHERE nino_id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      });
    }
  );
});

// Endpoint para obtener todos los castigos activos
app.get('/api/castigos', (req, res) => {
  const ahora = Date.now();
  // Elimina castigos expirados antes de devolver
  db.run(`DELETE FROM castigos WHERE hasta < ?`, [ahora], function() {
    db.all(`SELECT * FROM castigos WHERE hasta >= ?`, [ahora], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      // Devuelve como { nino_id: hasta, ... }
      const castigos = {};
      rows.forEach(row => { castigos[row.nino_id] = row.hasta; });
      res.json(castigos);
    });
  });
});

// Endpoint para obtener el histórico de castigos por niño (cuenta todos, aunque se revoquen)
app.get('/api/castigos-historico', (req, res) => {
  db.all('SELECT nino_id, COUNT(*) as veces FROM castigos_hist GROUP BY nino_id', [], (err, rows) => {
    if (err) return res.json({});
    const result = {};
    rows.forEach(r => result[r.nino_id] = r.veces);
    res.json(result);
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  
  const networkIPs = getNetworkIPs();
  if (networkIPs.length > 0) {
    console.log('Accesible desde la red en:');
    networkIPs.forEach(ip => {
      console.log(`http://${ip}:${PORT}`);
    });
  } else {
    console.log('No se encontraron interfaces de red externas');
  }
});
