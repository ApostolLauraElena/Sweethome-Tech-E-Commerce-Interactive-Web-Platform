const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const bodyParser = require('body-parser')
const app = express();
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
app.get('/', (req, res) => res.send('Hello World'));
// la accesarea din browser adresei http://localhost:6789/chestionar se va apela funcția specificată
const fs = require('fs');

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
app.listen(port, () => console.log(`Serverul rulează la adresa http://localhost:
:${port}/`));