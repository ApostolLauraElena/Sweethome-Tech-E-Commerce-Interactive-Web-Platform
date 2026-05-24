const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const bodyParser = require('body-parser')
const bcrypt = require('bcrypt');
const sanitizer = require('sanitizer');

const încercăriLogare = {}; 
const penalizăriTimp = [ 60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000];
const track404 = {};
const MAX_404_ERORI = 5; 
const INTERVAL_TIMP_404 = 60 * 1000; 
const TIMP_BLOCARE_DOS = 10 * 60 * 1000;

const app = express();

app.use((req, res, next) => {
    const ip = req.ip;
    if (track404[ip] && track404[ip].blocatPanaLa && Date.now() < track404[ip].blocatPanaLa) {
        return res.status(403).send("403 Forbidden: Acces interzis temporar. Comportament suspect detectat (Prevenire DoS).");
    }
    next();
});

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database('./cumparaturi.db');

app.use(session({
    secret: 'cheie-secreta',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        secure: false
    }
}));
app.use(cookieParser());
app.use((req, res, next) => {
    res.locals.utilizator = req.session.utilizator || null;
    res.locals.session = req.session;
    next();
});

const port = 6789;
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.get('/', (req, res) => {
    db.all("SELECT * FROM produse", [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.send("Eroare la citirea produselor");
        }
        res.render('index', {
            produse: rows,
            utilizator: req.session.utilizator
        });
    });

});
const fs = require('fs');
app.get('/autentificare', (req, res) => {
    const mesajEroare = req.cookies.mesajEroare;
    res.clearCookie('mesajEroare');
    res.render('autentificare', { mesajEroare: mesajEroare });
});
const verificareAdmin = (req, res, next) =>{
    if(req.session.utilizator && req.session.utilizator.rol === 'ADMIN'){
        next();
    } else{
        res.status(403).send("403 Forbidden: Acces interzis. Doar administratorii pot accesa această resursă.");
    }
};

const csrf = require('csurf');
const csrfProtection = csrf();

app.get('/admin', verificareAdmin, csrfProtection, (req, res) => {
    res.render('admin', { 
        csrfToken: req.csrfToken(), 
        utilizator: req.session.utilizator 
    });
});

app.post('/admin/adauga-produs', verificareAdmin, csrfProtection, (req, res) => {
    const { nume, descriere, pret, imagine } = req.body;

    const sql = `INSERT INTO produse (nume, descriere, pret, imagine) VALUES (?, ?, ?, ?)`;
    
    db.run(sql, [nume, descriere, pret, imagine], (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send("Eroare la adăugarea produsului.");
        }
        res.redirect('/'); 
    });
});
app.post('/verificare-autentificare', async (req, res) => {
    const ip = req.ip;
    const now = Date.now();
    if (!încercăriLogare[ip]) {
        încercăriLogare[ip] = { incercariGresite: 0, indexPenalizare: 0, blocatPanaLa: 0 };
    }

    if (now < încercăriLogare[ip].blocatPanaLa) {
        const minuteRamase = Math.ceil((încercăriLogare[ip].blocatPanaLa - now) / 60000);
        res.cookie('mesajEroare', `Prea multe încercări. Cont blocat. Încearcă din nou în ${minuteRamase} minute.`);
        return res.redirect('/autentificare');
    }

    const utilizator = sanitizer.sanitize(req.body.utilizator);
    const parola = sanitizer.sanitize(req.body.parola);

    try {
        const data = await fs.promises.readFile('utilizatori.json', 'utf8');
        const utilizatori = JSON.parse(data);

        const utilizatorGasit = utilizatori.find(u => u.utilizator === utilizator);

        if (utilizatorGasit && await bcrypt.compare(parola, utilizatorGasit.parola)) {
           
            încercăriLogare[ip] = { incercariGresite: 0, indexPenalizare: 0, blocatPanaLa: 0 };
            
            req.session.utilizator = {
                username: utilizatorGasit.utilizator,
                nume: utilizatorGasit.nume,
                prenume: utilizatorGasit.prenume,
                rol: utilizatorGasit.rol
            };
            res.redirect('/');
        } else {
            încercăriLogare[ip].incercariGresite++;
            
            if (încercăriLogare[ip].incercariGresite >= 3) {
                const idx = încercăriLogare[ip].indexPenalizare;
                încercăriLogare[ip].blocatPanaLa = now + penalizăriTimp[idx];
                
                if (idx < penalizăriTimp.length - 1) {
                    încercăriLogare[ip].indexPenalizare++;
                }
                încercăriLogare[ip].incercariGresite = 0; 
            }

            res.cookie('mesajEroare', "Utilizator sau parolă incorectă!");
            res.redirect('/autentificare');
        }
    } catch (err) {
        res.status(500).send("Eroare la verificarea utilizatorilor.");
    }
});

