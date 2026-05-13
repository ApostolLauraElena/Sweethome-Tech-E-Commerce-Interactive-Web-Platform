const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const cookieParser=require('cookie-parser'); 
const session = require('express-session');
const bodyParser = require('body-parser')
const app = express();
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
    res.render('index'); 
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
app.listen(port, () => console.log(`Serverul rulează la adresa http://localhost::${port}/`));