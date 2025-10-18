const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_FILE = path.join(__dirname, 'tps.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Création des dossiers/fichiers si nécessaires
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([]));

// Config multer (pour upload)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, '_');
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `${unique}-${safeName}`);
  }
});
const upload = multer({ storage });

// Servir les fichiers statiques
app.use('/', express.static(PUBLIC_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));

// === API ===

// Ajouter un TP
app.post('/api/tps', upload.array('files'), (req, res) => {
  try {
    const { matiere, titre, description, date, statut } = req.body;
    const files = (req.files || []).map(f => ({
      originalName: f.originalname,
      savedName: f.filename,
      size: f.size,
      mimeType: f.mimetype,
      url: `/uploads/${f.filename}`
    }));

    const newTp = {
      id: Date.now(),
      matiere,
      titre,
      description,
      date,
      statut,
      files
    };

    const tps = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    tps.push(newTp);
    fs.writeFileSync(DATA_FILE, JSON.stringify(tps, null, 2));

    res.status(201).json({ message: 'TP ajouté', tp: newTp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Lister tous les TPs
app.get('/api/tps', (req, res) => {
  try {
    const tps = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    tps.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(tps);
  } catch {
    res.status(500).json({ error: 'Erreur lecture tps.json' });
  }
});

// Supprimer un TP
app.delete('/api/tps/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    let tps = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const tp = tps.find(t => t.id === id);
    if (!tp) return res.status(404).json({ error: 'TP non trouvé' });

    // Supprimer les fichiers du TP
    if (tp.files) {
      tp.files.forEach(f => {
        const p = path.join(UPLOADS_DIR, f.savedName);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });
    }

    tps = tps.filter(t => t.id !== id);
    fs.writeFileSync(DATA_FILE, JSON.stringify(tps, null, 2));

    res.json({ message: 'TP supprimé' });
  } catch {
    res.status(500).json({ error: 'Erreur suppression' });
  }
});

app.listen(PORT, () => console.log(`✅ Serveur démarré sur http://localhost:${PORT}`));
