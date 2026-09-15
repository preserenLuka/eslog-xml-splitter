# Razdelilnik računov eSLOG za vodo

Brskalniška aplikacija pripravi vodni del računov eSLOG za uvoz v `iot.petrol.si`. Obdelava poteka samo v pomnilniku trenutne strani. Privzeti ZIP vsebuje vodne XML in kontrolni poročili; odpadkovni paket se izdela ločeno v dodatnih možnostih.

## Postopek

1. Naložite enega ali več računov XML.
2. Preglejte vodni znesek, izločene odpadke, neznane postavke in merilna mesta.
3. Neznane postavke ročno označite kot vodo, odpadke ali namerni izpust. Opozorila pred izvozom izrecno potrdite.
4. Prenesite »Vodo za uvoz« in uvozite XML iz mape `voda` v `iot.petrol.si`.

Tehnično neveljaven XML, neveljavni denarni podatki in podvojeni identifikatorji postavk blokirajo izvoz. Identični SHA-256 dvojniki se izpustijo. Sporna vsebina ostane v stanju »Potreben pregled«.

## Izhod

Vodni paket:

```text
voda/*.xml
porocila/seznam.json
porocila/seznam.csv
```

Ločeni odpadkovni paket uporablja mapo `odpadki`. Vodni XML ohrani izvorno številko računa, odpadkovni XML pa dobi pripono `-01`. Digitalni podpis se iz izpeljanega dokumenta odstrani.

## Razvoj

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

Testi vključujejo anonimizirana realistična računa ter preverjanje vhodnih in ustvarjenih dokumentov z uradno shemo eSLOG 2.0. Za XSD test mora biti na voljo Python z modulom `lxml`; v okolju Codex se samodejno uporabi priloženi Python.

Glavni deli projekta:

- `src/eslog` – razčlenjevanje, razvrščanje, validacija, delitev in denarni izračuni;
- `src/hooks/useProcessor.tsx` – paketna obdelava, dvojniki, opozorila in izvozi;
- `src/components` – uporabniški pregled računov in postavk;
- `fixtures/realistic` – anonimizirana regresijska vzorca;
- `tests/schema` – uradna XSD eSLOG 2.0 in shema XMLDSig.