app.get('/chestionar', async (req, res) => {
    try {
        const data = await fs.promises.readFile('intrebari.json', 'utf8');
        const intrebari = JSON.parse(data);

        res.render('chestionar', { intrebari: intrebari });
    } catch (err) {
        console.error("Eroare la citirea fișierului:", err);
        res.status(500).send("Eroare server");
    }
});
app.post('/rezultat-chestionar', async (req, res) => {
    try {
        const data = await fs.promises.readFile('intrebari.json', 'utf8');
        const intrebari = JSON.parse(data);
        let scor = 0;

        intrebari.forEach((intrebare, index) => {
            const raspunsUtilizator = req.body['intrebare-' + index];
            if (raspunsUtilizator === intrebare.variante[intrebare.corect]) {
                scor++;
            }
        });

        res.render('rezultat-chestionar', { scor: scor, total: intrebari.length });
    } catch (err) {
        res.status(500).send("Eroare la procesarea chestionarului");
    }
});
app.get('/deconectare', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Eroare la delogare:", err);
        }
        res.redirect('/');
    });
});
app.get('/creare-bd', (req, res) => {
    db.run(`CREATE TABLE IF NOT EXISTS produse (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nume TEXT NOT NULL,
        descriere TEXT,
        pret REAL,
        imagine TEXT
    )`, (err) => {
        if (err) {
            console.error("Eroare la crearea tabelei:", err.message);
        } else {
            console.log("Tabela 'produse' a fost creată/verificată.");
        }
        res.redirect('/');
    });
});
app.get('/inserare-bd', (req, res) => {
    db.run("DELETE FROM produse", (err) => {
        if (err) {
            console.error("Eroare la ștergerea produselor vechi:", err.message);
            return res.send("Eroare la curățarea bazei de date.");
        }

        const electrocasniceleMele = [
            ['Frigider Side-by-Side', 'Capacitate 600L, No Frost, Argintiu', 3500, 'frigider.jpg'],
            ['Mașină de spălat rufe', '9kg, 1400 RPM, Clasa A+++', 1800, 'masina-spalat.jpg'],
            ['Cuptor cu microunde', '800W, 20L, Funcție Grill', 450, 'microunde.jpg'],
            ['Aspirator Robot', 'Navigare Laser, Autonomie 120 min', 1200, 'aspirator.jpg'],
            ['Mașină de spălat vase', '14 seturi, 6 programe', 2100, 'masina-vase.jpg']
        ];

        const sql = `INSERT INTO produse (nume, descriere, pret, imagine) VALUES (?, ?, ?, ?)`;

        let count = 0;
        electrocasniceleMele.forEach((produs) => {
            db.run(sql, produs, (err) => {
                if (err) console.error("Eroare la inserare:", err.message);
                count++;

                if (count === electrocasniceleMele.length) {
                    console.log("Magazinul a fost populat cu electrocasnice noi.");
                    res.redirect('/');
                }
            });
        });
    });
});
app.post('/adaugare-cos', (req, res) => {
    const idProdus = req.body.id;
    if (!req.session.cos) {
        req.session.cos = {};
    }
    //req.session.cos.push(idProdus);

    if (req.session.cos[idProdus]) {
        req.session.cos[idProdus]++;
    } else {
        req.session.cos[idProdus] = 1;
    }

    console.log("Coș actualizat:", req.session.cos);
    res.redirect('/');
});
app.get('/vizualizare-cos', (req, res) => {
    const cos = req.session.cos || {};
    const idsInCos = Object.keys(cos).filter(id => cos[id] > 0 && !isNaN(id));

    if (idsInCos.length === 0) {
        return res.render('vizualizare-cos', { produseCos: [], cos: {}, utilizator: req.session.utilizator });
    }
    const placeholders = idsInCos.map(() => '?').join(',');
    const sql = `SELECT * FROM produse WHERE id IN (${placeholders})`;

    db.all(sql, idsInCos, (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.send("Eroare la incarcarea cosului.");
        }
        res.render('vizualizare-cos', {
            produseCos: rows,
            cos: cos,
            utilizator: req.session.utilizator
        });
    });
});

app.use((req, res) => {
    const ip = req.ip;
    const now = Date.now();

    if (!track404[ip]) {
        track404[ip] = { numar: 1, primaEroare: now, blocatPanaLa: null };
    } else {
        if (now - track404[ip].primaEroare > INTERVAL_TIMP_404) {
            track404[ip] = { numar: 1, primaEroare: now, blocatPanaLa: null };
        } else {
            track404[ip].numar++;
            
            if (track404[ip].numar >= MAX_404_ERORI) {
                track404[ip].blocatPanaLa = now + TIMP_BLOCARE_DOS;
            }
        }
    }
    
    res.status(404).send("404 - Pagina nu a fost găsită. Această acțiune a fost înregistrată.");
});

app.listen(port, () => console.log(`Serverul rulează la adresa http://localhost::${port}/`));