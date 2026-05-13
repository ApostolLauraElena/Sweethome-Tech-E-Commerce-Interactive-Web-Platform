const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const bodyParser = require('body-parser')
const app = express();

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database('./cumparaturi.db');

app.use(session({
    secret: 'cheie-secreta',
    resave: false,
    saveUninitialized: true
}));
app.use(cookieParser());
app.use((req, res, next) => { // Adaugă 'next' aici
    res.locals.utilizator = req.session.utilizator || null;
    next(); // Apelează 'next()' pentru a trece la următoarea rută
});
const port = 6789;
// directorul 'views' va conține fișierele .ejs (html + js executat la server)
app.set('view engine', 'ejs');
// suport pentru layout-uri - implicit fișierul care reprezintă template-ul site-ului este views/layout.ejs
app.use(expressLayouts);
// directorul 'public' va conține toate resursele accesibile direct de către client(e.g., fișiere css, javascript, imagini)
app.use(express.static('public'))
// corpul mesajului poate fi interpretat ca json; datele de la formular se găsesc în format json în req.body
app.use(bodyParser.json());
// utilizarea unui algoritm de deep parsing care suportă obiecte în obiecte
app.use(bodyParser.urlencoded({ extended: true }));
// la accesarea din browser adresei http://localhost:6789/ se va returna textul 'HelloWorld'
// proprietățile obiectului Request - req - https://expressjs.com/en/api.html#req
// proprietățile obiectului Response - res - https://expressjs.com/en/api.html#res
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
// la accesarea din browser adresei http://localhost:6789/chestionar se va apela funcția specificată
const fs = require('fs');
app.get('/autentificare', (req, res) => {
    const mesajEroare = req.cookies.mesajEroare;
    res.clearCookie('mesajEroare');
    res.render('autentificare', { mesajEroare: mesajEroare });
});
app.post('/verificare-autentificare', async (req, res) => {
    const { utilizator, parola } = req.body;

    try {
        const data = await fs.promises.readFile('utilizatori.json', 'utf8');
        const utilizatori = JSON.parse(data);

        const utilizatorGasit = utilizatori.find(u => u.utilizator === utilizator && u.parola === parola);

        if (utilizatorGasit) {
            req.session.utilizator = {
                username: utilizatorGasit.utilizator,
                nume: utilizatorGasit.nume,
                prenume: utilizatorGasit.prenume
            };
            res.redirect('/');
        } else {
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
        req.session.cos = [];
    }
    req.session.cos.push(idProdus);
    
    console.log("Coș actualizat:", req.session.cos);
    res.redirect('/');
});
app.listen(port, () => console.log(`Serverul rulează la adresa http://localhost::${port}/`));