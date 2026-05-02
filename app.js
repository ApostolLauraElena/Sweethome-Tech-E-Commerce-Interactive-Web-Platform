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

app.get('/chestionar', (req, res) => {
    const listaIntrebari = [
        {

        intrebare: 'Întrebarea 1',
        variante: ['varianta 1', 'varianta 2', 'varianta 3', 'varianta 4'],
        corect: 0
        },
        {
            "intrebare": "Care dintre următoarele este considerat un electrocasnic mic pentru bucătărie?",
            "variante": ["Congelatorul", "Mașina de spălat vase", "Prăjitorul de pâine", "Hota"],
            "corect": 2
        },
        {
            "intrebare": "Ce proces de curățare a cuptorului presupune arderea resturilor la temperaturi foarte înalte?",
            "variante": ["Curățare catalitică", "Curățare manuală", "Curățare hidrolitică", "Curățare pirolitică"],
            "corect": 3
        },
        {
            "intrebare": "În ce unitate de măsură este exprimată de obicei puterea unui aspirator?",
            "variante": ["Amperi", "Wați (W)", "Volți", "Lumeni"],
            "corect": 1
        }
 ];

 res.render('chestionar', {intrebari: listaIntrebari});
});
app.post('/rezultat-chestionar', (req, res) => {
    console.log("Date primite de la formular:", req.body);

    const intrebari = JSON.parse(fs.readFileSync('intrebari.json'));
    let scor = 0;

    intrebari.forEach((intrebare, index) => {
        const raspunsUtilizator = req.body['intrebare-' + index];
        if (raspunsUtilizator == intrebare.variante[intrebare.corect]) {
            scor++;
        }
    });

   res.render('rezultat-chestionar', { scor: scor, total: intrebari.length });
});
app.listen(port, () => console.log(`Serverul rulează la adresa http://localhost:
:${port}/`));